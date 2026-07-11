import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isAuthorizedAdminRequest } from "../../../lib/admin";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!(await isAuthorizedAdminRequest(request, env.INGEST_ADMIN_TOKEN))) {
    return Response.json({ error: "Not found" }, { status: 404, headers: { "cache-control": "no-store" } });
  }

  const response = await env.INGEST.fetch("https://life-quiz-ingest.internal/internal/trigger", {
    method: "POST",
    headers: { "x-life-quiz-service": "ingest" },
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
