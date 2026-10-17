/**
 * 依職缺寫的上班時段與休假方式提醒可能的加班或休假不足。
 * 職缺通常沒寫休息時間與是否採變形工時，所以只說「可能」，不下違法結論。
 *
 * 勞動基準法：每日正常工時 8 小時、每週 40 小時（第 30 條）；
 * 含加班每日不得超過 12 小時（第 32 條）；連續工作 4 小時至少休息 30 分鐘（第 35 條）；
 * 每 7 日應有 2 日休息（例假與休息日，第 36 條）。
 */
export type WorkHoursHint =
  | { kind: 'long_shift'; spanHours: number }
  | { kind: 'over_daily_max'; spanHours: number }
  | { kind: 'few_days_off'; source: string };

const RANGE = /(\d{1,2})\s*[:：]\s*(\d{2})\s*(?:~|～|-|－|—|–|至|到)\s*(\d{1,2})\s*[:：]\s*(\d{2})/g;
const SHIFT_WORDS = /早班|中班|晚班|夜班|大夜|小夜|輪班|排班|\/|／|或/;

function minutes(h: string, m: string): number | null {
  const hh = Number(h), mm = Number(m);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh > 24 || mm > 59) return null;
  return hh * 60 + mm;
}

/** 每段時段的分鐘數；跨夜（22:00–06:00）會加一天。 */
export function shiftSpans(text: string): number[] {
  const spans: number[] = [];
  for (const m of text.normalize('NFKC').matchAll(RANGE)) {
    const start = minutes(m[1], m[2]);
    const end = minutes(m[3], m[4]);
    if (start === null || end === null || start === end) continue;
    spans.push(end > start ? end - start : end + 24 * 60 - start);
  }
  return spans;
}

/**
 * 一天在班的時數（含休息）。多個時段時：有班別字樣視為擇一（取最長），
 * 否則視為同一天的分段班（例如 10:00–14:00、17:00–21:00）加總。
 */
export function dailySpanHours(text: string): number | null {
  const spans = shiftSpans(text);
  if (!spans.length) return null;
  const total = spans.length > 1 && !SHIFT_WORDS.test(text)
    ? spans.reduce((a, b) => a + b, 0)
    : Math.max(...spans);
  return Math.round(total / 6) / 10;
}

function fewDaysOff(text: string): string | null {
  const t = text.normalize('NFKC');
  const monthly = t.match(/月休\s*(\d+)\s*(?:天|日)/);
  if (monthly && Number(monthly[1]) < 8) return monthly[0];
  const weekly = t.match(/做六休一|上六休一|週休一日|周休一日|週休1日|周休1日|單休/);
  return weekly ? weekly[0] : null;
}

/** work_hours_raw 與職缺原文都可以丟進來，回傳需要提醒的項目。 */
export function checkWorkHours(...texts: Array<string | null | undefined>): WorkHoursHint[] {
  const hints: WorkHoursHint[] = [];
  const hoursText = texts.find(t => t && shiftSpans(t).length) ?? null;
  const span = hoursText ? dailySpanHours(hoursText) : null;
  // 12 小時含加班上限，再加最少 30 分鐘休息。
  if (span !== null && span > 12.5) hints.push({ kind: 'over_daily_max', spanHours: span });
  // 8 小時正常工時，再加常見的 1 小時休息。
  else if (span !== null && span > 9) hints.push({ kind: 'long_shift', spanHours: span });

  for (const t of texts) {
    const source = t ? fewDaysOff(t) : null;
    if (source) { hints.push({ kind: 'few_days_off', source }); break; }
  }
  return hints;
}
