const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface KstDayRange {
  key: string;
  start: Date;
  end: Date;
}

export function kstDateKey(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function kstDayRange(key: string): KstDayRange | null {
  if (!DATE_KEY_PATTERN.test(key)) return null;

  const [year, month, day] = key.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year
    || utcDate.getUTCMonth() !== month - 1
    || utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  const start = new Date(utcDate.getTime() - KST_OFFSET_MS);
  return { key, start, end: new Date(start.getTime() + DAY_MS) };
}

export function todayKstRange(now = new Date()) {
  return kstDayRange(kstDateKey(now))!;
}

export function formatKstDate(key: string, includeYear = true) {
  const range = kstDayRange(key);
  if (!range) return key;

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(includeYear ? { year: "numeric" as const } : {}),
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(range.start);
}
