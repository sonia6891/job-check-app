#!/usr/bin/env bash
set -uo pipefail

# 快速看 iPhone Duo：沿用完整模擬器測試編好的 App，只換 JS，省掉 20 分鐘原生編譯。
# 外螢幕、打開、半摺、橫放都拍，並記下每個姿勢 App 實際拿到的安全區。不簽署也不上傳。
export CI=1 EXPO_NO_TELEMETRY=1
out=build/sim-shots
mkdir -p "$out" build/quick
uname -m | tee "$out/arch.txt"

node <<'JS'
const fs = require('fs');
const env = require('./eas.json').build.base.env;
const allowed = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_PRIVACY_POLICY_URL'];
fs.writeFileSync('.env.local', allowed.map(k => `${k}=${JSON.stringify(env[k] || '')}`).join('\n') + '\n');
JS
# 只有這個測試版有：-simRoute 直接開某一頁、-simUrl 從 App 內開網址（走 SceneDelegate）、把安全區寫進偏好設定。
cat > src/sim-route.ts <<'TS'
import { Dimensions, Linking, Settings } from 'react-native';
import { router } from 'expo-router';
const route = Settings.get('simRoute');
const url = Settings.get('simUrl');
if (route && route !== '/') setTimeout(() => router.replace(route), 10000);
if (url && url !== 'none') setTimeout(() => Linking.openURL(url), 16000);
export function report(insets: object) {
  Settings.set({ simMetrics: JSON.stringify({ insets, window: Dimensions.get('window') }) });
}
TS
{ echo "import '@/src/sim-route';"; cat app/_layout.tsx; } > build/layout.tmp && mv build/layout.tmp app/_layout.tsx
node <<'JS'
const fs = require('fs');
const file = 'src/ui/index.tsx';
const line = 'const insets = useSafeAreaInsets();';
const source = fs.readFileSync(file, 'utf8');
if (!source.includes(line)) throw new Error('useSafeAreaInsets line not found');
fs.writeFileSync(file, source.replace(line, `${line}\n  require('@/src/sim-route').report(insets);`));
JS
npm run assets:brand || exit 1

ditto -x -k build/base/app-simulator.zip build/quick || exit 1
app="$(find build/quick -maxdepth 1 -name '*.app' -print -quit)"
npx expo export:embed --platform ios --dev false --reset-cache --bundle-output build/main.js --assets-dest "$app" 2>&1 | tail -5
[[ -s build/main.js ]] || exit 1
node_modules/hermes-compiler/hermesc/osx-bin/hermesc -emit-binary -O -out "$app/main.jsbundle" build/main.js || exit 1
codesign --force --deep --sign - "$app"

bundle=com.lumilab.jobcheck
routes=(home:/ tools:/tools me:/me jobs:/jobs plans:/plans sources:/sources)
sim() { npx --yes serve-sim@0.1.48 "$@" >> "$out/serve-sim.txt" 2>&1 || echo "serve-sim $* failed" | tee -a "$out/errors.txt"; }

udid="$(xcrun simctl list devices available -j | python3 -c "
import json, sys
hits = [d for r in json.load(sys.stdin)['devices'].values() for d in r if d['name'] == 'iPhone Duo']
print(hits[-1]['udid'] if hits else '')")"
[[ -n "$udid" ]] || { echo 'No iPhone Duo simulator' | tee -a "$out/errors.txt"; exit 1; }
xcrun simctl boot "$udid"
xcrun simctl bootstatus "$udid" -b > /dev/null
xcrun simctl status_bar "$udid" override --time 9:41 --batteryState charged --batteryLevel 100 || true
xcrun simctl install "$udid" "$app"
data="$(xcrun simctl get_app_container "$udid" "$bundle" data)"
dir="$data/Library/Application Support/$bundle/RCTAsyncLocalStorage_V1"
mkdir -p "$dir"
printf '{"jobcheck.onboarded":"1"}' > "$dir/manifest.json"

snap() { # 檔名：外螢幕和內螢幕都拍，沒亮的那面會是全黑
  xcrun simctl io "$udid" screenshot --display=1 "$out/out-$1.png" 2>> "$out/shot-errors.txt"
  xcrun simctl io "$udid" screenshot --display=3 "$out/in-$1.png" 2>> "$out/shot-errors.txt"
  { echo "== $1"; plutil -extract simMetrics raw "$data/Library/Preferences/$bundle.plist" 2>&1; } >> "$out/metrics.txt"
}
launch() { # 路徑 網址
  xcrun simctl terminate "$udid" "$bundle" 2>/dev/null
  xcrun simctl launch --stderr="$PWD/$out/stderr.txt" "$udid" "$bundle" -simRoute "$1" -simUrl "${2:-none}" >> "$out/launch.txt" 2>&1
}
pages() { # 姿勢名稱
  local pair
  for pair in "${routes[@]}"; do
    launch "${pair#*:}"
    sleep 25
    snap "$1-${pair%%:*}"
  done
}

launch /
sleep 25
snap closed-home
# fold、rotate 要透過 serve-sim 的背景服務。
npx --yes serve-sim@0.1.48 --detach "$udid" >> "$out/serve-sim.txt" 2>&1
sleep 8
# 在 App 開著的時候打開手機，看畫面有沒有順利接到內螢幕。
sim fold 180 -d "$udid"
sleep 15
snap live-open
pages open
launch /jobs jobcheck://me
sleep 28
snap open-url
sim rotate landscape_right -d "$udid"
sleep 12
snap open-landscape
sim rotate portrait -d "$udid"
sleep 8
sim fold 130 -d "$udid"
sleep 12
snap book
sim fold 0 -d "$udid"
sleep 15
snap live-closed
# 先存檔再找：pipefail 下 grep -q 提早結束會讓 launchctl 收到 SIGPIPE，變成誤報。
xcrun simctl spawn "$udid" launchctl list > "$out/launchctl.txt"
if ! grep -q "UIKitApplication:$bundle" "$out/launchctl.txt"; then
  echo 'app is not running at the end' | tee -a "$out/errors.txt"
fi
mkdir -p "$out/crashes"
cp ~/Library/Logs/DiagnosticReports/app-*.ips "$out/crashes/" 2>/dev/null
ls -la "$out"
[[ ! -f "$out/errors.txt" ]]
