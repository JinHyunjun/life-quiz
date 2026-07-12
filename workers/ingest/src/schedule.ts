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
  return {
    glossary: rotateBySlot(glossaryTopicsForKstDay(now), slot),
    trivia: rotateBySlot(TRIVIA_CATEGORIES, slot).map((category) => triviaSourceForKstDay(category, now)),
  };
}

export function normalizeIngestionIntervalMs(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 5_000), 30_000) : 8_000;
}

export function ingestionPacingDelayMs(lastStartedAtMs: number, intervalMs: number, nowMs = Date.now()) {
  if (lastStartedAtMs <= 0) return 0;
  return Math.max(0, normalizeIngestionIntervalMs(intervalMs) - (nowMs - lastStartedAtMs));
}

function rotateBySlot<T>(items: readonly T[], slot: number): T[] {
  if (items.length === 0) return [];
  return items.map((_, index) => items[(slot + index) % items.length]);
}
