import type { JobReport } from '@/src/types';

export type RecordState = 'found' | 'none' | 'partial' | 'failed' | 'not_checked' | 'unlinked';

/**
 * 官方紀錄的顯示狀態，依 build-job-report 的 official_records.status：
 * checked → 查到紀錄／查無資料；partial → 部分資料集查詢失敗；failed → 查詢失敗；
 * not_checked → 法人已確認但還沒查。查無資料不代表沒有違規，失敗與未查詢都可以重新查詢。
 */
export function officialRecordState(report: Pick<JobReport, 'company' | 'official_records'>): RecordState {
  if (report.company.match_status !== 'confirmed') return 'unlinked';
  const status = report.official_records.status;
  if (status === 'failed') return 'failed';
  if (status === 'partial') return 'partial';
  if (status !== 'checked') return 'not_checked';
  return report.official_records.total > 0 ? 'found' : 'none';
}

export const recordStateLabel: Record<RecordState, string> = {
  found: '查到紀錄',
  none: '查無資料',
  partial: '部分未查到',
  failed: '查詢失敗',
  not_checked: '尚未查詢',
  unlinked: '未關聯'
};
