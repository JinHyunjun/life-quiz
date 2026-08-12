import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../../../db/client";
import { isAuthorizedAdminRequest } from "../../../../lib/admin";
import { updateSupportRequestStatus } from "../../../../lib/support";
import { SupportRequestError } from "../../../../lib/support-logic";

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    if (!isSameOrigin(request) || !(await isAuthorizedAdminRequest(request, env.INGEST_ADMIN_TOKEN))) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const supportId = Number(params.supportId);
    if (!Number.isInteger(supportId) || supportId < 1) throw new SupportRequestError("올바른 문의 ID가 필요합니다.");
    if (!request.headers.get("content-type")?.includes("application/json")) throw new SupportRequestError("JSON 요청이 필요합니다.");
    const body = await request.json() as Record<string, unknown>;
    const status = body.status === "in_progress" || body.status === "resolved" || body.status === "dismissed"
      ? body.status
      : null;
    if (!status) throw new SupportRequestError("처리 상태가 올바르지 않습니다.");
    const result = await updateSupportRequestStatus(createDb(env.DB), supportId, status);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SupportRequestError) return Response.json({ error: error.message }, { status: error.status });
    console.error(error);
    return Response.json({ error: "문의 상태를 변경하지 못했습니다." }, { status: 500 });
  }
};

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
