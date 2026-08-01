import {
  kstDayWindowMs,
  normalizeGeminiDailyBudget,
} from "../../../src/lib/operations.ts";

export type GeminiRequestPurpose = "ingestion" | "chat";

const WINDOW_MS = 60_000;
const DEFAULT_RPM_BUDGET = 12;

export class GeminiRateLimitError extends Error {
  readonly retryAfterSeconds: number;
  readonly limitKind: "rpm" | "daily";

  constructor(retryAfterSeconds: number, limitKind: "rpm" | "daily" = "rpm") {
    super("Gemini request budget is exhausted");
    this.name = "GeminiRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.limitKind = limitKind;
  }
}

export function normalizeGeminiRpmBudget(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 1), 14) : DEFAULT_RPM_BUDGET;
}

export async function reserveGeminiRequest(
  db: D1Database,
  options: {
    purpose: GeminiRequestPurpose;
    maxRequests: number;
    maxDailyRequests: number;
    now?: Date;
  },
) {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const cutoffMs = nowMs - WINDOW_MS;
  const maxRequests = normalizeGeminiRpmBudget(options.maxRequests);
  const maxDailyRequests = normalizeGeminiDailyBudget(options.maxDailyRequests);
  const dailyWindow = kstDayWindowMs(now);
  const requestId = crypto.randomUUID();

  // D1 serializes statements for a database. Keeping the count check and insert in one
  // statement makes the shared budget atomic across Cron and interactive chat requests.
  const inserted = await db
    .prepare(`
      INSERT INTO gemini_request_log (request_id, requested_at_ms, purpose)
      SELECT ?1, ?2, ?3
      WHERE (
        SELECT COUNT(*)
        FROM gemini_request_log
        WHERE requested_at_ms > ?4
      ) < ?5
      AND (
        SELECT COUNT(*)
        FROM gemini_request_log
        WHERE requested_at_ms >= ?6
      ) < ?7
      RETURNING request_id
    `)
    .bind(requestId, nowMs, options.purpose, cutoffMs, maxRequests, dailyWindow.start, maxDailyRequests)
    .first<{ request_id: string }>();

  if (inserted) return { requestId, maxRequests, maxDailyRequests };

  const usage = await db
    .prepare(`
      SELECT
        SUM(CASE WHEN requested_at_ms > ?1 THEN 1 ELSE 0 END) AS minute_count,
        SUM(CASE WHEN requested_at_ms >= ?2 THEN 1 ELSE 0 END) AS daily_count,
        MIN(CASE WHEN requested_at_ms > ?1 THEN requested_at_ms END) AS oldest_minute_request
      FROM gemini_request_log
      WHERE requested_at_ms >= MIN(?1, ?2)
    `)
    .bind(cutoffMs, dailyWindow.start)
    .first<{ minute_count: number | null; daily_count: number | null; oldest_minute_request: number | null }>();
  const dailyLimitReached = (usage?.daily_count ?? 0) >= maxDailyRequests;
  const retryAtMs = dailyLimitReached
    ? dailyWindow.end
    : (usage?.oldest_minute_request ?? nowMs) + WINDOW_MS;
  const retryAfterSeconds = Math.max(1, Math.ceil((retryAtMs - nowMs) / 1_000));

  console.warn(JSON.stringify({
    message: dailyLimitReached
      ? "gemini request blocked by local daily budget"
      : "gemini request blocked by local RPM budget",
    purpose: options.purpose,
    maxRequests,
    maxDailyRequests,
    retryAfterSeconds,
  }));
  throw new GeminiRateLimitError(retryAfterSeconds, dailyLimitReached ? "daily" : "rpm");
}

export async function pruneGeminiRequestLog(db: D1Database, now = new Date()) {
  const retentionCutoffMs = now.getTime() - 14 * 24 * 60 * 60 * 1_000;
  await db.prepare("DELETE FROM gemini_request_log WHERE requested_at_ms < ?1").bind(retentionCutoffMs).run();
}
