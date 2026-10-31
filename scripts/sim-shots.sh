#!/usr/bin/env bash
set -uo pipefail

# 編出模擬器用的 App，在 iPad、iPhone Duo、iPhone 上開幾個畫面截圖到 build/sim-shots。
# 只用來看版面，不簽署也不上傳。
export CI=1 EXPO_NO_TELEMETRY=1
out=build/sim-shots
mkdir -p "$out"

node <<'JS'
const fs = require('fs');
const env = require('./eas.json').build.base.env;
const allowed = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_PRIVACY_POLICY_URL'];
fs.writeFileSync('.env.local', allowed.map(k => `${k}=${JSON.stringify(env[k] || '')}`).join('\n') + '\n');
JS
# 只有這個測試版有：用啟動參數 -simRoute /tools 直接開某一頁，這段不會進正式版。
cat > src/sim-route.ts <<'TS'
import { Settings } from 'react-native';
import { router } from 'expo-router';
const route = Settings.get('simRoute');
if (route && route !== '/') setTimeout(() => router.replace(route), 10000);
TS
{ echo "import '@/src/sim-route';"; cat app/_layout.tsx; } > build/layout.tmp && mv build/layout.tmp app/_layout.tsx
npm run assets:brand || exit 1
npx expo prebuild --platform ios --no-install || exit 1
(cd ios && pod install) || exit 1

/usr/libexec/PlistBuddy -c 'Print' ios/*/Info.plist | grep -n -A6 -E 'UISupportedInterfaceOrientations|UIRequiresFullScreen' > "$out/info-plist.txt" || true

workspace="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
scheme="$(basename "$workspace" .xcworkspace)"
xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build/sim \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build > build/sim-build.log 2>&1
status=$?
tail -5 build/sim-build.log
cp build/sim-build.log "$out/" 2>/dev/null
[[ $status -eq 0 ]] || exit $status

app="$(find build/sim/Build/Products -maxdepth 2 -name '*.app' -print -quit)"
# 模擬器要有簽章才跑得起來；這裡用不需要憑證的臨時簽章。
codesign --force --deep --sign - "$app"
(cd "$(dirname "$app")" && ditto -c -k --sequesterRsrc --keepParent "$(basename "$app")" "$OLDPWD/$out/app-simulator.zip")
bundle=com.lumilab.jobcheck
routes=(home:/ tools:/tools me:/me jobs:/jobs plans:/plans sources:/sources)

xcrun simctl list devicetypes > "$out/device-types.txt"
xcrun simctl list runtimes > "$out/runtimes.txt"
xcrun simctl help io > "$out/simctl-io-help.txt" 2>&1
xcrun simctl help ui > "$out/simctl-ui-help.txt" 2>&1

snap() { # 裝置編號 檔名前綴 畫面名稱
  local udid="$1" prefix="$2" key="$3"
  if [[ "$prefix" == duo ]]; then
    # Duo 有兩個螢幕：1 是外螢幕 1398×2034，3 是內螢幕 2007×2853。
    xcrun simctl io "$udid" screenshot --display=1 "$out/$prefix-out-$key.png" 2>> "$out/$prefix-shot-errors.txt"
    xcrun simctl io "$udid" screenshot --display=3 "$out/$prefix-in-$key.png" 2>> "$out/$prefix-shot-errors.txt"
  else
    xcrun simctl io "$udid" screenshot "$out/$prefix-$key.png" 2>> "$out/$prefix-shot-errors.txt"
  fi
}

shoot() { # 裝置名稱 檔名前綴
  local name="$1" prefix="$2" udid data dir key pair route
  udid="$(xcrun simctl list devices available -j | python3 -c "
import json, sys
hits = [d for r in json.load(sys.stdin)['devices'].values() for d in r if d['name'] == sys.argv[1]]
print(hits[-1]['udid'] if hits else '')" "$name")"
  if [[ -z "$udid" ]]; then echo "No simulator named $name" | tee -a "$out/errors.txt"; return; fi
  xcrun simctl boot "$udid"
  xcrun simctl bootstatus "$udid" -b > /dev/null
  xcrun simctl status_bar "$udid" override --time 9:41 --batteryState charged --batteryLevel 100 || true
  xcrun simctl io "$udid" enumerate > "$out/$prefix-displays.txt" 2>&1
  xcrun simctl install "$udid" "$app"
  # 先寫入「看過引導頁」，開起來直接進首頁。
  data="$(xcrun simctl get_app_container "$udid" "$bundle" data)"
  dir="$data/Library/Application Support/$bundle/RCTAsyncLocalStorage_V1"
  mkdir -p "$dir"
  printf '{"jobcheck.onboarded":"1"}' > "$dir/manifest.json"
  for pair in "${routes[@]}"; do
    key="${pair%%:*}"; route="${pair#*:}"
    xcrun simctl terminate "$udid" "$bundle" 2>/dev/null
    xcrun simctl launch --stdout="$PWD/$out/$prefix-stdout.txt" --stderr="$PWD/$out/$prefix-stderr.txt" "$udid" "$bundle" -simRoute "$route" >> "$out/$prefix-launch.txt" 2>&1
    sleep 30
    snap "$udid" "$prefix" "$key"
  done
  # 自訂網址走 SceneDelegate；第一次可能跳系統確認框，截圖看得到。
  xcrun simctl openurl "$udid" "jobcheck://me" 2>> "$out/$prefix-shot-errors.txt"
  sleep 8
  snap "$udid" "$prefix" deeplink
  if [[ "$prefix" == duo ]]; then
    # 關掉外螢幕，看 App 會不會搬到內螢幕（等於打開手機）。
    xcrun simctl io "$udid" screenConfig --display=1 power off >> "$out/$prefix-shot-errors.txt" 2>&1
    sleep 10
    snap "$udid" "$prefix" unfolded
    xcrun simctl io "$udid" screenConfig --display=1 power on >> "$out/$prefix-shot-errors.txt" 2>&1
  fi
  if ! xcrun simctl spawn "$udid" launchctl list | grep -q "UIKitApplication:$bundle"; then
    echo "$name: app is not running at the end" | tee -a "$out/errors.txt"
  fi
  mkdir -p "$out/crashes"
  cp ~/Library/Logs/DiagnosticReports/app-*.ips "$out/crashes/" 2>/dev/null
  xcrun simctl spawn "$udid" log show --info --last 3m --predicate "process == \"$scheme\"" --style compact 2>/dev/null | tail -400 > "$out/$prefix-log.txt"
  xcrun simctl shutdown "$udid"
}

shoot 'iPad Pro 13-inch (M5)' ipad
shoot 'iPhone Duo' duo
shoot 'iPhone 18 Pro Max' iphone
ls -la "$out"
[[ ! -f "$out/errors.txt" ]]
