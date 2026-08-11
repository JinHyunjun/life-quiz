import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../../db/client";
import { resolveLearningUserId } from "../../../lib/auth";
import {
  getSavedContentStatus,
  PersonalizationRequestError,
  removeSavedContentItem,
  saveContentItem,
} from "../../../lib/personalization";
import { ReviewRequestError } from "../../../lib/reviews";

export const prerender = false;

export const GET: APIRoute = async ({ params, request, url }) => {
  try {
    const contentItemId = parseContentItemId(params.contentItemId);
    const userId = await resolveLearningUserId(request, env.DB, env.BETTER_AUTH_SECRET, url.searchParams.get("userId"));
    return Response.json(await getSavedContentStatus(createDb(env.DB), userId, contentItemId), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const contentItemId = parseContentItemId(params.contentItemId);
    const body = await readJsonBody(request);
    const userId = await resolveLearningUserId(request, env.DB, env.BETTER_AUTH_SECRET, typeof body.userId === "string" ? body.userId : null);
    return Response.json(await saveContentItem(createDb(env.DB), userId, contentItemId), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const contentItemId = parseContentItemId(params.contentItemId);
    const body = await readJsonBody(request);
    const userId = await resolveLearningUserId(request, env.DB, env.BETTER_AUTH_SECRET, typeof body.userId === "string" ? body.userId : null);
    return Response.json(await removeSavedContentItem(createDb(env.DB), userId, contentItemId), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
};

function parseContentItemId(value: string | undefined) {
  const contentItemId = Number(value);
  if (!Number.isInteger(contentItemId) || contentItemId < 1) {
    throw new PersonalizationRequestError("올바른 콘텐츠 ID가 필요합니다.");
  }
  return contentItemId;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new PersonalizationRequestError("JSON 요청이 필요합니다.");
  }
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PersonalizationRequestError("Request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function jsonError(error: unknown) {
  if (error instanceof PersonalizationRequestError || error instanceof ReviewRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "저장 상태를 처리하지 못했습니다." }, { status: 500 });
}
