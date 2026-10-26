import type { Tone } from '@/src/theme/tokens';
import type { JobReport } from '@/src/types';
import { isTentativeRecords, officialRecordState } from '@/src/lib/officialRecordState';

/** 報告頁首的風險燈號：只看口語結論的 tone，不打分數。 */
export function verdictLevel(tone: Tone): { tone: Tone; label: string } {
  if (tone === 'danger') return { tone, label: '高風險' };
  if (tone === 'caution') return { tone, label: '要注意' };
  return { tone: 'ok', label: '沒看到明顯問題' };
}

export type ReportBadge = { key: 'identity' | 'records'; tone: Tone; label: string; section: 'company' | 'records' };

/**
 * 報告第一屏的兩個重點：公司身分有沒有對到政府登記、勞動部違規紀錄查到什麼。
 * 這是和求職網站不一樣的地方，所以放在最上面，點了跳到下面的詳細區塊。
 * 查無資料不代表沒有違規，所以不用綠色。
 */
export function reportBadges(report: Pick<JobReport, 'company' | 'official_records'>): ReportBadge[] {
  const company = report.company;
  const identity: ReportBadge = company.match_status === 'confirmed' && company.legal_name
    ? { key: 'identity', tone: 'ok', label: `已對到政府登記：${company.legal_name}`, section: 'company' }
    : company.match_status === 'probable' && company.legal_name
      ? { key: 'identity', tone: 'caution', label: `可能是「${company.legal_name}」，點下面確認`, section: 'company' }
      : { key: 'identity', tone: 'neutral', label: '公司還沒對到政府登記', section: 'company' };

  const state = officialRecordState(report);
  const near = report.official_records.near_matches?.length ?? 0;
  const maybe = isTentativeRecords(report) ? '（待確認）' : '';
  const records: ReportBadge =
    state === 'found' ? { key: 'records', tone: 'danger', label: `勞動部違規紀錄 ${report.official_records.total} 筆${maybe}`, section: 'records' }
    : state === 'none' ? { key: 'records', tone: 'neutral', label: `勞動部公開資料查無違規${near ? `，另有 ${near} 筆名稱相近` : ''}`, section: 'records' }
    : state === 'partial' ? { key: 'records', tone: 'caution', label: '違規紀錄有部分沒查到', section: 'records' }
    : state === 'failed' ? { key: 'records', tone: 'caution', label: '違規紀錄這次查詢失敗', section: 'records' }
    : state === 'not_checked' ? { key: 'records', tone: 'neutral', label: '違規紀錄還沒查', section: 'records' }
    : { key: 'records', tone: 'neutral', label: '對到公司後才會查違規紀錄', section: 'records' };

  return [identity, records];
}
