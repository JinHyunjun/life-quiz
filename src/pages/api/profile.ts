import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../db/client";
import {
  getLearningProfile,
  PersonalizationRequestError,
  saveUserPreferences,
} from "../../lib/personalization";
import { resolveLearningUserId } from "../../lib/auth";
import { ReviewRequestError } from "../../lib/reviews";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const userId = await resolveLearningUserId(request, env.DB, env.BETTER_AUTH_SECRET, url.searchParams.get("userId"));
    const profile = await getLearningProfile(createDb(env.DB), userId);
    return Response.json(profile, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await readJsonBody(request);
    const userId = await resolveLearningUserId(
      request,
      env.DB,
      env.BETTER_AUTH_SECRET,
      typeof body.userId === "string" ? body.userId : null,
    );
    const result = await saveUserPreferences(createDb(env.DB), userId, body.categories);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
};

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
  return Response.json({ error: "학습 프로필을 처리하지 못했습니다." }, { status: 500 });
}
