import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../db/client";
import { getLifeQuizSession } from "../../lib/auth";
import { createLifeQuizEmailSender } from "../../lib/email";
import { parseSupportForm, SupportRequestError } from "../../lib/support-logic";
import {
  createSupportRequesterHash,
  createSupportRequest,
  markSupportNotification,
  SUPPORT_CATEGORY_LABELS,
} from "../../lib/support";

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
    const db = createDb(env.DB);
    const result = await createSupportRequest(db, {
      ...input,
      userId: session?.user.id ?? null,
      requesterHash,
    });
    const emailSender = createLifeQuizEmailSender(env);
    let notificationStatus: "pending" | "sent" | "failed" = "pending";
    if (emailSender) {
      try {
        notificationStatus = await emailSender.sendSupportAlert({
          ticketCode: result.ticketCode,
          name: input.name,
          email: input.email,
          categoryLabel: SUPPORT_CATEGORY_LABELS[input.category],
          subject: input.subject,
          message: input.message,
        });
        if (notificationStatus === "sent") await markSupportNotification(db, result.id, "sent");
      } catch (notificationError) {
        notificationStatus = "failed";
        const message = notificationError instanceof Error ? notificationError.message : String(notificationError);
        await markSupportNotification(db, result.id, "failed", message);
        console.error(JSON.stringify({ message: "support notification failed", ticketCode: result.ticketCode }));
      }
    }
    return Response.json({ ...result, notificationStatus }, { status: 201, headers: { "cache-control": "no-store" } });
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
