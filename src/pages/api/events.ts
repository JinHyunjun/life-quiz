import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../db/client";
import {
  ProductEventRequestError,
  recordProductEvent,
} from "../../lib/product-events";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!request.headers.get("content-type")?.includes("application/json")) {
      throw new ProductEventRequestError("JSON 요청이 필요합니다.");
    }

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ProductEventRequestError("Request body must be a JSON object.");
    }

    const result = await recordProductEvent(createDb(env.DB), body as Record<string, unknown>);
    return Response.json(result, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ProductEventRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "행동 기록을 저장하지 못했습니다." }, { status: 500 });
  }
};

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
