import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../db/client";
import { getLifeQuizSession } from "../../lib/auth";
import { parseSupportForm, SupportRequestError } from "../../lib/support-logic";
import { createSupportRequesterHash, createSupportRequest } from "../../lib/support";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (!request.headers.get("content-type")?.includes("application/json")) {
      throw new SupportRequestError("JSON 요청이 필요합니다.");
    }
    const input = parseSupportForm(await request.json());
    const [session, requesterHash] = await Promise.all([
      getLifeQuizSession(request, env.DB, env.BETTER_AUTH_SECRET),
      createSupportRequesterHash(request, env.BETTER_AUTH_SECRET),
    ]);
    const result = await createSupportRequest(createDb(env.DB), {
      ...input,
      userId: session?.user.id ?? null,
      requesterHash,
    });
    return Response.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SupportRequestError) {
      return Response.json({ error: error.message }, { status: error.status, headers: { "cache-control": "no-store" } });
    }
    console.error(JSON.stringify({ message: "support request failed", error: error instanceof Error ? error.message : String(error) }));
    return Response.json({ error: "문의를 접수하지 못했습니다. 잠시 뒤 다시 시도해주세요." }, { status: 500 });
  }
};

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
