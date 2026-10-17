/**
 * 基本工資比對。只能提醒「低於基本工資」，不做法律判斷：
 * 職缺可能是部分工時、含獎金或未寫清楚計薪方式，都要向雇主確認。
 *
 * 費率每年由勞動部公告，需要每年更新下表。日期晚於表內最新年度時，
 * 只會判斷「低於」（基本工資至今只升不降），不會說「符合」。
 */
export type WageType = 'monthly' | 'hourly' | 'daily' | 'annual';
export type MinimumWageRate = { year: number; monthly: number; hourly: number };

export const MINIMUM_WAGE_RATES: readonly MinimumWageRate[] = [
  { year: 2025, monthly: 28590, hourly: 190 },
  { year: 2026, monthly: 29500, hourly: 196 }
];
export const MINIMUM_WAGE_SOURCE_URL = 'https://www.mol.gov.tw/';

export const wageTypeLabels: Record<WageType, string> = {
  monthly: '月薪', hourly: '時薪', daily: '日薪', annual: '年薪'
};

/** 依台灣時間的年份挑費率；早於表內最早年度回傳 null。 */
export function minimumWageFor(date: Date): { rate: MinimumWageRate; stale: boolean } | null {
  const year = new Date(date.getTime() + 8 * 60 * 60 * 1000).getUTCFullYear();
  const known = MINIMUM_WAGE_RATES.filter(r => r.year <= year);
  if (!known.length) return null;
  const rate = known[known.length - 1];
  return { rate, stale: rate.year < year };
}

/** 日薪以 8 小時計；年薪以 12 個月計（年薪若含年終仍低於此數，必定低於基本工資）。 */
export function thresholdFor(type: WageType, rate: MinimumWageRate): number {
  if (type === 'monthly') return rate.monthly;
  if (type === 'hourly') return rate.hourly;
  if (type === 'daily') return rate.hourly * 8;
  return rate.monthly * 12;
}

const typeWords: Array<[WageType, RegExp]> = [
  ['hourly', /時薪|每小時/],
  ['daily', /日薪|每日/],
  ['annual', /年薪/],
  ['monthly', /月薪|月給|每月|薪資|待遇/]
];

function toAmount(num: string, unit: string | undefined): number | null {
  const n = Number(num.replace(/[,，\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === '萬' ? Math.round(n * 10000) : n;
}

// 低於這些金額的數字通常不是薪資（例如「年薪 14 個月」的 14），略過不用。
const plausibleFloor: Record<WageType, number> = { hourly: 50, daily: 300, monthly: 5000, annual: 60000 };

/** 從薪資原文抓計薪方式與最低金額，例如「月薪 3.2萬～3.6萬」「時薪196元」。抓不到回傳 null。 */
export function parseSalaryText(raw: string | null | undefined): { type: WageType; min: number } | null {
  if (!raw) return null;
  const text = raw.normalize('NFKC');
  const type = typeWords.find(([, re]) => re.test(text))?.[0];
  if (!type) return null;
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(萬)?/g)) {
    const amount = toAmount(m[1], m[2]);
    if (amount !== null && amount >= plausibleFloor[type]) return { type, min: amount };
  }
  return null;
}

export type MinimumWageCheck =
  | { status: 'below'; type: WageType; offered: number; threshold: number; year: number; stale: boolean }
  | { status: 'meets'; type: WageType; offered: number; threshold: number; year: number }
  | { status: 'unknown' };

/**
 * offer 用報告裡的 job_offer：優先用解析出的最低金額，沒有就從原文抓。
 */
export function checkMinimumWage(
  offer: { raw?: string | null; min?: number | null; max?: number | null; type?: string | null },
  date: Date
): MinimumWageCheck {
  const found = minimumWageFor(date);
  if (!found) return { status: 'unknown' };
  let type = offer.type as WageType | undefined;
  let offered = typeof offer.min === 'number' ? offer.min : typeof offer.max === 'number' ? offer.max : null;
  if (!type || !(type in wageTypeLabels) || offered === null) {
    const parsed = parseSalaryText(offer.raw);
    if (!parsed) return { status: 'unknown' };
    type = parsed.type;
    offered = parsed.min;
  }
  const threshold = thresholdFor(type, found.rate);
  if (offered < threshold) {
    return { status: 'below', type, offered, threshold, year: found.rate.year, stale: found.stale };
  }
  if (found.stale) return { status: 'unknown' };
  return { status: 'meets', type, offered, threshold, year: found.rate.year };
}
