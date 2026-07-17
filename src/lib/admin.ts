export const ADMIN_SESSION_COOKIE = "life_quiz_admin";
const ADMIN_SESSION_DURATION_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

export async function verifyAdminSecret(providedToken: string, expectedToken: string) {
  if (!providedToken || providedToken.length > 256 || !expectedToken) return false;

  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(providedToken)),
    crypto.subtle.digest("SHA-256", encoder.encode(expectedToken)),
  ]);
  return constantTimeEqual(new Uint8Array(providedHash), new Uint8Array(expectedHash));
}

export async function createAdminSessionCookie(expectedToken: string, secure: boolean, now = Date.now()) {
  const expiresAt = Math.floor(now / 1_000) + ADMIN_SESSION_DURATION_SECONDS;
  const signature = await signSession(expiresAt, expectedToken);
  const attributes = [
    `${ADMIN_SESSION_COOKIE}=${expiresAt}.${signature}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${ADMIN_SESSION_DURATION_SECONDS}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function clearAdminSessionCookie(secure: boolean) {
  return [
    `${ADMIN_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export async function isAuthorizedAdminSession(request: Request, expectedToken: string, now = Date.now()) {
  if (!expectedToken) return false;
  const session = readCookie(request.headers.get("cookie") ?? "", ADMIN_SESSION_COOKIE);
  if (!session) return false;

  const [expiresRaw, providedSignature, ...extra] = session.split(".");
  if (extra.length > 0 || !/^\d{10}$/.test(expiresRaw) || !providedSignature) return false;
  const expiresAt = Number(expiresRaw);
  const nowSeconds = Math.floor(now / 1_000);
  if (expiresAt <= nowSeconds || expiresAt > nowSeconds + ADMIN_SESSION_DURATION_SECONDS) return false;

  const expectedSignature = await signSession(expiresAt, expectedToken);
  return constantTimeEqual(encoder.encode(providedSignature), encoder.encode(expectedSignature));
}

export async function isAuthorizedAdminRequest(request: Request, expectedToken: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const providedToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (providedToken) return verifyAdminSecret(providedToken, expectedToken);
  return isAuthorizedAdminSession(request, expectedToken);
}

function readCookie(cookieHeader: string, name: string) {
  for (const part of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=");
    if (cookieName === name) return valueParts.join("=");
  }
  return undefined;
}

async function signSession(expiresAt: number, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`life-quiz-admin:${expiresAt}`));
  return toBase64Url(new Uint8Array(signature));
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(provided: Uint8Array, expected: Uint8Array) {
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= provided[index] ^ expected[index];
  return mismatch === 0;
}
