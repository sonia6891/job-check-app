import type { JobReport } from '@/src/types';
import type { Tone } from '@/src/theme/tokens';
import { isTentativeRecords, officialRecordState } from '@/src/lib/officialRecordState';
import { checkMinimumWage, wageTypeLabels } from '@/src/lib/minimumWage';
import { checkWorkHours } from '@/src/lib/workHours';

export type CheckKey = 'risks' | 'company' | 'records' | 'salary' | 'hours' | 'conditions' | 'missing';
export type CheckItem = { key: CheckKey; tone: Tone; title: string; value: string; detail: string | null };

const money = (n: number) => `${Math.round(n).toLocaleString('zh-TW')} 元`;

/**
 * 報告最上面的查核摘要：每一項查核一列，依結果給語意狀態。
 * 規則跟細節區塊一致；「查無資料」是 ok 但文字一定寫查無資料，不說沒有違規。
 */
export function buildChecklist(report: JobReport, now: Date): CheckItem[] {
  const items: CheckItem[] = [];

  const risks = report.posting_risks;
  if (risks === undefined) {
    items.push({ key: 'risks', tone: 'neutral', title: '職缺內容警訊', value: '這份報告尚未檢查', detail: '重新體檢後會檢查詐騙特徵與可能違法的條件' });
  } else {
    const high = risks.filter(r => r.severity === 'high').length;
    const others = risks.length - high;
    items.push(high
      ? { key: 'risks', tone: 'danger', title: '職缺內容警訊', value: others ? `${high} 項詐騙特徵，另 ${others} 項要注意` : `${high} 項常見詐騙特徵`, detail: risks.map(r => `「${r.source}」`).join('、') }
      : risks.length
        ? { key: 'risks', tone: 'caution', title: '職缺內容警訊', value: `${risks.length} 項可能違法的條件`, detail: risks.map(r => `「${r.source}」`).join('、') }
        : { key: 'risks', tone: 'ok', title: '職缺內容警訊', value: '沒有發現警訊字眼', detail: null });
  }

  const company = report.company;
  items.push(company.match_status === 'confirmed'
    ? { key: 'company', tone: 'ok', title: '公司身分', value: company.legal_name ? `已確認：${company.legal_name}` : '已確認', detail: company.tax_id ? `統編 ${company.tax_id}` : null }
    : company.match_status === 'probable' && company.legal_name
      ? { key: 'company', tone: 'caution', title: '公司身分', value: `可能是：${company.legal_name}`, detail: '點一下確認是不是這家' }
      : { key: 'company', tone: 'caution', title: '公司身分', value: company.match_status === 'probable' ? '需要你確認是哪一家' : '還沒找到可確認的雇主', detail: '選定實際雇主後，才會查這家公司的官方紀錄' });

  const state = officialRecordState(report);
  const tentative = isTentativeRecords(report);
  const total = report.official_records.total;
  const latest = Object.values(report.official_records.summary_by_law ?? {})
    .map(v => v.latest_date).filter((d): d is string => !!d).sort().pop() ?? null;
  const recordItem: Record<typeof state, Omit<CheckItem, 'key' | 'title'>> = {
    found: { tone: 'caution', value: `查到 ${total} 筆違規紀錄`, detail: latest ? `最近一筆 ${latest}` : null },
    none: { tone: 'ok', value: '查無資料', detail: '公開資料裡沒有，不代表一定沒有違規' },
    partial: { tone: 'caution', value: total ? `${total} 筆，部分資料未查到` : '部分資料未查到', detail: '可以重新查詢' },
    failed: { tone: 'caution', value: '這次查詢失敗', detail: '不是查無資料，可以重新查詢' },
    not_checked: { tone: 'neutral', value: '尚未查詢', detail: null },
    unlinked: { tone: 'neutral', value: '公司確認後才會查', detail: null }
  };
  const record = recordItem[state];
  items.push({ key: 'records', title: '官方勞動紀錄', ...record,
    ...(tentative && state !== 'not_checked'
      ? { detail: ['依「可能是」的公司查詢，確認公司後才算數', record.detail].filter(Boolean).join('；') }
      : {}) });

  const offer = report.salary.job_offer;
  const wage = checkMinimumWage(offer, now);
  if (wage.status === 'below') {
    items.push({ key: 'salary', tone: 'caution', title: '薪資', value: `${wageTypeLabels[wage.type]}低於基本工資`, detail: `${offer.raw ?? money(wage.offered)}，基本工資 ${money(wage.threshold)}` });
  } else if (!offer.raw && offer.min == null) {
    items.push({ key: 'salary', tone: 'neutral', title: '薪資', value: '職缺沒寫薪資', detail: '面試時要問清楚' });
  } else {
    const n = report.salary.benchmarks.length;
    items.push({ key: 'salary', tone: 'info', title: '薪資', value: offer.raw ?? money(offer.min ?? 0), detail: n ? `有 ${n} 筆官方薪資行情可參考` : '沒有夠接近的官方薪資行情' });
  }

  const hours = report.labor_hints ?? checkWorkHours(report.job.work_hours);
  items.push(hours.length
    ? { key: 'hours', tone: 'caution', title: '工時與休假', value: `${hours.length} 項要確認`,
        detail: hours.map(h => h.kind === 'few_days_off' ? `「${h.source}」` : `在班約 ${h.spanHours} 小時`).join('、') }
    : report.job.work_hours
      ? { key: 'hours', tone: 'ok', title: '工時與休假', value: '沒有發現工時問題', detail: report.job.work_hours }
      : { key: 'hours', tone: 'neutral', title: '工時與休假', value: '職缺沒寫上班時間', detail: null });

  const conditions = (report.conditions_to_confirm ?? []).filter(c => c.question || c.source_text);
  if (conditions.length) {
    items.push({ key: 'conditions', tone: 'caution', title: '待確認的條件', value: `${conditions.length} 項`, detail: conditions.map(c => c.source_text).filter(Boolean).slice(0, 3).map(s => `「${s}」`).join('、') || null });
  }
  const missing = report.missing_information ?? [];
  if (missing.length) {
    items.push({ key: 'missing', tone: 'neutral', title: '職缺沒寫清楚', value: `${missing.length} 項資訊`, detail: missing.map(missingLabel).join('、') });
  }
  return items;
}

