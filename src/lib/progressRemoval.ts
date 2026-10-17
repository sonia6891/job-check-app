/**
 * A bookmark and a job-application timeline share a saved_jobs row.
 * Removing application progress must never erase an existing bookmark.
 */
export type ProgressRemoval = 'reset_to_bookmark' | 'delete_unbookmarked_row';
export function planProgressRemoval(favorite: boolean): ProgressRemoval {
  return favorite ? 'reset_to_bookmark' : 'delete_unbookmarked_row';
}
export function resetProgressFields(now: string): { status: 'saved'; notes: null; updated_at: string } {
  if (!Number.isFinite(Date.parse(now))) throw new Error('invalid_timestamp');
  return { status: 'saved', notes: null, updated_at: now };
}
