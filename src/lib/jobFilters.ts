import type { JobCardData } from '@/src/components/JobCard';

export type JobSort = 'newest' | 'oldest' | 'company';
export type JobFilter = 'all' | 'saved';

/** Pure filter for the local, already authorized job list. No fabricated ratings. */
export function filterAndSortJobs<T extends JobCardData & { created_at?: string | null }>(
  jobs: T[], query: string, filter: JobFilter, savedIds: readonly string[], sort: JobSort
): T[] {
  const search = query.normalize('NFKC').trim().toLocaleLowerCase();
  const saved = new Set(savedIds);
  const filtered = jobs.filter(job => {
    if (filter === 'saved' && !saved.has(job.id)) return false;
    if (!search) return true;
    return [job.job_title, job.display_company_name, job.salary_raw, job.location_raw]
      .some(value => (value ?? '').normalize('NFKC').toLocaleLowerCase().includes(search));
  });
  return [...filtered].sort((a, b) => {
    if (sort === 'company') {
      return (a.display_company_name || '').localeCompare(b.display_company_name || '', 'zh-Hant')
        || (a.job_title || '').localeCompare(b.job_title || '', 'zh-Hant');
    }
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    const va = Number.isFinite(ta) ? ta : 0;
    const vb = Number.isFinite(tb) ? tb : 0;
    return sort === 'oldest' ? va - vb : vb - va;
  });
}
