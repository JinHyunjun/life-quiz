export function isRetryableGeminiStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export function geminiRetryDelayMs(retryAfter: string | null) {
  const retryAfterSeconds = Number(retryAfter);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(Math.max(Math.ceil(retryAfterSeconds * 1_000), 1_000), 5_000);
  }
  return 2_000;
}
