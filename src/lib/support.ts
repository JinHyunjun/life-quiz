import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { supportRequests } from "../db/schema";
import type { SupportFormInput } from "./support-logic";
import { SupportRequestError } from "./support-logic";

export const SUPPORT_CATEGORY_LABELS = {
  account_access: "로그인·계정 접근",
  account_data: "계정 정보·삭제",
  service_bug: "서비스 오류",
  content: "콘텐츠 문의",
  suggestion: "기능 제안",
  other: "기타 문의",
} as const;

export async function createSupportRequest(
  db: AppDb,
  input: SupportFormInput & { userId: string | null; requesterHash: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1_000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const [fingerprintRows, emailRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(supportRequests).where(and(
      eq(supportRequests.requesterHash, input.requesterHash),
      gte(supportRequests.createdAt, hourAgo),
    )),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(supportRequests).where(and(
      eq(supportRequests.email, input.email),
      gte(supportRequests.createdAt, dayAgo),
    )),
  ]);
  if ((fingerprintRows[0]?.count ?? 0) >= 3 || (emailRows[0]?.count ?? 0) >= 5) {
    throw new SupportRequestError("문의 접수 횟수를 초과했습니다. 잠시 뒤 다시 시도해주세요.", 429);
  }

  const [saved] = await db.insert(supportRequests).values({
    userId: input.userId,
    requesterHash: input.requesterHash,
    name: input.name,
    email: input.email,
    category: input.category,
    subject: input.subject,
    message: input.message,
    status: "open",
    createdAt: now,
    updatedAt: now,
  }).returning({ id: supportRequests.id });

  return { id: saved.id, ticketCode: `LQ-${String(saved.id).padStart(6, "0")}` };
}

export async function listSupportInbox(db: AppDb, limit = 30) {
  const queue = await db.select({
    id: supportRequests.id,
    userId: supportRequests.userId,
    name: supportRequests.name,
    email: supportRequests.email,
    category: supportRequests.category,
    subject: supportRequests.subject,
    message: supportRequests.message,
    status: supportRequests.status,
    createdAt: supportRequests.createdAt,
  }).from(supportRequests).where(inArray(supportRequests.status, ["open", "in_progress"]))
    .orderBy(desc(supportRequests.createdAt)).limit(limit);

  return {
    openCount: queue.filter(({ status }) => status === "open").length,
    activeCount: queue.length,
    queue,
  };
}

export async function updateSupportRequestStatus(
  db: AppDb,
  id: number,
  status: "in_progress" | "resolved" | "dismissed",
  now = new Date(),
) {
  const [updated] = await db.update(supportRequests).set({
    status,
    updatedAt: now,
    resolvedAt: status === "in_progress" ? null : now,
  }).where(eq(supportRequests.id, id)).returning({ id: supportRequests.id, status: supportRequests.status });
  if (!updated) throw new SupportRequestError("처리할 문의를 찾지 못했습니다.", 404);
  return updated;
}

export async function createSupportRequesterHash(request: Request, secret: string) {
  const address = request.headers.get("cf-connecting-ip")?.trim() || "local";
  const agent = (request.headers.get("user-agent") ?? "unknown").slice(0, 160);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`support:${address}:${agent}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
