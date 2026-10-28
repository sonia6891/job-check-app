#!/usr/bin/env bash
set -euo pipefail

# Signed Android App Bundle (AAB) for Google Play, built with Gradle on a Linux runner.
# Expo CLI only generates the native project; no Expo account, EAS CLI or EXPO_TOKEN.
# The bundle is signed with the upload key from GitHub secrets and is NOT uploaded anywhere:
# the workflow keeps it as an Actions artifact and the owner uploads it in Play Console.
# The build log is public (job-check-app): never print the keystore, passwords or alias.
[[ "$(uname -s)" == Linux ]] || { echo 'This script needs Linux and the Android SDK.'; exit 1; }
sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[[ -n "$sdk_root" ]] || { echo 'Android SDK not found.'; exit 1; }
for key in ANDROID_UPLOAD_KEYSTORE_BASE64 ANDROID_UPLOAD_KEYSTORE_PASSWORD ANDROID_UPLOAD_KEY_ALIAS ANDROID_UPLOAD_KEY_PASSWORD; do
  [[ -n "${!key:-}" ]] || { echo "Missing GitHub Actions secret: $key. See docs/android-play-release.md"; exit 1; }
done
export CI=1 EXPO_NO_TELEMETRY=1
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
mkdir -p build

# Same public backend configuration as the iOS build; never service-role keys.
node <<'JS'
const fs = require('fs');
const env = require('./eas.json').build.base.env;
const allowed = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_PRIVACY_POLICY_URL'];
fs.writeFileSync('.env.local', allowed.map(k => `${k}=${JSON.stringify(env[k] || '')}`).join('\n') + '\n');
JS

# Play needs a new, larger versionCode for every upload: minutes since 1970 (about 29.9 million in 2026,
# below Play's 2,100,000,000 limit), the same clock the iOS build number uses.
export ANDROID_VERSION_CODE="${ANDROID_VERSION_CODE:-$(( $(date -u +%s) / 60 ))}"
[[ "$ANDROID_VERSION_CODE" =~ ^[0-9]+$ ]] || { echo 'Missing numeric versionCode'; exit 1; }
node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync('app.json','utf8'));a.expo.android.versionCode=Number(process.env.ANDROID_VERSION_CODE);fs.writeFileSync('app.json',JSON.stringify(a,null,2)+'\n')"
echo "Android versionCode: $ANDROID_VERSION_CODE"

npm run typecheck
npm run assets:brand
npm run check:native-config
npx expo prebuild --platform android --no-install
test -f android/gradlew
test -f android/app/build.gradle

# Upload keystore only lives in the runner's temp folder for this job.
signing_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/jobcheck-android-signing.XXXXXX")"
trap 'rm -rf "$signing_dir"' EXIT
printf '%s' "$ANDROID_UPLOAD_KEYSTORE_BASE64" | base64 -d > "$signing_dir/upload.jks"
[[ -s "$signing_dir/upload.jks" ]] || { echo 'ANDROID_UPLOAD_KEYSTORE_BASE64 is not a Base64 keystore'; exit 1; }
export JOBCHECK_UPLOAD_STORE_FILE="$signing_dir/upload.jks"

# The Expo template signs release with the debug key; switch release to the upload key, read from the
# environment so nothing secret is written into the generated project.
node <<'JS'
const fs = require('fs');
const file = 'android/app/build.gradle';
let gradle = fs.readFileSync(file, 'utf8');
const release = `
        release {
            storeFile file(System.getenv('JOBCHECK_UPLOAD_STORE_FILE'))
            storePassword System.getenv('ANDROID_UPLOAD_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_UPLOAD_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_UPLOAD_KEY_PASSWORD')
        }`;
if (!/signingConfigs\s*\{/.test(gradle)) throw new Error('No signingConfigs block in android/app/build.gradle');
gradle = gradle.replace(/signingConfigs\s*\{/, m => m + release);
const types = gradle.search(/buildTypes\s*\{/);
const releaseType = types < 0 ? -1 : gradle.slice(types).search(/\n\s*release\s*\{/);
if (releaseType < 0) throw new Error('No release build type in android/app/build.gradle');
const start = types + releaseType;
const at = gradle.indexOf('signingConfig signingConfigs.debug', start);
const end = gradle.indexOf('\n        }', start + 1);
if (at < 0 || (end >= 0 && at > end)) throw new Error('Release build type does not use the debug signing config as expected');
gradle = gradle.slice(0, at) + 'signingConfig signingConfigs.release' + gradle.slice(at + 'signingConfig signingConfigs.debug'.length);
fs.writeFileSync(file, gradle);
console.log('Release build type now signs with the upload key.');
JS

set +e
(
  cd android
  timeout --signal=TERM --kill-after=30s 45m \
    bash ./gradlew :app:bundleRelease --no-daemon --max-workers=2 --no-parallel \
    --console=plain --stacktrace --warning-mode=summary
) 2>&1 | tee build/gradle-bundle.log
gradle_exit=${PIPESTATUS[0]}
set -e
if [[ "$gradle_exit" -ne 0 ]]; then
  {
    echo '## Android AAB compilation failed'
    echo "Gradle exit status: ${gradle_exit}"
    [[ "$gradle_exit" != 124 ]] || echo 'Gradle exceeded 45 minutes.'
    echo 'No AAB was produced.'
  } | tee build/android-bundle-summary.txt
  grep -Ei 'FAILURE:|BUILD FAILED|error:|Could not|Execution failed|Exception|No space left|OutOfMemory' build/gradle-bundle.log | tail -n 60 || true
  tail -n 80 build/gradle-bundle.log
  exit "$gradle_exit"
fi

aab=android/app/build/outputs/bundle/release/app-release.aab
test -s "$aab"
unzip -tq "$aab" >/dev/null
entries="$(unzip -Z1 "$aab")"
grep -Fxq 'base/assets/index.android.bundle' <<< "$entries" || { echo '::error::AAB has no bundled JavaScript'; exit 1; }

# Signed with the upload key, not the template's debug key.
# jarsigner exits 0 for an unsigned file too, so require its "jar verified." line.
jarsigner -verify "$aab" 2>&1 | grep -q '^jar verified\.' || { echo '::error::AAB is unsigned or its signature does not verify'; exit 1; }
if keytool -printcert -jarfile "$aab" | grep -q 'CN=Android Debug'; then echo '::error::AAB is signed with the debug key'; exit 1; fi

# Package, versionCode and permissions as Play will read them.
bundletool="$signing_dir/bundletool.jar"
curl -fsSL -o "$bundletool" https://github.com/google/bundletool/releases/download/1.18.1/bundletool-all-1.18.1.jar
java -jar "$bundletool" dump manifest --bundle "$aab" > build/android-manifest.xml
grep -q 'package="com.lumilab.jobcheck"' build/android-manifest.xml || { echo '::error::Unexpected package name'; exit 1; }
grep -q "android:versionCode=\"$ANDROID_VERSION_CODE\"" build/android-manifest.xml || { echo '::error::Unexpected versionCode'; exit 1; }
if grep -q 'android.permission.RECORD_AUDIO' build/android-manifest.xml; then echo '::error::RECORD_AUDIO should not be requested'; exit 1; fi
grep -o 'android.permission.[A-Z_]*' build/android-manifest.xml | sort -u | tee build/android-permissions.txt

sha256sum "$aab" | tee build/android-aab.sha256
stat -c 'AAB size: %s bytes' "$aab"
echo "Signed AAB ready (versionCode $ANDROID_VERSION_CODE). Not uploaded to Google Play; device testing still needed."
