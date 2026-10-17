import type { CompareJob } from '@/src/components/JobCompareResultCard';

export type CompareResponse = { jobs: unknown[]; note?: string };

/** Reject malformed or unrelated server results rather than rendering misleading cards. */
export function validateCompareResults(response: unknown, selected: readonly string[]): CompareJob[] {
  if (!response || typeof response !== 'object' || !Array.isArray((response as CompareResponse).jobs)) {
    throw new Error('比較結果格式不正確，請稍後重試。');
  }
  const jobs = (response as CompareResponse).jobs;
  const expected = new Set(selected);
  if (selected.length < 2 || selected.length > 5 || expected.size !== selected.length || jobs.length !== expected.size) {
    throw new Error('比較結果數量不一致，請重新比較。');
  }
  const received = new Set<string>();
  for (const job of jobs) {
    if (!job || typeof job !== 'object') throw new Error('比較結果缺少職缺資料。');
    const item = job as Record<string, unknown>;
    if (typeof item.job_post_id !== 'string' || !expected.has(item.job_post_id) || received.has(item.job_post_id)) {
      throw new Error('比較結果包含不符的職缺，請重新比較。');
    }
    if (typeof item.company_match_status !== 'string' || typeof item.official_records_count !== 'number'
      || typeof item.official_records_checked !== 'boolean') {
      throw new Error('比較結果欄位不完整，請重新比較。');
    }
    received.add(item.job_post_id);
  }
  return jobs as CompareJob[];
}
