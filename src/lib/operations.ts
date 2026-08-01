export const DEFAULT_GEMINI_DAILY_BUDGET = 400;

export type OperationsStatus = "pass" | "warning" | "fail";
export type CollectorFamily = "rss" | "youtube" | "public_data" | "curriculum" | "other";

export interface CollectorDiagnosticLike {
  source: string;
  status: "success" | "empty" | "error";
  candidateCount: number;
}

export function normalizeGeminiDailyBudget(value: number) {
  return Number.isFinite(value)
    ? Math.min(Math.max(Math.trunc(value), 20), 5_000)
    : DEFAULT_GEMINI_DAILY_BUDGET;
}

export function kstDayWindowMs(now = new Date()) {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1_000);
  const start = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
    - 9 * 60 * 60 * 1_000;
  return { start, end: start + 24 * 60 * 60 * 1_000 };
}

export function geminiBudgetStatus(used: number, budgetValue: number) {
  const budget = normalizeGeminiDailyBudget(budgetValue);
  const safeUsed = Math.max(0, Math.trunc(used));
  const percentage = Math.min(100, Math.round((safeUsed / budget) * 100));
  const status: OperationsStatus = percentage >= 85
    ? "fail"
    : percentage >= 70
      ? "warning"
      : "pass";
  return { used: safeUsed, budget, remaining: Math.max(0, budget - safeUsed), percentage, status };
}

export function summarizeCollectorHealth(
  runs: ReadonlyArray<{ collectorDiagnostics?: readonly CollectorDiagnosticLike[] | null }>,
) {
  const families: CollectorFamily[] = ["rss", "youtube", "public_data", "curriculum", "other"];
  const summaries = new Map(families.map((family) => [family, {
    family,
    checks: 0,
    candidates: 0,
    success: 0,
    empty: 0,
    error: 0,
  }]));

  for (const run of runs) {
    for (const diagnostic of run.collectorDiagnostics ?? []) {
      const summary = summaries.get(collectorFamily(diagnostic.source));
      if (!summary) continue;
      summary.checks += 1;
      summary.candidates += Math.max(0, diagnostic.candidateCount);
      summary[diagnostic.status] += 1;
    }
  }

  return families
    .map((family) => summaries.get(family)!)
    .filter(({ checks }) => checks > 0)
    .map((summary) => {
      const errorRate = Math.round((summary.error / summary.checks) * 100);
      const status: OperationsStatus = errorRate >= 20
        ? "fail"
        : errorRate > 0 || summary.empty > 0
          ? "warning"
          : "pass";
      return { ...summary, errorRate, status };
    });
}

function collectorFamily(source: string): CollectorFamily {
  if (source.startsWith("rss:")) return "rss";
  if (source.startsWith("youtube:")) return "youtube";
  if (source.startsWith("gov:")) return "public_data";
  if (source.startsWith("curriculum:")) return "curriculum";
  return "other";
}
