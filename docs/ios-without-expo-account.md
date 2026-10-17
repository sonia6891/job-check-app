# iPhone 建置：不使用 Expo 帳號

2026-10-07：依使用者裁定，改走 GitHub Actions macOS + Xcode。保留 Expo SDK 作為程式框架，只用 `expo prebuild` 產生原生工程，不使用 EAS、Expo 登入或 EXPO_TOKEN。

## 兩個專案

2026-10-17：私人專案的 Actions 因 GitHub 付款／花費上限無法執行，改在公開專案打包（公開專案的 Actions 免費）。

- **私人開發專案** `sonia6891/job-check-mobile`：全部程式碼、後端（`supabase/`）、文件、測試。平常只在這裡開發。
- **公開打包專案** `sonia6891/job-check-app`（本機 `D:\Projects\job-check-app`）：只有 App 畫面程式碼、圖示、打包腳本與 iOS workflow。不要直接修改。

要出新版本時，在私人專案先提交，再執行（同步已提交的版本並開始打包上傳）：

```
node scripts/sync-build-repo.mjs --build testflight
```

只想做編譯檢查用 `--build unsigned`；不加 `--build` 只同步不打包。下面提到的 secrets 都設在公開打包專案。

## 執行方式

公開打包專案的 GitHub → Actions → **iOS Native (No Expo Account)** → Run workflow。

- `unsigned`：Release 原生編譯檢查；成功不代表能裝到 iPhone。
- `adhoc`：使用 Apple Distribution 憑證及 Ad Hoc 描述檔產出 IPA。成功後在該次執行的 Artifacts 下載 `job-check-ios-adhoc-*`。這不是公開安裝網址。
- `testflight`：用 App Store 描述檔簽章後直接上傳 App Store Connect，Apple 處理完（通常 5–30 分鐘）出現在 TestFlight。版本號沿用 `app.json` 的 `version`，建置號自動用該次 workflow 的執行編號（每次一定變大）。不產生 Artifacts，不受附件額度影響。

也可以在命令列執行：`gh workflow run ios-native.yml -R sonia6891/job-check-app -f mode=testflight`（不會先同步程式碼）。

## TestFlight 一次性設定（不需要 Mac）

**最簡單：只設 API 金鑰。** 在公開打包專案的 Settings → Secrets and variables → Actions 新增三個 secrets：`APPLE_ASC_KEY_ID`（Key ID）、`APPLE_ASC_ISSUER_ID`（Issuer ID）、`APPLE_ASC_KEY_P8`（.p8 檔內容，原文或 Base64 都可以）。金鑰角色要「管理（Admin）」。每次打包時 `scripts/ci-signing.mjs` 會用這把金鑰臨時建立發佈憑證與 App Store 描述檔，上傳後等 Apple 處理完、交給內部測試群組（群組沒人時自動加入 App Store Connect 團隊成員），再撤銷憑證與描述檔，不佔名額。打包紀錄是公開的：腳本不印出金鑰、信箱、名字或 ID，xcodebuild 紀錄中的簽章身分會被遮掉，有簽章的建置也不上傳 xcresult。

以下用 `setup-testflight.mjs` 的做法可選：改用一張長期保存的憑證，打包時就不會每次建立／撤銷。

