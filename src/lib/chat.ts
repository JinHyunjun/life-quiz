import { eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { chatUsage } from "../db/schema";

const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 800;
const MAX_TOTAL_LENGTH = 3_600;

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

export interface ChatPayload {
  messages: ChatMessage[];
  contentItemId?: number;
}

export class ChatRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  try {
    if (new URL(origin).host !== new URL(request.url).host) {
      throw new ChatRequestError("허용되지 않은 요청입니다.", 403);
    }
  } catch (error) {
    if (error instanceof ChatRequestError) throw error;
    throw new ChatRequestError("요청 출처를 확인할 수 없습니다.", 403);
  }
}

export function parseChatPayload(value: unknown): ChatPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatRequestError("요청 본문은 JSON 객체여야 합니다.");
  }

  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.messages) || candidate.messages.length < 1 || candidate.messages.length > MAX_MESSAGES) {
    throw new ChatRequestError(`대화는 1개 이상 ${MAX_MESSAGES}개 이하의 메시지로 보내주세요.`);
  }

  let totalLength = 0;
  const messages = candidate.messages.map((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new ChatRequestError("메시지 형식이 올바르지 않습니다.");
    }

    const entry = message as Record<string, unknown>;
    if (entry.role !== "user" && entry.role !== "assistant") {
      throw new ChatRequestError("메시지 역할이 올바르지 않습니다.");
    }

    if (typeof entry.text !== "string") {
      throw new ChatRequestError("메시지 내용은 문자열이어야 합니다.");
    }

    const text = entry.text.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH) {
      throw new ChatRequestError(`각 메시지는 1자 이상 ${MAX_MESSAGE_LENGTH}자 이하로 입력해주세요.`);
    }

    totalLength += text.length;
    return { role: entry.role, text } satisfies ChatMessage;
  });

  if (messages.at(-1)?.role !== "user") {
    throw new ChatRequestError("마지막 메시지는 사용자의 질문이어야 합니다.");
  }

  if (totalLength > MAX_TOTAL_LENGTH) {
    throw new ChatRequestError("대화 내용이 너무 깁니다. 새 대화로 다시 질문해주세요.");
  }

  let contentItemId: number | undefined;
  if (candidate.contentItemId !== undefined && candidate.contentItemId !== null) {
    contentItemId = Number(candidate.contentItemId);
    if (!Number.isInteger(contentItemId) || contentItemId < 1) {
      throw new ChatRequestError("콘텐츠 번호가 올바르지 않습니다.");
    }
  }

  return { messages, contentItemId };
}

export async function reserveChatRequest(db: AppDb, request: Request, requestedLimit: number, now = new Date()) {
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 30) : 8;
  const windowNumber = Math.floor(now.getTime() / 3_600_000);
  const windowStartedAt = new Date(windowNumber * 3_600_000);
  const identityHash = await hashRequestIdentity(request);
  const key = `${identityHash}:${windowNumber}`;

  await db
    .insert(chatUsage)
    .values({ key, identityHash, windowStartedAt, requestCount: 1 })
    .onConflictDoUpdate({
      target: chatUsage.key,
      set: { requestCount: sql`${chatUsage.requestCount} + 1` },
    });

  const [usage] = await db.select({ requestCount: chatUsage.requestCount }).from(chatUsage).where(eq(chatUsage.key, key)).limit(1);
  const used = usage?.requestCount ?? 1;
  const retryAfter = Math.max(1, Math.ceil((windowStartedAt.getTime() + 3_600_000 - now.getTime()) / 1_000));

  if (used > limit) {
    throw new ChatRequestError("이번 시간의 질문 횟수를 모두 사용했어요. 잠시 뒤 다시 만나요.", 429, retryAfter);
  }

  return { limit, remaining: Math.max(0, limit - used), retryAfter };
}

async function hashRequestIdentity(request: Request) {
  const forwardedIp = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "local";
  const userAgent = request.headers.get("user-agent")?.slice(0, 160) ?? "unknown";
  const data = new TextEncoder().encode(`${forwardedIp}|${userAgent}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
