export const GUEST_ACCESS_COOKIE = "life_quiz_guest";
const GUEST_ACCESS_DURATION_SECONDS = 30 * 24 * 60 * 60;

export function hasGuestAccess(request: Request) {
  return readCookie(request.headers.get("cookie") ?? "", GUEST_ACCESS_COOKIE) === "1";
}

export function createGuestAccessCookie(secure: boolean) {
  return [
    `${GUEST_ACCESS_COOKIE}=1`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${GUEST_ACCESS_DURATION_SECONDS}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function clearGuestAccessCookie(secure: boolean) {
  return [
    `${GUEST_ACCESS_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function safeReturnPath(value: unknown, fallback = "/") {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

function readCookie(cookieHeader: string, name: string) {
  for (const part of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=");
    if (cookieName === name) return valueParts.join("=");
  }
  return undefined;
}
