import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../../db/client";
import { resolveLearningUserId } from "../../../lib/auth";
import { submitDailyReview } from "../../../lib/daily-learning";
import { ReviewRequestError } from "../../../lib/reviews";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const quizItemId = Number(params.quizItemId);
    if (!Number.isInteger(quizItemId) || quizItemId < 1) {
      throw new ReviewRequestError("quizItemId must be a positive integer.");
    }

    const body = await readJsonBody(request);
    const userId = await resolveLearningUserId(
      request,
      env.DB,
      env.BETTER_AUTH_SECRET,
      typeof body.userId === "string" ? body.userId : null,
    );
    const result = await submitDailyReview(createDb(env.DB), {
      quizItemId,
      userId,
      answer: typeof body.answer === "string" ? body.answer : undefined,
      rating: body.rating,
    });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ReviewRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "오늘의 학습 결과를 저장하지 못했습니다." }, { status: 500 });
  }
};

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ReviewRequestError("JSON 요청이 필요합니다.");
  }
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ReviewRequestError("Request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
