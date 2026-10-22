import type { JobReport } from '@/src/types';
import { isTentativeRecords, officialRecordState, recordStateLabel } from '@/src/lib/officialRecordState';
import { checkMinimumWage, wageTypeLabels } from '@/src/lib/minimumWage';
import { checkWorkHours } from '@/src/lib/workHours';

const riskTitles: Record<string, string> = {
  account_handover: '要求交出存摺、提款卡或帳戶',
  upfront_payment: '要求先付保證金、押金或訓練費',
  no_insurance: '可能沒有勞健保',
  wage_deduction: '有扣薪或違約金規定'
};

const money = (n: number) => `${Math.round(n).toLocaleString('zh-TW')} 元`;

/**
 * 給家人朋友看的純文字摘要。只放這份職缺的資訊與查核結果，不含帳號或其他個人資料。
 */
export function buildReportShareText(report: JobReport, now: Date, maxQuestions = 3): string {
  const lines: string[] = [];
  lines.push(`【職缺體檢】${report.job.title || '未命名職缺'}｜${report.job.display_company_name || '公司待確認'}`);

  const confirmed = report.company.match_status === 'confirmed';
  const tentative = isTentativeRecords(report);
  lines.push(`公司法人：${confirmed && report.company.legal_name ? `${report.company.legal_name}（已確認）`
    : tentative ? `可能是${report.company.legal_name}（尚未確認）` : '尚未確認是哪一家公司'}`);

  const state = officialRecordState(report);
  const records = state === 'found' || (state === 'partial' && report.official_records.total > 0)
    ? `${report.official_records.total} 筆${state === 'partial' ? '（部分資料未查到）' : ''}`
    : recordStateLabel[state];
  lines.push(`官方勞動紀錄：${records}${tentative ? '（依可能的公司查詢，尚未確認）' : ''}`);

  const offer = report.salary.job_offer;
  if (offer.raw) {
    const wage = checkMinimumWage(offer, now);
    lines.push(`薪資：${offer.raw}${wage.status === 'below' ? `（低於 ${wage.year} 年${wageTypeLabels[wage.type]}基本工資 ${money(wage.threshold)}）` : ''}`);
  } else {
    lines.push('薪資：職缺沒有寫明');
  }

  const risks = report.posting_risks ?? [];
  if (risks.length) {
    lines.push('', '注意：');
    for (const r of risks) lines.push(`・${riskTitles[r.kind] ?? r.kind}（原文：「${r.source}」）`);
  }

  const hours = report.labor_hints ?? checkWorkHours(report.job.work_hours);
  if (hours.length) {
    lines.push('', '工時：');
    for (const h of hours) {
      lines.push(h.kind === 'few_days_off'
        ? `・休假天數可能不足（原文：「${h.source}」）`
        : `・排班時段約 ${h.spanHours} 小時，${h.kind === 'over_daily_max' ? '可能超過每日 12 小時上限' : '可能有固定加班'}`);
    }
  }

  const questions = report.interview_questions.slice(0, maxQuestions);
  if (questions.length) {
    lines.push('', '面試建議先問：');
    questions.forEach((q, i) => lines.push(`${i + 1}. ${q.question}`));
  }

  lines.push('', '以上整理自職缺內容與政府公開資料，不代表對公司的評價或法律判斷。');
  return lines.join('\n');
}
