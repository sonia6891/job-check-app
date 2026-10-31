// 用 iOS 27 SDK 打包的 App 一定要走 Scene 生命週期，否則一開就閃退（UIKit 的 NoSceneLifecycleAdoption 檢查）。
// Expo 57 內建 ExpoAppSceneDelegate，但 prebuild 範本的 AppDelegate 還沒接上，這裡改寫產生出來的 AppDelegate.swift。
// app.json 的 ios.infoPlist 另外宣告 UIApplicationSceneManifest，指向這裡加的 SceneDelegate。
// 找不到要改的地方就讓 prebuild 失敗，避免默默打包出會閃退的版本。
const { withAppDelegate } = require('expo/config-plugins');

const DECLARATION = 'class AppDelegate: ExpoAppDelegate {';
const START_IN_WINDOW = /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;
const SCENE_DELEGATE = '\nclass SceneDelegate: ExpoAppSceneDelegate {}\n';

function adoptSceneLifecycle(source) {
  if (source.includes('class SceneDelegate: ExpoAppSceneDelegate')) return source;
  if (!source.includes(DECLARATION)) throw new Error('with-ios-scene-lifecycle: AppDelegate declaration not found');
  if (!START_IN_WINDOW.test(source)) throw new Error('with-ios-scene-lifecycle: startReactNative block not found');
  return source
    .replace(DECLARATION, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
    .replace(START_IN_WINDOW, '') + SCENE_DELEGATE;
}

module.exports = (config) => withAppDelegate(config, (next) => {
  if (next.modResults.language !== 'swift') throw new Error('with-ios-scene-lifecycle: expected a Swift AppDelegate');
  next.modResults.contents = adoptSceneLifecycle(next.modResults.contents);
  return next;
});
module.exports.adoptSceneLifecycle = adoptSceneLifecycle;
