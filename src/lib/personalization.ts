import { and, desc, eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  contentItems,
  dailySessionItems,
  learningItems,
  quizItems,
  reviewLogs,
  savedContentItems,
  userPreferences,
} from "../db/schema";
import type { Category } from "./categories";
import { kstDateKey } from "./dates";
import {
  calculateLearningStreak,
  normalizePreferenceCategories,
  PersonalizationRequestError,
  shiftDateKey,
} from "./personalization-logic";
import {
  ensureReviewUser,
  getDueReviewCards,
  normalizeDomainUserId,
  ReviewRequestError,
} from "./reviews";

const PROFILE_ACTIVITY_DAYS = 7;
const PROFILE_HISTORY_LIMIT = 400;
const SAVED_CONTENT_LIMIT = 24;

export { PersonalizationRequestError } from "./personalization-logic";

export interface LearningProfile {
  userId: string;
  today: string;
  preferences: Category[];
  report: {
    currentStreak: number;
    longestStreak: number;
    completedDays: number;
    learnedCount: number;
    reviewCount: number;
    memorySuccessRate: number;
    dueCount: number;
    savedCount: number;
  };
  activity: Array<{
    date: string;
    totalCount: number;
    completedCount: number;
    isComplete: boolean;
  }>;
  categoryStats: Array<{
    category: Category;
    reviewCount: number;
    memorySuccessRate: number;
    averageStability: number;
  }>;
  savedItems: Array<{
    contentItemId: number;
    title: string;
    category: Category;
    citationLabel: string;
    savedAt: string;
  }>;
}

export async function getPreferredCategories(db: AppDb, userIdValue: string) {
  const userId = normalizeDomainUserId(userIdValue);
  const [row] = await db
    .select({ categories: userPreferences.categories })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return new Set(row?.categories ?? []);
}

export async function saveUserPreferences(
  db: AppDb,
  userIdValue: string,
  categoriesValue: unknown,
  now = new Date(),
) {
  const userId = (await ensureReviewUser(db, normalizeDomainUserId(userIdValue))).id;
  const categories = normalizePreferenceCategories(categoriesValue);

  await db
    .insert(userPreferences)
    .values({ userId, categories, updatedAt: now })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { categories, updatedAt: now },
    });

  return { userId, categories };
}

export async function getSavedContentStatus(db: AppDb, userIdValue: string, contentItemId: number) {
  const userId = (await ensureReviewUser(db, normalizeDomainUserId(userIdValue))).id;
  const [row] = await db
    .select({ id: savedContentItems.id })
    .from(savedContentItems)
    .where(and(
      eq(savedContentItems.userId, userId),
      eq(savedContentItems.contentItemId, contentItemId),
    ))
    .limit(1);

  return { userId, contentItemId, saved: Boolean(row) };
}

export async function saveContentItem(
  db: AppDb,
  userIdValue: string,
  contentItemId: number,
  now = new Date(),
) {
  const userId = (await ensureReviewUser(db, normalizeDomainUserId(userIdValue))).id;
  const [content] = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(and(
      eq(contentItems.id, contentItemId),
      eq(contentItems.moderationStatus, "published"),
    ))
    .limit(1);

  if (!content) {
    throw new PersonalizationRequestError("저장할 콘텐츠를 찾지 못했습니다.", 404);
  }

  await db
    .insert(savedContentItems)
    .values({ userId, contentItemId, savedAt: now })
    .onConflictDoNothing();

  return { userId, contentItemId, saved: true };
}

export async function removeSavedContentItem(db: AppDb, userIdValue: string, contentItemId: number) {
  const userId = (await ensureReviewUser(db, normalizeDomainUserId(userIdValue))).id;
  await db
    .delete(savedContentItems)
    .where(and(
      eq(savedContentItems.userId, userId),
      eq(savedContentItems.contentItemId, contentItemId),
    ));

  return { userId, contentItemId, saved: false };
}

