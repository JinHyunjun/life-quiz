const STORAGE_KEY = "life-quiz-anonymous-user";
const ANONYMOUS_USER_PATTERN = /^anon:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getAnonymousUserId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ANONYMOUS_USER_PATTERN.test(stored)) return stored;

    const created = `anon:${crypto.randomUUID()}`;
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return `anon:${crypto.randomUUID()}`;
  }
}
