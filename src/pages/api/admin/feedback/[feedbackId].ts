import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../../../db/client";
import { isAuthorizedAdminRequest } from "../../../../lib/admin";
import { FeedbackRequestError, updateContentFeedbackStatus } from "../../../../lib/feedback";

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    if (!isSameOrigin(request) || !(await isAuthorizedAdminRequest(request, env.INGEST_ADMIN_TOKEN))) {
      return Response.json({ error: "Not found" }, { status: 404, headers: { "cache-control": "no-store" } });
    }

    const feedbackId = Number(params.feedbackId);
    if (!Number.isInteger(feedbackId) || feedbackId < 1) {
      throw new FeedbackRequestError("올바른 피드백 ID가 필요합니다.");
    }
    const body = await readJsonBody(request);
    const status = body.status === "resolved" || body.status === "dismissed" ? body.status : null;
    if (!status) throw new FeedbackRequestError("처리 상태가 올바르지 않습니다.");

    const updated = await updateContentFeedbackStatus(createDb(env.DB), feedbackId, status);
    return Response.json(updated, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof FeedbackRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "피드백 상태를 변경하지 못했습니다." }, { status: 500 });
  }
};

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
