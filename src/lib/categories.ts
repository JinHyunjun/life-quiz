export const CATEGORY_LABELS = {
  finance: "금융",
  housing: "부동산",
  seoul_life: "서울살이",
  daily_tips: "생활상식",
} as const;

export type Category = keyof typeof CATEGORY_LABELS;

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as Category] ?? category;
}
