#!/usr/bin/env node
// npm install 後自動執行（postinstall）。
// expo-ocr-kit 0.1.4 只辨識英文：iOS 沒設定辨識語言（Apple Vision 預設只有英文），
// Android 只載入拉丁字母模型。中文職缺截圖會變成亂碼，公司名稱、職稱都抓不到。
// Android 也改成一行一個文字區塊，長截圖切段辨識才接得起來。
// 這裡補上繁體／簡體中文辨識；找不到要改的地方就讓安裝失敗，避免默默打包出只認英文的版本。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const root = 'node_modules/expo-ocr-kit';
const patches = [
  {
    file: `${root}/ios/ExpoOcrKitModule.swift`,
    done: 'request.recognitionLanguages',
    find: 'request.usesLanguageCorrection = true',
    replace: 'request.usesLanguageCorrection = true\n    request.recognitionLanguages = ["zh-Hant", "zh-Hans", "en-US"]'
  },
  {
    file: `${root}/android/src/main/java/expo/modules/ocrkit/ExpoOcrKitModule.kt`,
    done: 'ChineseTextRecognizerOptions.Builder().build()',
    find: 'TextRecognizerOptions.DEFAULT_OPTIONS',
    replace: 'ChineseTextRecognizerOptions.Builder().build()'
  },
  {
    file: `${root}/android/src/main/java/expo/modules/ocrkit/ExpoOcrKitModule.kt`,
    done: 'import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions',
    find: 'import com.google.mlkit.vision.text.latin.TextRecognizerOptions',
    replace: 'import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions'
  },
  {
    // ML Kit 回傳的是段落；改成一行一個區塊（和 iOS 一樣），長截圖切段時才不會整段重複。
    file: `${root}/android/src/main/java/expo/modules/ocrkit/ExpoOcrKitModule.kt`,
    done: 'block.lines.map { line ->',
    find: [
      '"blocks" to result.textBlocks.map { block ->',
      '        mapOf(',
      '          "text" to block.text,',
      '          "boundingBox" to rectToMap(block.boundingBox, scaleFactor)',
      '        )',
      '      }'
    ].join('\n'),
    replace: [
      '"blocks" to result.textBlocks.flatMap { block ->',
      '        block.lines.map { line ->',
      '          mapOf(',
      '            "text" to line.text,',
      '            "boundingBox" to rectToMap(line.boundingBox, scaleFactor)',
      '          )',
      '        }',
      '      }'
    ].join('\n')
  },
  {
    file: `${root}/android/build.gradle`,
    done: 'text-recognition-chinese',
    find: 'implementation("com.google.mlkit:text-recognition:16.0.1")',
    replace: 'implementation("com.google.mlkit:text-recognition:16.0.1")\n  implementation("com.google.mlkit:text-recognition-chinese:16.0.1")'
  }
];

if (!existsSync(root)) process.exit(0);
for (const { file, done, find, replace } of patches) {
  const source = readFileSync(file, 'utf8');
  if (source.includes(done)) continue;
  if (!source.includes(find)) {
    console.error(`patch-native-modules: ${file} 的內容和預期不同（expo-ocr-kit 改版了？），中文辨識沒有補上。`);
    process.exit(1);
  }
  writeFileSync(file, source.replace(find, replace));
}
console.log('patch-native-modules: expo-ocr-kit 已啟用繁體／簡體中文辨識');
