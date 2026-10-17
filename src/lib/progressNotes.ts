/** Compare the exact persisted note text; whitespace edits also count as changes. */
export function hasUnsavedProgressNote(draft: string, saved: string | null | undefined): boolean {
  return draft !== (saved ?? '');
}
