export type GeminiRequestPurpose = "ingestion" | "chat";

const WINDOW_MS = 60_000;
const DEFAULT_RPM_BUDGET = 12;

export class GeminiRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Gemini request budget is exhausted");
    this.name = "GeminiRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function normalizeGeminiRpmBudget(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 1), 14) : DEFAULT_RPM_BUDGET;
}

export async function reserveGeminiRequest(
  db: D1Database,
  options: { purpose: GeminiRequestPurpose; maxRequests: number; now?: Date },
) {
  const nowMs = (options.now ?? new Date()).getTime();
  const cutoffMs = nowMs - WINDOW_MS;
  const maxRequests = normalizeGeminiRpmBudget(options.maxRequests);
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
      RETURNING request_id
    `)
    .bind(requestId, nowMs, options.purpose, cutoffMs, maxRequests)
    .first<{ request_id: string }>();

  if (inserted) return { requestId, maxRequests };

  const oldest = await db
    .prepare(`
      SELECT MIN(requested_at_ms) AS requested_at_ms
      FROM gemini_request_log
      WHERE requested_at_ms > ?1
    `)
    .bind(cutoffMs)
    .first<{ requested_at_ms: number | null }>();
  const retryAtMs = (oldest?.requested_at_ms ?? nowMs) + WINDOW_MS;
  const retryAfterSeconds = Math.max(1, Math.ceil((retryAtMs - nowMs) / 1_000));

  console.warn(JSON.stringify({
    message: "gemini request blocked by local RPM budget",
    purpose: options.purpose,
    maxRequests,
    retryAfterSeconds,
  }));
  throw new GeminiRateLimitError(retryAfterSeconds);
}

export async function pruneGeminiRequestLog(db: D1Database, now = new Date()) {
  const retentionCutoffMs = now.getTime() - 24 * 60 * 60 * 1_000;
  await db.prepare("DELETE FROM gemini_request_log WHERE requested_at_ms < ?1").bind(retentionCutoffMs).run();
}
