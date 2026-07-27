import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  contentFeedback,
  contentItems,
  type ContentFeedbackKind,
} from "../db/schema";
import { ensureReviewUser, normalizeReviewUserId, ReviewRequestError } from "./reviews";

export const FEEDBACK_KINDS = [
  "helpful",
  "hard_to_understand",
  "duplicate",
  "outdated",
  "source_issue",
  "quiz_issue",
] as const satisfies readonly ContentFeedbackKind[];

export const FEEDBACK_LABELS: Record<ContentFeedbackKind, string> = {
  helpful: "도움됐어요",
  hard_to_understand: "이해하기 어려워요",
  duplicate: "내용이 반복돼요",
  outdated: "정보가 오래됐어요",
  source_issue: "출처에 문제가 있어요",
  quiz_issue: "퀴즈에 문제가 있어요",
};

export class FeedbackRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function normalizeFeedbackKind(value: unknown): ContentFeedbackKind {
  if (typeof value === "string" && FEEDBACK_KINDS.includes(value as ContentFeedbackKind)) {
    return value as ContentFeedbackKind;
  }
  throw new FeedbackRequestError("지원하지 않는 피드백 유형입니다.");
}

export async function getContentFeedbackState(
  db: AppDb,
  userIdValue: string,
  contentItemId: number,
) {
  const userId = (await ensureReviewUser(db, normalizeReviewUserId(userIdValue))).id;
  const [submitted, helpfulRows] = await Promise.all([
    db
      .select({ kind: contentFeedback.kind })
      .from(contentFeedback)
      .where(and(
        eq(contentFeedback.userId, userId),
        eq(contentFeedback.contentItemId, contentItemId),
      ))
      .orderBy(desc(contentFeedback.createdAt)),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(contentFeedback)
      .where(and(
        eq(contentFeedback.contentItemId, contentItemId),
        eq(contentFeedback.kind, "helpful"),
      )),
  ]);

  return {
    submittedKinds: submitted.map(({ kind }) => kind),
    helpfulCount: helpfulRows[0]?.count ?? 0,
  };
}

export async function submitContentFeedback(
  db: AppDb,
  params: {
    contentItemId: number;
    userId: string;
    kind: ContentFeedbackKind;
    now?: Date;
  },
) {
  const userId = (await ensureReviewUser(db, normalizeReviewUserId(params.userId))).id;
  const now = params.now ?? new Date();
  const [available] = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(and(
      eq(contentItems.id, params.contentItemId),
      eq(contentItems.moderationStatus, "published"),
    ))
    .limit(1);

  if (!available) throw new FeedbackRequestError("피드백을 남길 콘텐츠를 찾지 못했습니다.", 404);

  const status = params.kind === "helpful" ? "resolved" : "open";
  const [saved] = await db
    .insert(contentFeedback)
    .values({
      contentItemId: params.contentItemId,
      userId,
      kind: params.kind,
      status,
      createdAt: now,
      resolvedAt: status === "resolved" ? now : null,
    })
    .onConflictDoUpdate({
      target: [contentFeedback.userId, contentFeedback.contentItemId, contentFeedback.kind],
      set: {
        status,
        createdAt: now,
        resolvedAt: status === "resolved" ? now : null,
      },
    })
    .returning();

  return {
    id: saved.id,
    kind: saved.kind,
    status: saved.status,
    label: FEEDBACK_LABELS[saved.kind],
  };
}

export async function updateContentFeedbackStatus(
  db: AppDb,
  feedbackId: number,
  status: "resolved" | "dismissed",
  now = new Date(),
) {
  const [updated] = await db
    .update(contentFeedback)
    .set({ status, resolvedAt: now })
    .where(and(
      eq(contentFeedback.id, feedbackId),
      ne(contentFeedback.kind, "helpful"),
    ))
    .returning({ id: contentFeedback.id, status: contentFeedback.status });

  if (!updated) throw new FeedbackRequestError("처리할 피드백을 찾지 못했습니다.", 404);
  return updated;
}

export function normalizeFeedbackUserId(value: unknown) {
  if (typeof value !== "string") throw new ReviewRequestError("익명 사용자 ID가 필요합니다.");
  return normalizeReviewUserId(value);
}
