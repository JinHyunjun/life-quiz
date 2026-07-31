export function selectBalancedDailyCandidates<T extends { category: string }>(
  candidates: T[],
  usedCategories: ReadonlySet<string>,
  limit: number,
  preferredCategories: ReadonlySet<string> = new Set(),
) {
  const ordered = preferredCategories.size > 0
    ? candidates
      .map((candidate, index) => ({ candidate, index }))
      .sort((left, right) => (
        Number(preferredCategories.has(right.candidate.category))
        - Number(preferredCategories.has(left.candidate.category))
        || left.index - right.index
      ))
      .map(({ candidate }) => candidate)
    : candidates;
  const selected: T[] = [];
  const selectedSet = new Set<T>();
  const categories = new Set(usedCategories);

  for (const candidate of ordered) {
    if (selected.length >= limit) break;
    if (categories.has(candidate.category)) continue;
    selected.push(candidate);
    selectedSet.add(candidate);
    categories.add(candidate.category);
  }

  for (const candidate of ordered) {
    if (selected.length >= limit) break;
    if (selectedSet.has(candidate)) continue;
    selected.push(candidate);
  }

  return selected;
}
