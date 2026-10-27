/**
 * App Store 評分邀請的時機（和「喵的，又要上班了」同一套規則），只做判斷，不碰儲存和原生 API：
 *   report3 — 第 3 份看完的體檢報告（不同職缺）；
 *   day7    — 第 7 個有打開 App 的日子。
 * 前 3 天不問；問過一次後 120 天內不再問。時機到了但還在前 3 天，就記成 pending，等可以問時再問。
 * Apple 自己另外限制一年最多跳 3 次，要不要真的跳出來由 Apple 決定。
 */
export type ReviewState = {
  /** 第一次使用（毫秒）。 */
  first?: number;
  /** 打開過 App 的不同日子數。 */
  days?: number;
  /** 上次打開的日子（本地 YYYY-MM-DD）。 */
  lastDay?: string;
  /** 看過報告的職缺，最多記 3 個就夠了。 */
  reports?: string[];
  /** 時機到了、還沒問。 */
  pending?: 'report3' | 'day7';
  /** 上次請 Apple 跳評分的時間（毫秒）。 */
  asked?: number;
};

export const DAY = 86400000;
export const QUIET = 3 * DAY;
export const GAP = 120 * DAY;
export const REPORTS = 3;
export const USE_DAYS = 7;

export function localDay(now: number) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function eligible(state: ReviewState, now: number) {
  if (!state.first || now - state.first < QUIET) return false;
  return !state.asked || Math.abs(now - state.asked) >= GAP;
}

function result(state: ReviewState, now: number) {
  return { state, ask: Boolean(state.pending) && eligible(state, now) };
}

/** 打開（或回到）App。 */
export function recordOpen(prev: ReviewState, now: number) {
  const state: ReviewState = { ...prev, first: prev.first ?? now };
  const today = localDay(now);
  if (state.lastDay !== today) {
    state.lastDay = today;
    state.days = (state.days ?? 0) + 1;
    if (state.days === USE_DAYS) state.pending = state.pending ?? 'day7';
  }
  return result(state, now);
}

/** 看完一份體檢報告。 */
export function recordReport(prev: ReviewState, jobId: string, now: number) {
  const state: ReviewState = { ...prev, first: prev.first ?? now };
  const reports = state.reports ?? [];
  if (reports.length < REPORTS && !reports.includes(jobId)) {
    state.reports = [...reports, jobId];
    if (state.reports.length === REPORTS) state.pending = state.pending ?? 'report3';
  }
  return result(state, now);
}

/** 已經請 Apple 跳評分。 */
export function markAsked(prev: ReviewState, now: number): ReviewState {
  return { ...prev, asked: now, pending: undefined };
}
