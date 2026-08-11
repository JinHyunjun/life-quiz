import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../../db/client";
import { resolveLearningUserId } from "../../../lib/auth";
import { ReviewRequestError, submitQuizReview } from "../../../lib/reviews";

export const prerender = false;

export const POST: APIRoute = async ({ params, request, url }) => {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const quizItemId = Number(params.quizItemId);

    if (!Number.isInteger(quizItemId) || quizItemId < 1) {
      throw new ReviewRequestError("quizItemId must be a positive integer.");
    }

    const body = await readJsonBody(request);
    const db = createDb(env.DB);
    const userId = await resolveLearningUserId(request, env.DB, env.BETTER_AUTH_SECRET, readUserId(body, url));
    const result = await submitQuizReview(db, {
      quizItemId,
      userId,
      answer: typeof body.answer === "string" ? body.answer : undefined,
      rating: body.rating,
    });

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
};

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {};
  }

  const body = await request.json();

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ReviewRequestError("Request body must be a JSON object.");
  }

  return body as Record<string, unknown>;
}

function readUserId(body: Record<string, unknown>, url: URL) {
  return typeof body.userId === "string" ? body.userId : url.searchParams.get("userId");
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function jsonError(error: unknown) {
  if (error instanceof ReviewRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return Response.json({ error: "Failed to submit review." }, { status: 500 });
}
