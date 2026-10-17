import type { JobReport } from '@/src/types';
import { checkMinimumWage, wageTypeLabels, type WageType } from '@/src/lib/minimumWage';
import type { CheckItem } from '@/src/lib/reportSummary';

/** 報告裡圖表要用的數字。只做換算與排版，不另外下判斷；判斷規則留在各自的檢查模組。 */

export type ToneCounts = { danger: number; caution: number; ok: number; other: number };

export function toneCounts(items: readonly CheckItem[]): ToneCounts {
  const counts: ToneCounts = { danger: 0, caution: 0, ok: 0, other: 0 };
  for (const item of items) {
    if (item.tone === 'danger' || item.tone === 'caution' || item.tone === 'ok') counts[item.tone] += 1;
    else counts.other += 1;
  }
  return counts;
}

export type ScaleMarker = { key: 'offer' | 'offerMax' | 'minimum' | 'benchmark'; value: number; label: string; at: number };
export type SalaryScale = { type: WageType; unit: string; offer: number; offerMax: number | null; markers: ScaleMarker[]; belowMinimum: boolean };

/**
 * 薪資刻度：職缺薪資、基本工資、官方行情平均放在同一條尺上。
 * 官方行情是月薪統計，只有月薪職缺才放；at 是 0–1 的位置。
 */
export function salaryScale(report: Pick<JobReport, 'salary'>, now: Date): SalaryScale | null {
  const offer = report.salary.job_offer;
  const wage = checkMinimumWage(offer, now);
  if (wage.status === 'unknown') return null;
  const max = typeof offer.max === 'number' && offer.max > wage.offered ? offer.max : null;
  const benchmarks = wage.type === 'monthly'
    ? report.salary.benchmarks.map(b => b.average_salary).filter(n => Number.isFinite(n) && n > 0)
    : [];
  const benchmark = benchmarks.length ? benchmarks.reduce((a, b) => a + b, 0) / benchmarks.length : null;

  const raw: Array<Omit<ScaleMarker, 'at'>> = [
    { key: 'offer', value: wage.offered, label: max ? '職缺下限' : '職缺' },
    ...(max ? [{ key: 'offerMax' as const, value: max, label: '職缺上限' }] : []),
    { key: 'minimum', value: wage.threshold, label: '基本工資' },
    ...(benchmark ? [{ key: 'benchmark' as const, value: Math.round(benchmark), label: '行情平均' }] : [])
  ];
  const values = raw.map(m => m.value);
  const lo = Math.min(...values) * 0.85;
  const hi = Math.max(...values) * 1.08;
  const markers = raw.map(m => ({ ...m, at: (m.value - lo) / (hi - lo) }));
  return {
    type: wage.type, unit: wageTypeLabels[wage.type], offer: wage.offered, offerMax: max,
    markers, belowMinimum: wage.status === 'below'
  };
}

const RANGE = /(\d{1,2})\s*[:：]\s*(\d{2})\s*(?:~|～|-|－|—|–|至|到)\s*(\d{1,2})\s*[:：]\s*(\d{2})/g;

export type ShiftBreakdown = { start: string; end: string; spanHours: number; normal: number; rest: number; extra: number };

/**
 * 一天的班表時間條：正常工時 8 小時、休息、可能的加班。
 * 只在職缺寫了「一個」時段時畫；分段班或多班別交給文字提醒。休息時間職缺通常沒寫，假設 1 小時。
 */
export function shiftBreakdown(text: string | null | undefined): ShiftBreakdown | null {
  if (!text) return null;
  const ranges = [...text.normalize('NFKC').matchAll(RANGE)];
  if (ranges.length !== 1) return null;
  const [, h1, m1, h2, m2] = ranges[0];
  const start = Number(h1) * 60 + Number(m1);
  const end = Number(h2) * 60 + Number(m2);
  if (Number(h1) > 24 || Number(h2) > 24 || Number(m1) > 59 || Number(m2) > 59 || start === end) return null;
  const minutes = end > start ? end - start : end + 24 * 60 - start;
  const spanHours = Math.round(minutes / 6) / 10;
  const normal = Math.min(8, spanHours);
  const rest = spanHours > 8 ? Math.min(1, spanHours - 8) : 0;
  const extra = Math.max(0, Math.round((spanHours - 9) * 10) / 10);
  const fmt = (h: string, m: string) => `${h.padStart(2, '0')}:${m}`;
  return { start: fmt(h1, m1), end: fmt(h2, m2), spanHours, normal, rest, extra };
}

/** 「月休 6 天」「做六休一」換成一個月大約休幾天，對照每 7 天休 2 天（約 8 天）。 */
export function monthlyDaysOff(source: string): { off: number; expected: number } | null {
  const t = source.normalize('NFKC');
  const monthly = t.match(/月休\s*(\d+)/);
  if (monthly) return { off: Number(monthly[1]), expected: 8 };
  if (/做六休一|上六休一|週休一日|周休一日|週休1日|周休1日|單休/.test(t)) return { off: 4, expected: 8 };
  return null;
}
