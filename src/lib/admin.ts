export async function isAuthorizedAdminRequest(request: Request, expectedToken: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const providedToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!providedToken || providedToken.length > 256 || !expectedToken) return false;

  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(providedToken)),
    crypto.subtle.digest("SHA-256", encoder.encode(expectedToken)),
  ]);
  const provided = new Uint8Array(providedHash);
  const expected = new Uint8Array(expectedHash);
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= provided[index] ^ expected[index];
  return mismatch === 0;
}
