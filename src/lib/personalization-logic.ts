import { CATEGORY_LABELS, type Category } from "./categories.ts";

const MAX_PREFERRED_CATEGORIES = 5;

export class PersonalizationRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function calculateLearningStreak(completedDates: readonly string[], today: string) {
  const dates = new Set(completedDates);
  let cursor = dates.has(today) ? today : shiftDateKey(today, -1);
  let current = 0;

  while (dates.has(cursor)) {
    current += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  const sorted = [...dates].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of sorted) {
    run = previous && shiftDateKey(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  return { current, longest };
}

export function normalizePreferenceCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) {
    throw new PersonalizationRequestError("관심 분야 목록이 필요합니다.");
  }

  const categories = [...new Set(value.filter((item): item is string => typeof item === "string"))];
  if (categories.some((category) => !(category in CATEGORY_LABELS))) {
    throw new PersonalizationRequestError("지원하지 않는 관심 분야가 포함되어 있습니다.");
  }
  if (categories.length > MAX_PREFERRED_CATEGORIES) {
    throw new PersonalizationRequestError(`관심 분야는 ${MAX_PREFERRED_CATEGORIES}개까지 선택할 수 있습니다.`);
  }

  return categories as Category[];
}

export function shiftDateKey(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
