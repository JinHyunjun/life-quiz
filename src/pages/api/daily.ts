import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../db/client";
import { getOrCreateDailySession } from "../../lib/daily-learning";
import { LOCAL_DEV_USER_ID, ReviewRequestError } from "../../lib/reviews";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const userId = url.searchParams.get("userId") ?? LOCAL_DEV_USER_ID;
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
