import { CATEGORY_LABELS, type Category } from "./categories.ts";

export function mergePreferenceCategories(
  anonymousCategories: readonly Category[],
  accountCategories: readonly Category[],
) {
  return [...new Set([...anonymousCategories, ...accountCategories])]
    .filter((category): category is Category => category in CATEGORY_LABELS)
    .slice(0, 5);
}