export async function getLearningProfile(
  db: AppDb,
  userIdValue: string,
  now = new Date(),
): Promise<LearningProfile> {
  const userId = (await ensureReviewUser(db, normalizeDomainUserId(userIdValue))).id;
  const today = kstDateKey(now);

  const [
    preferenceRows,
    savedRows,
    savedCountRows,
    dailyRows,
    learningCountRows,
    reviewSummaryRows,
    categoryRows,
    dueCards,
  ] = await Promise.all([
    db
      .select({ categories: userPreferences.categories })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1),
    db
      .select({
        contentItemId: contentItems.id,
        title: contentItems.title,
        category: contentItems.category,
        citationLabel: contentItems.citationLabel,
        savedAt: savedContentItems.savedAt,
      })
      .from(savedContentItems)
      .innerJoin(contentItems, eq(contentItems.id, savedContentItems.contentItemId))
      .where(and(
        eq(savedContentItems.userId, userId),
        eq(contentItems.moderationStatus, "published"),
      ))
      .orderBy(desc(savedContentItems.savedAt))
      .limit(SAVED_CONTENT_LIMIT),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(savedContentItems)
      .where(eq(savedContentItems.userId, userId)),
    db
      .select({
        date: dailySessionItems.kstDate,
        totalCount: sql<number>`count(*)`.mapWith(Number),
        completedCount: sql<number>`sum(case when ${dailySessionItems.completedAt} is not null then 1 else 0 end)`.mapWith(Number),
      })
      .from(dailySessionItems)
      .where(eq(dailySessionItems.userId, userId))
      .groupBy(dailySessionItems.kstDate)
      .orderBy(desc(dailySessionItems.kstDate))
      .limit(PROFILE_HISTORY_LIMIT),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(learningItems)
      .where(eq(learningItems.userId, userId)),
    db
      .select({
        reviewCount: sql<number>`count(*)`.mapWith(Number),
        successfulCount: sql<number>`sum(case when ${reviewLogs.rating} >= 3 then 1 else 0 end)`.mapWith(Number),
      })
      .from(reviewLogs)
      .where(eq(reviewLogs.userId, userId)),
    db
      .select({
        category: contentItems.category,
        reviewCount: sql<number>`count(*)`.mapWith(Number),
        successfulCount: sql<number>`sum(case when ${reviewLogs.rating} >= 3 then 1 else 0 end)`.mapWith(Number),
        averageStability: sql<number>`coalesce(avg(${reviewLogs.stability}), 0)`.mapWith(Number),
      })
      .from(reviewLogs)
      .innerJoin(quizItems, eq(quizItems.id, reviewLogs.quizItemId))
      .innerJoin(contentItems, eq(contentItems.id, quizItems.contentItemId))
      .where(eq(reviewLogs.userId, userId))
      .groupBy(contentItems.category)
      .orderBy(desc(sql<number>`count(*)`)),
    getDueReviewCards(db, userId, 100, now),
  ]);

  const completedDates = dailyRows
    .filter(({ totalCount, completedCount }) => totalCount > 0 && completedCount === totalCount)
    .map(({ date }) => date);
  const reviewSummary = reviewSummaryRows[0] ?? { reviewCount: 0, successfulCount: 0 };
  const streak = calculateLearningStreak(completedDates, today);
  const dayMap = new Map(dailyRows.map((row) => [row.date, row]));
  const activity = Array.from({ length: PROFILE_ACTIVITY_DAYS }, (_, index) => {
    const date = shiftDateKey(today, index - (PROFILE_ACTIVITY_DAYS - 1));
    const row = dayMap.get(date);
    const totalCount = row?.totalCount ?? 0;
    const completedCount = row?.completedCount ?? 0;
    return {
      date,
      totalCount,
      completedCount,
      isComplete: totalCount > 0 && completedCount === totalCount,
    };
  });

  return {
    userId,
    today,
    preferences: preferenceRows[0]?.categories ?? [],
    report: {
      currentStreak: streak.current,
      longestStreak: streak.longest,
      completedDays: completedDates.length,
      learnedCount: learningCountRows[0]?.count ?? 0,
      reviewCount: reviewSummary.reviewCount,
      memorySuccessRate: percentage(reviewSummary.successfulCount, reviewSummary.reviewCount),
      dueCount: dueCards.length,
      savedCount: savedCountRows[0]?.count ?? 0,
    },
    activity,
    categoryStats: categoryRows.map((row) => ({
      category: row.category,
      reviewCount: row.reviewCount,
      memorySuccessRate: percentage(row.successfulCount, row.reviewCount),
      averageStability: Math.round(row.averageStability * 10) / 10,
    })),
    savedItems: savedRows.map((row) => ({
      ...row,
      savedAt: row.savedAt.toISOString(),
    })),
  };
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}
