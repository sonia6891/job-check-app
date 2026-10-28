import { readFileSync, existsSync } from 'node:fs';

const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const errors = [];
const pending = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const hasPlugin = (name) => app.plugins?.some((p) =>
  p === name || (Array.isArray(p) && p[0] === name));

check(app.scheme === 'jobcheck', 'Deep-link scheme must stay jobcheck');
check(app.ios?.usesAppleSignIn === true, 'iOS Apple Sign In entitlement missing');
check(Boolean(app.ios?.bundleIdentifier), 'iOS bundle identifier missing');
check(app.ios?.config?.usesNonExemptEncryption === false, 'iOS export-compliance answer missing (TestFlight would wait for a manual answer)');
check(Boolean(app.android?.package), 'Android package name missing');
check(hasPlugin('expo-apple-authentication'), 'Native Apple authentication plugin missing');
check(hasPlugin('expo-image-picker'), 'Camera/gallery permissions plugin missing');
check(hasPlugin('expo-secure-store'), 'Native encrypted transfer cache plugin missing');
// App Review rejected 1.0.0 (5.1.1) for a microphone purpose string; the app uses neither the microphone nor Face ID.
const pluginOptions = (name) => app.plugins?.find((p) => Array.isArray(p) && p[0] === name)?.[1] ?? {};
check(pluginOptions('expo-image-picker').microphonePermission === false, 'expo-image-picker must set microphonePermission: false (no NSMicrophoneUsageDescription)');
check(pluginOptions('expo-secure-store').faceIDPermission === false, 'expo-secure-store must set faceIDPermission: false (no NSFaceIDUsageDescription)');
check(!app.ios?.infoPlist?.NSMicrophoneUsageDescription, 'ios.infoPlist must not declare NSMicrophoneUsageDescription');
check(Boolean(pkg.dependencies?.['expo-secure-store']), 'Expo SecureStore dependency missing');
check(Boolean(pkg.dependencies?.['expo-ocr-kit']), 'Native OCR package missing');
check(existsSync('app/(tabs)/_layout.tsx'), 'Mobile bottom navigation missing');
check(existsSync('app/privacy.tsx'), 'Privacy route missing');
check(existsSync('docs/ios-without-expo-account.md'), 'No-Expo-account iOS build instructions missing');
check(existsSync('.github/workflows/ios-native.yml'), 'Xcode build workflow missing');

check(hasPlugin('expo-splash-screen'), 'Expo 57 splash-screen config plugin missing');
check(Boolean(pkg.dependencies?.['expo-splash-screen']), 'Splash-screen package dependency missing');
check(Boolean(pkg.devDependencies?.sharp), 'Brand asset generator requires sharp');
const resolved = [
  [app.icon, 1024, 1024, 'iOS store icon'],
  [app.android?.adaptiveIcon?.foregroundImage, 1024, 1024, 'Android adaptive foreground'],
  [app.plugins?.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen')?.[1]?.image, 1024, 1024, 'Splash mark'],
  ['public/icon-192.png', 192, 192, 'Web icon 192'],
  ['public/icon-512.png', 512, 512, 'Web icon 512']
];
function pngSize(file) {
  const bytes = readFileSync(file);
  if (bytes.subarray(1,4).toString() !== 'PNG') throw Error('Not a PNG: ' + file);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}
for (const [path, width, height, label] of resolved) {
  check(Boolean(path), label + ' configuration is missing');
  if (!path) continue;
  check(existsSync(path), label + ' asset is missing (run npm run assets:brand)');
  if (existsSync(path)) {
    const [actualWidth, actualHeight] = pngSize(path);
    check(actualWidth === width && actualHeight === height,
      label + ' must be ' + width + 'x' + height);
  }
}
check(existsSync('assets/brand/app-icon.svg'), 'Vector icon master assets/brand/app-icon.svg missing');
// expo-ocr-kit only reads English unless scripts/patch-native-modules.mjs ran (npm postinstall).
const ocrModule = 'node_modules/expo-ocr-kit/ios/ExpoOcrKitModule.swift';
if (existsSync(ocrModule)) {
  check(readFileSync(ocrModule, 'utf8').includes('"zh-Hant"'), 'expo-ocr-kit is missing the Chinese OCR patch (run npm install)');
}
// App Store rejects store icons with an alpha channel (PNG color type 6).
if (app.icon && existsSync(app.icon)) {
  check(readFileSync(app.icon)[25] !== 6, 'iOS store icon must not have an alpha channel');
}

const lines = [
  '## Job Check native configuration audit',
  errors.length ? `❌ ${errors.length} structural configuration error(s)` : '✅ Native project structure checked',
  ...errors.map(e=>'- ERROR: '+e),
  ...pending.map(w=>'- PENDING: '+w),
  '',
  '**Scope:** static configuration only. This is not an iOS/Android build or installation test.'
];
const result = lines.join('\n');
console.log(result);
if (process.env.GITHUB_STEP_SUMMARY) {
  const fs = await import('node:fs');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, result + '\n');
}
if (errors.length) process.exitCode = 1;
