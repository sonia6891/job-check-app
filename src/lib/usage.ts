/**
 * 每月完整體檢次數（2026-10-18 加回 Pro）：免費 5 次；Pro 畫面上顯示「不限次數」，後端仍有 300 次防濫用上限。
 * 要和後端 consume_job_analysis_quota 一致（tests/analysis-quota-db.test.mjs 會檢查）。
 * 詐騙警訊與違規紀錄不受次數影響，永遠免費顯示。
 */
export const FREE_MONTHLY_LIMIT = 5;
export const PRO_MONTHLY_LIMIT = 300;

/** 購買功能還沒開（網頁、Android）時，後端仍是全免費、每月 30 次（20261017100000_free_for_everyone）。 */
export const LEGACY_MONTHLY_LIMIT = 30;
