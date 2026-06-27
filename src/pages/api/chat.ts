import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../db/client";
import { assertSameOrigin, ChatRequestError, parseChatPayload, reserveChatRequest } from "../../lib/chat";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16_000) {
      throw new ChatRequestError("요청 내용이 너무 깁니다.", 413);
    }

    const payload = parseChatPayload(await request.json());
    const db = createDb(env.DB);
    const usage = await reserveChatRequest(db, request, Number(env.CHAT_HOURLY_LIMIT));
    const serviceResponse = await env.INGEST.fetch("https://life-quiz-ingest.internal/internal/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-life-quiz-service": "chat",
      },
      body: JSON.stringify(payload),
    });

    if (!serviceResponse.ok) {
      const detail = (await serviceResponse.text()).slice(0, 500);
      console.error(JSON.stringify({ message: "chat service failed", status: serviceResponse.status, detail }));
      throw new ChatRequestError("라이프 메이트가 잠시 쉬고 있어요. 잠시 후 다시 질문해주세요.", 502);
    }

    const result = await serviceResponse.json();
    return Response.json(result, {
      headers: {
        "cache-control": "no-store",
        "x-ratelimit-limit": String(usage.limit),
        "x-ratelimit-remaining": String(usage.remaining),
      },
    });
  } catch (error) {
    return chatErrorResponse(error);
  }
};

function chatErrorResponse(error: unknown) {
  if (error instanceof ChatRequestError) {
    const headers = new Headers({ "cache-control": "no-store" });
    if (error.retryAfter) headers.set("retry-after", String(error.retryAfter));
    return Response.json({ error: error.message }, { status: error.status, headers });
  }

  console.error(JSON.stringify({
    message: "chat request failed",
    error: error instanceof Error ? error.message : String(error),
  }));
  return Response.json({ error: "질문을 처리하지 못했습니다." }, { status: 500, headers: { "cache-control": "no-store" } });
}
