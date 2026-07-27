import type { Category } from "./categories";

export interface DailyPublishingTarget {
  minimum: number;
  maximum: number;
}

export const DAILY_PUBLISHING_TARGETS: Record<Category, DailyPublishingTarget> = {
  finance: { minimum: 1, maximum: 4 },
  investment: { minimum: 1, maximum: 4 },
  housing: { minimum: 1, maximum: 6 },
  seoul_life: { minimum: 1, maximum: 4 },
  career: { minimum: 1, maximum: 3 },
  rights: { minimum: 1, maximum: 3 },
  digital_safety: { minimum: 1, maximum: 3 },
  health: { minimum: 1, maximum: 3 },
  daily_tips: { minimum: 1, maximum: 3 },
  history: { minimum: 1, maximum: 2 },
  humor: { minimum: 1, maximum: 2 },
  social_skills: { minimum: 1, maximum: 3 },
};

export type DailyPublishingCounts = Partial<Record<Category, number>>;

export function prioritizeByDailyPublishingTargets<T extends { category: Category }>(
  items: readonly T[],
  counts: DailyPublishingCounts,
) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftTarget = DAILY_PUBLISHING_TARGETS[left.item.category];
      const rightTarget = DAILY_PUBLISHING_TARGETS[right.item.category];
      const leftCount = counts[left.item.category] ?? 0;
      const rightCount = counts[right.item.category] ?? 0;
      const leftDeficit = Math.max(0, leftTarget.minimum - leftCount);
      const rightDeficit = Math.max(0, rightTarget.minimum - rightCount);

      if (leftDeficit !== rightDeficit) return rightDeficit - leftDeficit;

      const leftFill = leftCount / leftTarget.maximum;
      const rightFill = rightCount / rightTarget.maximum;
      if (leftFill !== rightFill) return leftFill - rightFill;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

export function hasDailyPublishingCapacity(category: Category, counts: DailyPublishingCounts) {
  return (counts[category] ?? 0) < DAILY_PUBLISHING_TARGETS[category].maximum;
}