const missingLabels: Record<string, string> = {
  salary: '薪資', work_hours: '上班時間', location: '工作地點', company_name: '公司名稱', job_title: '職稱'
};
export function missingLabel(key: string): string {
  return missingLabels[key] ?? key;
}

/** 頁首一句話：只數紅、橘兩種，不打分數。 */
export function headline(items: readonly CheckItem[]): { tone: Tone; text: string } {
  const danger = items.filter(i => i.tone === 'danger').length;
  const caution = items.filter(i => i.tone === 'caution').length;
  if (danger) return { tone: 'danger', text: `有高風險警訊，另有 ${caution} 項要注意` };
  if (caution) return { tone: 'caution', text: `${caution} 項要注意` };
  return { tone: 'ok', text: '沒有發現明顯問題' };
}

export type FriendlyVerdict = { mines: number; questions: number; tone: Tone; text: string };

/**
 * 報告頁首的口語結論（溫暖友善版）：「地雷」是職缺內容裡的高風險警訊（例如要先付錢），
 * 「要先問清楚」是其他要注意的查核項目。仍然不打分數。
 */
export function friendlyVerdict(items: readonly CheckItem[], risks: ReadonlyArray<{ severity: 'high' | 'caution' }> = []): FriendlyVerdict {
  const mines = risks.filter(r => r.severity === 'high').length;
  // 有地雷時，職缺警訊那一列算在地雷裡；同一列裡「注意」等級的警訊另外算成要問清楚的事。
  const questions = items.filter(i => i.tone === 'caution').length + (mines ? risks.length - mines : 0);
  if (mines && questions) return { mines, questions, tone: 'danger', text: `這份工作有 ${mines} 個地雷，\n${questions} 件事要先問清楚` };
  if (mines) return { mines, questions, tone: 'danger', text: `這份工作有 ${mines} 個地雷` };
  if (questions) return { mines, questions, tone: 'caution', text: `這份工作有 ${questions} 件事\n要先問清楚` };
  return { mines, questions, tone: 'ok', text: '目前沒看到明顯的地雷' };
}
