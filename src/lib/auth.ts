import { betterAuth } from "better-auth";
import { LOCAL_DEV_USER_ID, normalizeReviewUserId } from "./reviews";

const PRODUCTION_ORIGIN = "https://life-quiz.life-quiz.workers.dev";

export function createLifeQuizAuth(database: D1Database, secret: string, request: Request) {
  const origin = resolveAuthOrigin(request);

  return betterAuth({
    appName: "Life Quiz",
    database,
    secret,
    baseURL: origin,
    basePath: "/api/auth",
    trustedOrigins: [origin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    user: { modelName: "auth_user" },
    session: {
      modelName: "auth_session",
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "auth_rate_limit",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 10 * 60, max: 3 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    telemetry: { enabled: false },
  });
}

export async function getLifeQuizSession(request: Request, database: D1Database, secret: string) {
  const session = await createLifeQuizAuth(database, secret, request).api.getSession({
    headers: request.headers,
  });

  if (!session) return null;
  return {
    session: session.session,
    user: session.user,
  };
}

export async function resolveLearningUserId(
  request: Request,
  database: D1Database,
  secret: string,
  requestedUserId: string | null | undefined,
) {
  const session = await getLifeQuizSession(request, database, secret);
  if (session) return session.user.id;
  return normalizeReviewUserId(requestedUserId ?? LOCAL_DEV_USER_ID);
}

function resolveAuthOrigin(request: Request) {
  const url = new URL(request.url);
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return url.origin;
  if (url.hostname === "life-quiz.life-quiz.workers.dev") return PRODUCTION_ORIGIN;
  return PRODUCTION_ORIGIN;
}
