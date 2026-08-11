import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { contentItems, dailySessionItems, learningItems, quizItems } from "../db/schema";
import { selectBalancedDailyCandidates } from "./daily-selection";
import { kstDateKey } from "./dates";
import { getPreferredCategories } from "./personalization";
import {
  ensureReviewUser,
  getDueReviewCards,
  normalizeDomainUserId,
  ReviewRequestError,
  submitQuizReview,
  type SubmitReviewInput,
} from "./reviews";

export const DAILY_SESSION_SIZE = 5;
const DAILY_REVIEW_LIMIT = 2;
const DAILY_CANDIDATE_POOL_SIZE = 120;

type DailyCandidate = {
  quizItemId: number;
  contentItemId: number;
  title: string;
  category: typeof contentItems.$inferSelect.category;
  citationUrl: string | null;
  citationLabel: string;
  question: string;
  choices: string[];
};

export interface DailySessionCard extends DailyCandidate {
  position: number;
  itemType: "review" | "new";
  completedAt: string | null;
}

export interface DailySession {
  userId: string;
  date: string;
  totalCount: number;
  completedCount: number;
  isComplete: boolean;
  cards: DailySessionCard[];
}

export async function getOrCreateDailySession(
  db: AppDb,
  userIdValue: string,
  now = new Date(),
): Promise<DailySession> {
  const userId = (await ensureReviewUser(db, normalizeDomainUserId(userIdValue))).id;
  const date = kstDateKey(now);
  let cards = await loadDailySessionCards(db, userId, date);

  if (cards.length < DAILY_SESSION_SIZE) {
    const reservedQuizIds = new Set(cards.map(({ quizItemId }) => quizItemId));
    const reviewSlots = Math.max(0, DAILY_REVIEW_LIMIT - cards.filter(({ itemType }) => itemType === "review").length);
    const dueCards = (await getDueReviewCards(db, userId, DAILY_REVIEW_LIMIT + cards.length, now))
      .filter(({ quizItemId }) => !reservedQuizIds.has(quizItemId))
      .slice(0, reviewSlots);

    const usedCategories = new Set(cards.map(({ category }) => category));
    dueCards.forEach(({ category, quizItemId }) => {
      usedCategories.add(category);
      reservedQuizIds.add(quizItemId);
    });

    const newSlots = DAILY_SESSION_SIZE - cards.length - dueCards.length;
    const newCandidates = newSlots > 0
      ? await loadNewCandidates(db, userId)
      : [];
    const preferredCategories = newSlots > 0
      ? await getPreferredCategories(db, userId)
      : new Set<string>();
    const selectedNew = selectBalancedDailyCandidates(
      newCandidates.filter(({ quizItemId }) => !reservedQuizIds.has(quizItemId)),
      usedCategories,
      newSlots,
      preferredCategories,
    );

    if (selectedNew.length > 0) {
      await db
        .insert(learningItems)
        .values(selectedNew.map(({ contentItemId }) => ({
          userId,
          contentItemId,
          enrolledAt: now,
        })))
        .onConflictDoNothing();
    }

    const occupiedPositions = new Set(cards.map(({ position }) => position));
    const availablePositions = Array.from(
      { length: DAILY_SESSION_SIZE },
      (_, position) => position,
    ).filter((position) => !occupiedPositions.has(position));
    const additions = [
      ...dueCards.map(({ quizItemId }) => ({ quizItemId, itemType: "review" as const })),
      ...selectedNew.map(({ quizItemId }) => ({ quizItemId, itemType: "new" as const })),
    ];

    for (const [index, addition] of additions.entries()) {
      const position = availablePositions[index];
      if (position === undefined) break;
      await db
        .insert(dailySessionItems)
        .values({
          userId,
          kstDate: date,
          quizItemId: addition.quizItemId,
          position,
          itemType: addition.itemType,
          createdAt: now,
        })
        .onConflictDoNothing();
    }

    cards = await loadDailySessionCards(db, userId, date);
  }

  return toDailySession(userId, date, cards);
}

