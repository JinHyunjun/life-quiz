import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../db/client";
import { resolveLearningUserId } from "../../lib/auth";
import { getOrCreateDailySession } from "../../lib/daily-learning";
import { ReviewRequestError } from "../../lib/reviews";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const userId = await resolveLearningUserId(request, env.DB, env.BETTER_AUTH_SECRET, url.searchParams.get("userId"));
    const session = await getOrCreateDailySession(createDb(env.DB), userId);
    return Response.json(session, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ReviewRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "오늘의 5분 학습을 준비하지 못했습니다." }, { status: 500 });
  }
};
