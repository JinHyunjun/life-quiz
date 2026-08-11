import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { linkAnonymousLearningData } from "../../../lib/account-linking";
import { getLifeQuizSession } from "../../../lib/auth";
import { ReviewRequestError } from "../../../lib/reviews";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (!request.headers.get("content-type")?.includes("application/json")) {
      throw new ReviewRequestError("JSON 요청이 필요합니다.");
    }

    const session = await getLifeQuizSession(request, env.DB, env.BETTER_AUTH_SECRET);
    if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const body = await request.json();
    const anonymousUserId = body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).anonymousUserId
      : null;
    if (typeof anonymousUserId !== "string") {
      throw new ReviewRequestError("현재 브라우저의 익명 사용자 ID가 필요합니다.");
    }

    const result = await linkAnonymousLearningData(env.DB, {
      anonymousUserId,
      authUserId: session.user.id,
      authUserName: session.user.name,
    });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ReviewRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "브라우저 학습 기록을 계정에 연결하지 못했습니다." }, { status: 500 });
  }
};

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