1. App Store Connect →「使用者與存取權限」→「整合」→「App Store Connect API」→ 團隊金鑰，新增一把「管理（Admin）」角色的金鑰。下載 `AuthKey_XXXX.p8`（只能下載一次），記下頁面上的 Issuer ID。建議把 .p8 放到 `D:\Secrets\job-check-ios\`。
2. 在私人開發專案資料夾執行：

   ```
   node scripts/setup-testflight.mjs --key D:\Secrets\job-check-ios\AuthKey_XXXX.p8 --issuer <Issuer ID>
   ```

   腳本會：註冊 App ID 並開啟「使用 Apple 登入」（已有就跳過）→ 確認 App Store Connect 已有這個 App → 在本機產生私鑰並建立 Apple Distribution 憑證 → 建立 App Store 描述檔 → 用 `gh secret set` 把下表 6 個 secrets 存進公開打包專案 → 建立 TestFlight 內部測試群組 → 自動開始第一次上傳。
   - App Store Connect 還沒有這個 App 時，腳本會停下並說明怎麼在網頁新增（Apple 不開放用 API 建立），新增後再跑同一行指令。
   - 加 `--tester 信箱` 可順便把該 App Store Connect 使用者加進內部測試群組；`--no-run` 只設定不上傳。
   - 中途失敗會撤銷剛建立的憑證，不佔發佈憑證名額。私鑰、憑證與描述檔留在 `D:\Secrets\job-check-ios\`，不要上傳或分享。
3. 上傳完成後，到 App Store Connect → TestFlight →「內部測試」群組加入測試人員（必須是 App Store Connect 團隊成員）。測試人員在 iPhone 安裝 TestFlight App，用收到的邀請安裝。內部測試不需要 Apple 審查。

| Secret（testflight） | 值 |
| --- | --- |
| `IOS_CERTIFICATE_BASE64` | Apple Distribution `.p12`（含私鑰）的 Base64；與 adhoc 共用 |
| `IOS_CERTIFICATE_PASSWORD` | 該 `.p12` 的隨機密碼 |
| `IOS_APPSTORE_PROFILE_BASE64` | `com.lumilab.jobcheck` 的 App Store 描述檔 Base64 |
| `APP_STORE_CONNECT_KEY_ID` | API 金鑰的 Key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID |
| `APP_STORE_CONNECT_KEY_BASE64` | `.p8` 檔的 Base64 |

`app.json` 已設定 `ios.config.usesNonExemptEncryption: false`（只用 HTTPS，屬豁免加密），TestFlight 不會每次卡在「出口合規」問題。

## Ad Hoc 一次性 Apple 簽章設定

在本儲存庫 Settings → Secrets and variables → Actions 設定：

| Secret | 值 |
| --- | --- |
| `IOS_CERTIFICATE_BASE64` | Apple Distribution 的 `.p12` 檔轉 Base64（含私鑰） |
| `IOS_CERTIFICATE_PASSWORD` | 該 `.p12` 匯出密碼 |
| `IOS_PROFILE_BASE64` | `com.lumilab.jobcheck` 的 Ad Hoc `.mobileprovision` 檔轉 Base64 |

描述檔須啟用 Sign in with Apple，包含測試 iPhone 的 UDID，並使用與 `.p12` 相符的有效憑證。不可使用另一個 App 的描述檔。不要將憑證、私鑰或密碼貼入聊天、提交至 Git，或放進 EXPO_PUBLIC 變數。

腳本會檢查描述檔期限、App ID、Ad Hoc 裝置及 Apple 登入能力；只修改本次產生的 App target 簽章設定。暫存 keychain、描述檔與憑證會於結束時清除。

## 設定與驗證範圍

- 後端公開設定沿用 `eas.json` 的 `build.base.env`，此處只是讀取設定檔，不會呼叫 EAS。
- 現有工程沒有 package-lock.json 時先執行 npm install，並保留本次 lock 作為診斷附件；有 lock 時使用 npm ci。
- workflow 使用 macos-26、Node 22、Xcode 26.6 及 runner 內建 CocoaPods。SDK 57 最低需求為 Xcode 26.4；首兩輪已實際確認 Xcode 16.4／26.3 會在 ExpoModulesJSI 編譯失敗。
- `npm run typecheck` 在原生編譯前執行。unsigned 模式不是簽章、安裝或真機功能驗收。
- 圖示、隱私權公開網址（外部測試與上架才需要）、Apple 登入撤銷與真實帳號完整流程等既有待辦仍需完成。
- Windows 工程維持在 `D:\Projects\job-check-mobile`，GitHub runner 的原生暫存由雲端處理。

參考：
- https://docs.expo.dev/guides/local-app-development/
- https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications

## 本次已知外部阻礙

GitHub Actions 在首輪回報 `Artifact storage quota has been hit`。診斷附件上傳改為非阻斷；adhoc 的簽章 IPA 上傳仍必須成功才算交付，不能把額度錯誤當成成功。testflight 模式直接上傳 Apple，不需要附件。尚未刪除任何既有附件，也未更改付費設定。
