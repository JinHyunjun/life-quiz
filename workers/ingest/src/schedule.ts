import { glossaryTopicsForKstDay } from "./glossary.ts";
import { triviaSourceForKstDay } from "./trivia-sources.ts";

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
  const glossaryTopics = glossaryTopicsForKstDay(now);
  const triviaOffset = slot * 2;

  return {
    // Keep each Worker invocation comfortably below the free-plan external
    // subrequest limit while still covering the full curriculum every day.
    glossary: glossaryTopics[slot] ? [glossaryTopics[slot]] : [],
    trivia: TRIVIA_CATEGORIES.slice(triviaOffset, triviaOffset + 2).map((category) =>
      triviaSourceForKstDay(category, now),
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
