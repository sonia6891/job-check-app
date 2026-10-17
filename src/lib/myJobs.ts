/**
 * 「我的職缺」把體檢紀錄、收藏與求職進度合在一個清單。
 * 每份職缺最多對應一列 saved_jobs（收藏與進度共用），沒有那一列就是「未追蹤」。
 */
export type TrackRow = { job_post_id: string; status: string | null; favorite: boolean | null; updated_at?: string | null };
export type MyJobView = 'all' | 'tracking' | 'favorite' | 'ended';

const CLOSED = new Set(['accepted', 'rejected', 'withdrawn']);

export function attachTracking<J extends { id: string }>(jobs: readonly J[], rows: readonly TrackRow[]): Array<J & { track: TrackRow | null }> {
  const byJob = new Map(rows.map(r => [r.job_post_id, r]));
  return jobs.map(job => ({ ...job, track: byJob.get(job.id) ?? null }));
}

export function isEnded(track: TrackRow | null): boolean {
  return !!track && CLOSED.has(track.status ?? '');
}

export function matchesView(track: TrackRow | null, view: MyJobView): boolean {
  if (view === 'all') return true;
  if (view === 'favorite') return track?.favorite === true;
  if (view === 'ended') return isEnded(track);
  return !!track && !isEnded(track);
}

export function viewCounts(tracks: ReadonlyArray<TrackRow | null>): Record<MyJobView, number> {
  const views: MyJobView[] = ['all', 'tracking', 'favorite', 'ended'];
  return Object.fromEntries(views.map(v => [v, tracks.filter(t => matchesView(t, v)).length])) as Record<MyJobView, number>;
}

/** 「今天」「昨天」「3 天前」，一週以上顯示月/日。 */
export function relativeDay(iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / 86400000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  return `${then.getMonth() + 1}/${then.getDate()}`;
}
