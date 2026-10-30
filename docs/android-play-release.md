# Android 上架版建置：已簽署 AAB（不使用 Expo 帳號）

2026-10-28：Android 首發用**免費版**上 Google Play 封閉測試，不接 Google Play 結帳（Pro 頁只說明「Android 版之後開放」）。

建置和 iPhone 一樣在**公開打包專案** `sonia6891/job-check-app` 的 GitHub Actions 跑（私人專案的 Actions 不能用，見 `ios-without-expo-account.md`）：

- workflow：**Android Play AAB (No Expo Account)**（`.github/workflows/android-release.yml`）
- 腳本：`scripts/build-android-aab.sh`
- 產出：已用**上傳金鑰**簽署的 `app-release.aab`，放在該次執行的 Artifacts（`job-check-android-aab-編號`，保留 7 天）。
- **不會上傳到 Google Play**。下載 AAB 後自己到 Play Console 上傳。
- versionCode 自動用打包當下距 1970 年的分鐘數（2026 年約 2,990 萬），每次一定變大；版本名稱沿用 `app.json` 的 `version`。

打包紀錄是公開的：腳本不會印出金鑰、密碼或別名。公開專案的 Artifacts 登入 GitHub 的人都能下載，所以只保留 7 天；裡面是要給 Play 的安裝檔，不含金鑰。

## 一次性設定：產生上傳金鑰（upload keystore）

上傳金鑰只用來向 Google 證明「這個 AAB 是你傳的」。Google Play 會再用自己保管的「應用程式簽署金鑰」簽給使用者（Play 應用程式簽署，新 App 預設開啟）。上傳金鑰遺失可以向 Google 申請重設，但還是要好好保存。

**這些步驟請你自己在電腦上做，密碼不要貼給任何人（包括 Claude）。**

**最簡單：** 在 PowerShell 執行 `powershell -ExecutionPolicy Bypass -File D:\Projects\job-check-mobile\scripts\setup-android-upload-key.ps1`，它會請你輸入兩次密碼，然後自動做完下面 1–4 步（用 Android Studio 附的 keytool）。

手動做法：

1. 建一個放金鑰的資料夾，例如 `D:\Secrets\job-check-android\`（不要放在專案資料夾裡）。
2. 在 PowerShell 執行（`keytool` 隨 JDK 安裝；找不到的話先裝 [Temurin JDK 17](https://adoptium.net/)）：

   ```
   keytool -genkeypair -v -storetype PKCS12 -keystore D:\Secrets\job-check-android\upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   - 它會問金鑰庫密碼（輸入兩次）和姓名、組織等資料；姓名組織可以照實填或填 Lumi Lab。
   - PKCS12 格式的金鑰密碼和金鑰庫密碼相同，所以下面兩個密碼 secret 填一樣的值。
   - 把密碼記在密碼管理器。
3. 把金鑰轉成 Base64：

   ```
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('D:\Secrets\job-check-android\upload.jks')) | Set-Content -NoNewline D:\Secrets\job-check-android\upload.jks.b64
   ```

4. 存成公開打包專案的 GitHub secrets（用 `gh` 會提示你輸入值，不會留在指令紀錄）：

   ```
   Get-Content -Raw D:\Secrets\job-check-android\upload.jks.b64 | gh secret set ANDROID_UPLOAD_KEYSTORE_BASE64 -R sonia6891/job-check-app
   gh secret set ANDROID_UPLOAD_KEY_ALIAS -R sonia6891/job-check-app --body upload
   gh secret set ANDROID_UPLOAD_KEYSTORE_PASSWORD -R sonia6891/job-check-app
   gh secret set ANDROID_UPLOAD_KEY_PASSWORD -R sonia6891/job-check-app
   ```

   後兩行執行後會等你貼上密碼再按 Enter。也可以到 GitHub → `job-check-app` → Settings → Secrets and variables → Actions 手動新增。

| Secret | 值 |
| --- | --- |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | `upload.jks` 的 Base64 |
| `ANDROID_UPLOAD_KEYSTORE_PASSWORD` | 金鑰庫密碼 |
| `ANDROID_UPLOAD_KEY_ALIAS` | `upload`（上面指令的 `-alias`） |
| `ANDROID_UPLOAD_KEY_PASSWORD` | 金鑰密碼（PKCS12 時和金鑰庫密碼相同） |

5. `upload.jks.b64` 用完可以刪掉；`upload.jks` 和密碼要留著備份。

## 打包

在私人專案先 commit，再執行（同步到公開專案並開始打包）：

```
node scripts/sync-build-repo.mjs --build android
```

或在 GitHub → `job-check-app` → Actions → **Android Play AAB (No Expo Account)** → Run workflow。

成功時這次執行的 Summary 會列出 versionCode、SHA-256 和 AAB 要求的權限；Artifacts 裡有 `job-check-android-aab-編號`（解壓縮後是 `app-release.aab`）。

腳本會檢查：AAB 有內嵌 JavaScript、用上傳金鑰簽署（不是 debug 金鑰）、套件名稱 `com.lumilab.jobcheck`、versionCode 正確、沒有要求麥克風權限。

## 上傳到封閉測試

1. Play Console →「職缺體檢」→ 測試 → 封閉測試 → 建立版本 → 上傳 `app-release.aab`。
2. 第一次上傳時確認「Play 應用程式簽署」已開啟。
3. 上傳後到「設定 → 應用程式完整性」複製 **應用程式簽署金鑰的 SHA-1**。Google 登入要用這個 SHA-1 在 Google Cloud 建 Android OAuth 用戶端，否則 Android 版的 Google 登入會失敗（訪客模式不受影響）。
4. 個人開發人員帳號要至少 12 位測試人員連續 14 天參與封閉測試，才能申請正式版。

## 還沒驗證

- Android 真機：安裝、首次開啟、訪客模式、拍照／相簿 OCR（Google ML Kit）、Google／LINE 登入、刪除帳號。
- 過去的 debug APK 建置（2026-10-08）失敗且沒留下原因；這個 workflow 第一次跑才知道 Gradle 會不會過。
