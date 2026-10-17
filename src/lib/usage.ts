/**
 * 每人每月完整體檢次數上限。App 不收費（2026-10-17 決定），這只是防止濫用的上限。
 * 要和後端 consume_job_analysis_quota 的 v_limit 一致（tests/analysis-quota-db.test.mjs 會檢查）。
 */
export const MONTHLY_ANALYSIS_LIMIT = 30;
