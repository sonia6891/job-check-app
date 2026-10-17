#!/usr/bin/env bash
set -euo pipefail

# Native Xcode build. Expo CLI is used only to generate the native project.
# No Expo account, EAS CLI or EXPO_TOKEN is used.
mode="${1:-unsigned}"
[[ "$mode" == unsigned || "$mode" == adhoc || "$mode" == testflight ]] || { echo 'Expected unsigned, adhoc or testflight'; exit 1; }
[[ "$(uname -s)" == Darwin ]] || { echo 'This script needs macOS and Xcode.'; exit 1; }
export CI=1 EXPO_NO_TELEMETRY=1
mkdir -p build

required=()
[[ "$mode" != adhoc ]] || required=(IOS_CERTIFICATE_BASE64 IOS_CERTIFICATE_PASSWORD IOS_PROFILE_BASE64)
# TestFlight needs only the App Store Connect API key. A stored certificate and profile
# (from scripts/setup-testflight.mjs) are optional; without them a temporary pair is created.
if [[ "$mode" == testflight ]]; then
  required=(APP_STORE_CONNECT_KEY_ID APP_STORE_CONNECT_ISSUER_ID APP_STORE_CONNECT_KEY)
  [[ -z "${IOS_CERTIFICATE_BASE64:-}" ]] || required+=(IOS_CERTIFICATE_PASSWORD IOS_APPSTORE_PROFILE_BASE64)
fi
for key in ${required[@]+"${required[@]}"}; do
  [[ -n "${!key:-}" ]] || { echo "Missing GitHub Actions secret: $key"; exit 1; }
done

# Keep the same public backend configuration as the existing EAS base profile.
node <<'JS'
const fs = require('fs');
const env = require('./eas.json').build.base.env;
// RevenueCat 的公開 SDK 金鑰有填，App 才會開啟付費功能（src/lib/plan.ts 的 paymentsEnabled）。
const allowed = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID'];
fs.writeFileSync('.env.local', allowed.map(k => `${k}=${JSON.stringify(env[k] || '')}`).join('\n') + '\n');
JS
# Every TestFlight upload needs a new, larger CFBundleVersion; the workflow run number always grows.
if [[ "$mode" == testflight ]]; then
  export IOS_BUILD_NUMBER="${IOS_BUILD_NUMBER:-${GITHUB_RUN_NUMBER:-}}"
  [[ "$IOS_BUILD_NUMBER" =~ ^[0-9]+$ ]] || { echo 'Missing numeric build number (GITHUB_RUN_NUMBER)'; exit 1; }
  node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync('app.json','utf8'));a.expo.ios.buildNumber=process.env.IOS_BUILD_NUMBER;fs.writeFileSync('app.json',JSON.stringify(a,null,2)+'\n')"
  echo "iOS build number: $IOS_BUILD_NUMBER"
fi
npm run typecheck
npm run assets:brand
npm run check:native-config
npx expo prebuild --platform ios --no-install
(cd ios && pod install)

workspace="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
[[ -n "$workspace" ]] || { echo 'No generated Xcode workspace'; exit 1; }
xcodebuild -list -json -workspace "$workspace" > build/xcode-list.json
scheme="$(python3 - <<'PY'
import json, pathlib, xml.etree.ElementTree as ET
schemes = json.load(open('build/xcode-list.json'))['workspace']['schemes']
app = []
for path in pathlib.Path('ios').glob('*.xcodeproj/xcshareddata/xcschemes/*.xcscheme'):
    if any(n.get('BuildableName', '').endswith('.app') for n in ET.parse(path).iter('BuildableReference')):
        app.append(path.stem)
assert len(app) == 1 and app[0] in schemes, 'Expected exactly one app scheme'
print(app[0])
PY
)"

args=()
if [[ "$mode" == unsigned ]]; then
  args+=(CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO)
else
  signing_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/jobcheck-signing.XXXXXX")"
  keychain="$signing_dir/signing.keychain-db"
  profile_path=''
  cleanup() {
    # Revoke a temporary certificate if the build stopped before finishing.
    [[ ! -f "$signing_dir/asc-state.json" ]] || node scripts/ci-signing.mjs cleanup "$signing_dir" || true
    security delete-keychain "$keychain" >/dev/null 2>&1 || true
    [[ -z "$profile_path" ]] || rm -f "$profile_path"
    rm -rf "$signing_dir"
  }
  trap cleanup EXIT
  export SIGNING_DIR="$signing_dir" SIGNING_MODE="$mode"
  if [[ "$mode" == testflight ]]; then
    node scripts/ci-signing.mjs key "$signing_dir"
    if [[ -z "${IOS_CERTIFICATE_BASE64:-}" ]]; then
      # Revoked by ci-signing.mjs after Apple finishes processing the upload.
      node scripts/ci-signing.mjs create "$signing_dir"
      IOS_CERTIFICATE_PASSWORD="$(cat "$signing_dir/p12-password")"
    fi
  fi
  python3 - <<'PY'
import base64, os, pathlib
root = pathlib.Path(os.environ['SIGNING_DIR'])
profile = 'IOS_APPSTORE_PROFILE_BASE64' if os.environ['SIGNING_MODE'] == 'testflight' else 'IOS_PROFILE_BASE64'
for key, name in [('IOS_CERTIFICATE_BASE64','certificate.p12'),(profile,'profile.mobileprovision')]:
    if not (root / name).exists():
        (root / name).write_bytes(base64.b64decode(os.environ[key]))
