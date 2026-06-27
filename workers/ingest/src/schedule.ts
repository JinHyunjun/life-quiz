import { glossaryTopicsForKstDay } from "./glossary.ts";

export type ScheduledTriviaCategory = "history" | "humor" | "social_skills" | "daily_tips";

const TRIVIA_JOBS: readonly { category: ScheduledTriviaCategory; label: string }[] = [
  { category: "history", label: "AI가 정리한 역사 상식" },
  { category: "humor", label: "AI가 정리한 유머 상식" },
  { category: "social_skills", label: "AI가 정리한 사회성·매너 상식" },
  { category: "daily_tips", label: "AI가 정리한 생활 꿀팁" },
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
    trivia: TRIVIA_JOBS[slot],
  };
}

export function normalizeIngestionIntervalMs(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 5_000), 30_000) : 8_000;
}

export function ingestionPacingDelayMs(lastStartedAtMs: number, intervalMs: number, nowMs = Date.now()) {
  if (lastStartedAtMs <= 0) return 0;
  return Math.max(0, normalizeIngestionIntervalMs(intervalMs) - (nowMs - lastStartedAtMs));
}
