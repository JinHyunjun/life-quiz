export const CATEGORY_LABELS = {
  finance: "금융",
  housing: "부동산",
  seoul_life: "서울살이",
  daily_tips: "생활상식",
  history: "역사",
  humor: "유머 상식",
  social_skills: "사회성·매너",
} as const;

export type Category = keyof typeof CATEGORY_LABELS;

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as Category] ?? category;
}