PY
  security cms -D -i "$signing_dir/profile.mobileprovision" > "$signing_dir/profile.plist"
  python3 - <<'PY'
import datetime, os, pathlib, plistlib
root = pathlib.Path(os.environ['SIGNING_DIR'])
p = plistlib.loads((root / 'profile.plist').read_bytes())
e = p['Entitlements']
assert p['ExpirationDate'] > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None), 'Profile expired'
assert e['application-identifier'].endswith('.com.lumilab.jobcheck'), 'Wrong application profile'
assert not e.get('get-task-allow', False), 'Use a distribution profile, not a development profile'
if os.environ['SIGNING_MODE'] == 'testflight':
    assert not p.get('ProvisionedDevices') and not p.get('ProvisionsAllDevices'), 'Use an App Store distribution profile for TestFlight'
else:
    assert p.get('ProvisionedDevices'), 'Use an Ad Hoc distribution profile with the test iPhone registered'
assert 'Default' in e.get('com.apple.developer.applesignin', []), 'Profile needs Sign in with Apple capability'
for name, value in [('team', p['TeamIdentifier'][0]), ('uuid',p['UUID'])]:
    (root / name).write_text(value)
options = {'method':'release-testing','signingStyle':'manual','teamID':p['TeamIdentifier'][0], 'provisioningProfiles':{'com.lumilab.jobcheck':p['UUID']}}
if os.environ['SIGNING_MODE'] == 'testflight':
    # Export straight to App Store Connect; the build then appears in TestFlight after Apple processes it.
    options.update({'method':'app-store-connect','destination':'upload','uploadSymbols':True,'manageAppVersionAndBuildNumber':False})
pathlib.Path('build/ExportOptions.plist').write_bytes(plistlib.dumps(options))
PY
  team="$(cat "$signing_dir/team")"
  uuid="$(cat "$signing_dir/uuid")"
  password="$(openssl rand -hex 24)"
  security create-keychain -p "$password" "$keychain"
  security set-keychain-settings -lut 21600 "$keychain"
  security unlock-keychain -p "$password" "$keychain"
  security import "$signing_dir/certificate.p12" -k "$keychain" -P "$IOS_CERTIFICATE_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security >/dev/null
  security set-key-partition-list -S apple-tool:,apple:,codesign: -k "$password" "$keychain" >/dev/null
  security list-keychains -d user -s "$keychain" "$HOME/Library/Keychains/login.keychain-db"
  identity="$(security find-identity -v -p codesigning "$keychain" | awk '/Apple Distribution:|iPhone Distribution:/ {print $2; exit}')"
  [[ -n "$identity" ]] || { echo 'Certificate has no valid Apple Distribution signing identity'; exit 1; }
  mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles"
  profile_path="$HOME/Library/MobileDevice/Provisioning Profiles/$uuid.mobileprovision"
  cp "$signing_dir/profile.mobileprovision" "$profile_path"
  # Apply provisioning only to the application, not CocoaPods targets.
  export SIGNING_TEAM="$team" SIGNING_UUID="$uuid" SIGNING_IDENTITY="$identity"
  ruby -rxcodeproj <<'RUBY'
project = Xcodeproj::Project.open(Dir['ios/*.xcodeproj'].fetch(0))
project.targets.select { |t| t.product_type == 'com.apple.product-type.application' }.each do |t|
  t.build_configurations.each do |c|
    c.build_settings['CODE_SIGN_STYLE'] = 'Manual'
    c.build_settings['DEVELOPMENT_TEAM'] = ENV.fetch('SIGNING_TEAM')
    c.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = ENV.fetch('SIGNING_UUID')
    c.build_settings['CODE_SIGN_IDENTITY'] = ENV.fetch('SIGNING_IDENTITY')
  end
end
project.save
RUBY
fi

# The build repo is public, so hide the signing identity (the developer's name) from logs.
redact() { sed -E 's/(Apple|iPhone) (Distribution|Development): [^"(]*/\1 \2: [hidden] /g'; }
xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/JobCheck.xcarchive \
  -resultBundlePath build/ArchiveResult.xcresult ${args[@]+"${args[@]}"} archive 2>&1 | redact | tee build/archive.log
if [[ "$mode" == testflight ]]; then
  xcodebuild -exportArchive -archivePath build/JobCheck.xcarchive \
    -exportPath build/upload -exportOptionsPlist build/ExportOptions.plist -allowProvisioningUpdates \
    -authenticationKeyPath "$signing_dir/AuthKey.p8" -authenticationKeyID "$APP_STORE_CONNECT_KEY_ID" \
    -authenticationKeyIssuerID "$APP_STORE_CONNECT_ISSUER_ID" 2>&1 | redact | tee build/upload.log
  echo "Uploaded build $IOS_BUILD_NUMBER to App Store Connect."
  [[ ! -f "$signing_dir/asc-state.json" ]] || node scripts/ci-signing.mjs finish "$signing_dir" "$IOS_BUILD_NUMBER"
elif [[ "$mode" == adhoc ]]; then
  xcodebuild -exportArchive -archivePath build/JobCheck.xcarchive \
    -exportPath build/ipa -exportOptionsPlist build/ExportOptions.plist 2>&1 | redact | tee build/export.log
  echo 'Signed Ad Hoc IPA exported. Only registered devices can install it.'
else
  echo 'Native compilation passed. Unsigned archive is NOT installable on iPhone.'
fi
