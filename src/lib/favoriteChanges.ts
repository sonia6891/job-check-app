/** Only the bookmark flag changes; never overwrite the application status or notes. */
export function favoriteUpdate(nextFavorite: boolean, now: string): { favorite: boolean; updated_at: string } {
  if (!Number.isFinite(Date.parse(now))) throw new Error('invalid_timestamp');
  return { favorite: nextFavorite, updated_at: now };
}
