export function selectBalancedDailyCandidates<T extends { category: string }>(
  candidates: T[],
  usedCategories: ReadonlySet<string>,
  limit: number,
) {
  const selected: T[] = [];
  const selectedSet = new Set<T>();
  const categories = new Set(usedCategories);

  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (categories.has(candidate.category)) continue;
    selected.push(candidate);
    selectedSet.add(candidate);
    categories.add(candidate.category);
  }

  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (selectedSet.has(candidate)) continue;
    selected.push(candidate);
  }

  return selected;
}
