import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../../db/client";
import { enrollLearningItem, getLearningStatus, LearningRequestError } from "../../../lib/learning";
import { LOCAL_DEV_USER_ID, ReviewRequestError } from "../../../lib/reviews";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const contentItemId = parseContentItemId(params.contentItemId);
    const userId = url.searchParams.get("userId") ?? LOCAL_DEV_USER_ID;
    return Response.json(await getLearningStatus(createDb(env.DB), userId, contentItemId));
  } catch (error) {
    return jsonError(error);
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const contentItemId = parseContentItemId(params.contentItemId);
    const body = await readJsonBody(request);
    const userId = typeof body.userId === "string" ? body.userId : LOCAL_DEV_USER_ID;
    return Response.json(await enrollLearningItem(createDb(env.DB), userId, contentItemId));
  } catch (error) {
    return jsonError(error);
  }
};

function parseContentItemId(value: string | undefined) {
  const contentItemId = Number(value);
  if (!Number.isInteger(contentItemId) || contentItemId < 1) {
    throw new LearningRequestError("contentItemId must be a positive integer.");
  }
  return contentItemId;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) return {};
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new LearningRequestError("Request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

function jsonError(error: unknown) {
  if (error instanceof LearningRequestError || error instanceof ReviewRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "학습 등록을 처리하지 못했습니다." }, { status: 500 });
}