export async function submitDailyReview(
  db: AppDb,
  input: SubmitReviewInput,
): Promise<Awaited<ReturnType<typeof submitQuizReview>> & {
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
}> {
  const userId = normalizeDomainUserId(input.userId ?? "");
  const now = input.now ?? new Date();
  const date = kstDateKey(now);
  const [sessionItem] = await db
    .select({
      id: dailySessionItems.id,
      completedAt: dailySessionItems.completedAt,
    })
    .from(dailySessionItems)
    .where(and(
      eq(dailySessionItems.userId, userId),
      eq(dailySessionItems.kstDate, date),
      eq(dailySessionItems.quizItemId, input.quizItemId),
    ))
    .limit(1);

  if (!sessionItem) {
    throw new ReviewRequestError("오늘의 5분 학습에 포함된 카드가 아닙니다.", 404);
  }
  if (sessionItem.completedAt) {
    throw new ReviewRequestError("이미 완료한 오늘의 카드입니다.", 409);
  }

  const result = await submitQuizReview(db, { ...input, userId, now });
  await db
    .update(dailySessionItems)
    .set({ completedAt: now })
    .where(eq(dailySessionItems.id, sessionItem.id));

  const cards = await loadDailySessionCards(db, userId, date);
  const completedCount = cards.filter(({ completedAt }) => completedAt !== null).length;
  return {
    ...result,
    completedCount,
    totalCount: cards.length,
    isComplete: cards.length > 0 && completedCount === cards.length,
  };
}

async function loadDailySessionCards(db: AppDb, userId: string, date: string): Promise<DailySessionCard[]> {
  const rows = await db
    .select({
      quizItemId: quizItems.id,
      contentItemId: contentItems.id,
      title: contentItems.title,
      category: contentItems.category,
      citationUrl: contentItems.citationUrl,
      citationLabel: contentItems.citationLabel,
      question: quizItems.question,
      choices: quizItems.choices,
      position: dailySessionItems.position,
      itemType: dailySessionItems.itemType,
      completedAt: dailySessionItems.completedAt,
    })
    .from(dailySessionItems)
    .innerJoin(quizItems, eq(quizItems.id, dailySessionItems.quizItemId))
    .innerJoin(contentItems, eq(contentItems.id, quizItems.contentItemId))
    .where(and(
      eq(dailySessionItems.userId, userId),
      eq(dailySessionItems.kstDate, date),
      eq(contentItems.moderationStatus, "published"),
    ))
    .orderBy(asc(dailySessionItems.position));

  return rows.map((row) => ({
    ...row,
    completedAt: row.completedAt?.toISOString() ?? null,
  }));
}

async function loadNewCandidates(db: AppDb, userId: string): Promise<DailyCandidate[]> {
  return db
    .select({
      quizItemId: quizItems.id,
      contentItemId: contentItems.id,
      title: contentItems.title,
      category: contentItems.category,
      citationUrl: contentItems.citationUrl,
      citationLabel: contentItems.citationLabel,
      question: quizItems.question,
      choices: quizItems.choices,
    })
    .from(quizItems)
    .innerJoin(contentItems, eq(contentItems.id, quizItems.contentItemId))
    .leftJoin(learningItems, and(
      eq(learningItems.contentItemId, contentItems.id),
      eq(learningItems.userId, userId),
    ))
    .where(and(
      eq(contentItems.moderationStatus, "published"),
      isNull(learningItems.id),
    ))
    .orderBy(desc(contentItems.createdAt), desc(quizItems.id))
    .limit(DAILY_CANDIDATE_POOL_SIZE);
}

function toDailySession(userId: string, date: string, cards: DailySessionCard[]): DailySession {
  const completedCount = cards.filter(({ completedAt }) => completedAt !== null).length;
  return {
    userId,
    date,
    totalCount: cards.length,
    completedCount,
    isComplete: cards.length > 0 && completedCount === cards.length,
    cards,
  };
}
