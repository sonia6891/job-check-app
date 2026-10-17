/** Pick at most five actual, accessible bookmarks, preserving saved order. */
export function chooseSavedForComparison(
  savedIds: readonly string[],
  availableIds: readonly string[],
  limit = 5
): string[] {
  const available = new Set(availableIds);
  const selected = new Set<string>();
  for (const id of savedIds) {
    if (!id || !available.has(id) || selected.has(id)) continue;
    selected.add(id);
    if (selected.size >= Math.max(1, Math.min(5, limit))) break;
  }
  return [...selected];
}
