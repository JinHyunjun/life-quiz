import { and, eq } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { contentItems, learningItems, quizItems } from "../db/schema";
import { ensureReviewUser, normalizeReviewUserId } from "./reviews";

export class LearningRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export async function getLearningStatus(db: AppDb, userIdValue: string, contentItemId: number) {
  const userId = normalizeReviewUserId(userIdValue);
  const [row] = await db
    .select({ enrolledAt: learningItems.enrolledAt })
    .from(learningItems)
    .where(and(eq(learningItems.userId, userId), eq(learningItems.contentItemId, contentItemId)))
    .limit(1);

  return { enrolled: Boolean(row), enrolledAt: row?.enrolledAt.toISOString() ?? null };
}

export async function enrollLearningItem(db: AppDb, userIdValue: string, contentItemId: number) {
  const userId = normalizeReviewUserId(userIdValue);
  await ensureReviewUser(db, userId);

  const [available] = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .innerJoin(quizItems, eq(quizItems.contentItemId, contentItems.id))
    .where(and(
      eq(contentItems.id, contentItemId),
      eq(contentItems.moderationStatus, "published"),
    ))
    .limit(1);
  if (!available) throw new LearningRequestError("복습에 담을 수 있는 콘텐츠를 찾지 못했습니다.", 404);

  const now = new Date();
  await db
    .insert(learningItems)
    .values({ userId, contentItemId, enrolledAt: now })
    .onConflictDoNothing();

  return { enrolled: true, enrolledAt: now.toISOString() };
}
