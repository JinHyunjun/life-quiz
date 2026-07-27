import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../../db/client";
import {
  FeedbackRequestError,
  getContentFeedbackState,
  normalizeFeedbackKind,
  normalizeFeedbackUserId,
  submitContentFeedback,
} from "../../../lib/feedback";
import { ReviewRequestError } from "../../../lib/reviews";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const contentItemId = parseId(params.contentItemId);
    const userId = normalizeFeedbackUserId(url.searchParams.get("userId"));
    const state = await getContentFeedbackState(createDb(env.DB), userId, contentItemId);
    return Response.json(state, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const contentItemId = parseId(params.contentItemId);
    const body = await readJsonBody(request);
    const result = await submitContentFeedback(createDb(env.DB), {
      contentItemId,
      userId: normalizeFeedbackUserId(body.userId),
      kind: normalizeFeedbackKind(body.kind),
    });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
};

function parseId(value: string | undefined) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new FeedbackRequestError("올바른 콘텐츠 ID가 필요합니다.");
  return id;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new FeedbackRequestError("JSON 요청이 필요합니다.");
  }
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new FeedbackRequestError("Request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function jsonError(error: unknown) {
  if (error instanceof FeedbackRequestError || error instanceof ReviewRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "피드백을 처리하지 못했습니다." }, { status: 500 });
}
