import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../db/client";
import {
  getPreferredCategories,
  PersonalizationRequestError,
  saveUserPreferences,
} from "../../lib/personalization";
import { normalizePreferenceCategories } from "../../lib/personalization-logic";
import { resolveLearningUserId } from "../../lib/auth";
import { ReviewRequestError } from "../../lib/reviews";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const userId = await resolveLearningUserId(request, env.DB, env.BETTER_AUTH_SECRET, url.searchParams.get("userId"));
    const categories = [...await getPreferredCategories(createDb(env.DB), userId)];
    return Response.json({ categories }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!request.headers.get("content-type")?.includes("application/json")) {
      throw new PersonalizationRequestError("JSON 요청이 필요합니다.");
    }

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new PersonalizationRequestError("Request body must be a JSON object.");
    }

    const input = body as Record<string, unknown>;
    const categories = normalizePreferenceCategories(input.categories);
    if (categories.length < 2 || categories.length > 3) {
      throw new PersonalizationRequestError("첫 관심 분야는 2개에서 3개까지 선택해주세요.");
    }
    const userId = await resolveLearningUserId(
      request,
      env.DB,
      env.BETTER_AUTH_SECRET,
      typeof input.userId === "string" ? input.userId : null,
    );
    const result = await saveUserPreferences(createDb(env.DB), userId, categories);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
};

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function jsonError(error: unknown) {
  if (error instanceof PersonalizationRequestError || error instanceof ReviewRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "첫 학습 설정을 저장하지 못했습니다." }, { status: 500 });
}
