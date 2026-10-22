import type { JobReport } from '@/src/types';
import type { Tone } from '@/src/theme/tokens';
import { checkMinimumWage, wageTypeLabels } from '@/src/lib/minimumWage';
import { checkWorkHours } from '@/src/lib/workHours';
import { monthlyDaysOff } from '@/src/lib/reportVisuals';
import { isTentativeRecords, officialRecordState } from '@/src/lib/officialRecordState';

export type ShareCardItem = { tone: Tone; icon: 'warning' | 'cash' | 'calendar' | 'time' | 'business' | 'shield' | 'checkmark-circle'; text: string };

const riskLines: Record<string, string> = {
  account_handover: '要你交出帳戶（常見詐騙手法）',
  upfront_payment: '要先付錢（常見詐騙手法）',
  no_insurance: '可能沒有勞健保',
  wage_deduction: '有扣薪或違約金規定'
};

const money = (n: number) => Math.round(n).toLocaleString('zh-TW');

/**
 * 分享圖片卡上的重點（最多 3 條），依嚴重程度排：詐騙特徵 → 薪資 → 休假與工時 → 其他。
 * 只放這份職缺的事實，不含帳號或個人資料；沒有問題時只放一條「目前沒看到明顯的地雷」。
 */
export function buildShareCardItems(report: JobReport, now: Date, max = 3): ShareCardItem[] {
  const items: ShareCardItem[] = [];
  const risks = report.posting_risks ?? [];
  for (const r of risks.filter(r => r.severity === 'high')) items.push({ tone: 'danger', icon: 'warning', text: riskLines[r.kind] ?? '職缺內容有詐騙特徵' });

  const wage = checkMinimumWage(report.salary.job_offer, now);
  if (wage.status === 'below') items.push({ tone: 'caution', icon: 'cash', text: `${wageTypeLabels[wage.type]}比基本工資少 ${money(wage.threshold - wage.offered)} 元` });

  const hints = report.labor_hints ?? checkWorkHours(report.job.work_hours);
  for (const h of hints) {
    if (h.kind === 'few_days_off') {
      const d = monthlyDaysOff(h.source);
      items.push({ tone: 'caution', icon: 'calendar', text: d && d.expected > d.off ? `${h.source}，比法定少 ${d.expected - d.off} 天` : `${h.source}，休假可能不夠` });
    } else {
      items.push({ tone: 'caution', icon: 'time', text: `一天在公司約 ${h.spanHours} 小時` });
    }
  }

  for (const r of risks.filter(r => r.severity !== 'high')) items.push({ tone: 'caution', icon: 'warning', text: riskLines[r.kind] ?? '有條件要問清楚' });

  const state = officialRecordState(report);
  if ((state === 'found' || state === 'partial') && report.official_records.total > 0) {
    items.push({ tone: 'caution', icon: 'shield', text: isTentativeRecords(report)
      ? `可能的公司查到 ${report.official_records.total} 筆違規紀錄`
      : `公開資料查到 ${report.official_records.total} 筆違規紀錄` });
  }
  if (report.company.match_status !== 'confirmed') items.push({ tone: 'neutral', icon: 'business', text: '還沒確認是哪一家公司' });

  if (!items.length) return [{ tone: 'ok', icon: 'checkmark-circle', text: '目前沒看到明顯的地雷' }];
  return items.slice(0, max);
}
