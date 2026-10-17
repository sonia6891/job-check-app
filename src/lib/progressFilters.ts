import { isClosedProgress } from '@/src/components/ProgressDashboard';

export type ProgressView = 'all' | 'active' | 'interview' | 'offer' | 'ended';
export type ProgressRow = {
  id: string;
  status: string | null;
  notes?: string | null;
  job_posts?: { job_title?: string | null; display_company_name?: string | null } | null;
};

/** Search and stage filters operate on the already authenticated user's rows. */
export function filterProgressRows<T extends ProgressRow>(rows: readonly T[], query: string, view: ProgressView): T[] {
  const needle = query.normalize('NFKC').trim().toLocaleLowerCase();
  return rows.filter(row => {
    const status = row.status || 'saved';
    const stageMatches = view === 'all'
      || (view === 'active' && !isClosedProgress(status))
      || (view === 'interview' && (status === 'interview_1' || status === 'interview_2'))
      || (view === 'offer' && status === 'offer')
      || (view === 'ended' && isClosedProgress(status));
    if (!stageMatches) return false;
    if (!needle) return true;
    return [row.job_posts?.job_title, row.job_posts?.display_company_name, row.notes]
      .some(value => (value ?? '').normalize('NFKC').toLocaleLowerCase().includes(needle));
  });
}
