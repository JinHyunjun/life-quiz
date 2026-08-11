import { GLOSSARY_CATEGORIES, glossaryTopicCandidatesForKstDay, glossaryTopicsForKstDay } from "./glossary.ts";
import { officialGuideCandidatesForKstDay } from "./official-guides.ts";
import { triviaSourceCandidatesForKstDay, triviaSourceForKstDay } from "./trivia-sources.ts";

export type ScheduledTriviaCategory =
  | "history"
  | "humor"
  | "social_skills"
  | "daily_tips"
  | "career"
  | "rights"
  | "digital_safety"
  | "health";

export const TRIVIA_CATEGORIES: readonly ScheduledTriviaCategory[] = [
  "history",
  "humor",
  "social_skills",
  "daily_tips",
  "career",
  "rights",
  "digital_safety",
  "health",
];

export function kstSixHourSlot(now = new Date()) {
  const kstHour = new Date(now.getTime() + 9 * 60 * 60 * 1_000).getUTCHours();
  return Math.floor(kstHour / 6);
}

export function apartmentBriefKindForKstRun(now = new Date()): "rent" | "sale" {
  return kstSixHourSlot(now) % 2 === 0 ? "rent" : "sale";
}

export function scheduledAiCurriculumForKstRun(now = new Date()) {
  const slot = kstSixHourSlot(now);
  const glossaryTopics = glossaryTopicsForKstDay(now);
  return {
    // Three glossary subjects are spread over the first three daily runs instead of
    // consuming three Gemini requests in a single minute. The fourth run has no glossary.
    glossary: glossaryTopics[slot] ?? null,
    trivia: triviaSourceForKstDay(TRIVIA_CATEGORIES[slot], now),
  };
}

export function scheduledAiCurriculumBatchForKstRun(now = new Date()) {
  const slot = kstSixHourSlot(now);
  const unlockedGlossaryCategories = GLOSSARY_CATEGORIES.slice(0, Math.min(slot + 1, GLOSSARY_CATEGORIES.length));
  const unlockedTriviaCategories = TRIVIA_CATEGORIES.slice(0, (slot + 1) * 2);

  return {
    // Earlier categories return on later runs. Each has look-ahead candidates so
    // an already-published term can advance without waiting for another day.
    glossary: unlockedGlossaryCategories.flatMap((category) =>
      glossaryTopicCandidatesForKstDay(category, now, 3),
    ),
    // Two candidates per category let source retrieval failures fall through to
    // another verified topic. The ingestion loop stops after the daily minimum.
    trivia: unlockedTriviaCategories.flatMap((category) =>
      triviaSourceCandidatesForKstDay(category, now, 2),
    ),
    officialGuides: (["seoul_life", "rights", "digital_safety", "health"] as const).flatMap((category) =>
      officialGuideCandidatesForKstDay(category, now, 2),
    ),
  };
}

export function normalizeIngestionIntervalMs(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 5_000), 30_000) : 8_000;
}

export function ingestionPacingDelayMs(lastStartedAtMs: number, intervalMs: number, nowMs = Date.now()) {
  if (lastStartedAtMs <= 0) return 0;
  return Math.max(0, normalizeIngestionIntervalMs(intervalMs) - (nowMs - lastStartedAtMs));
}

export function hasIngestionAttemptBudget(attemptedCount: number, maxItems: number) {
  return attemptedCount < maxItems;
}
