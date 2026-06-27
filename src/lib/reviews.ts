import { and, asc, desc, eq, isNull, lte, max, or, sql } from "drizzle-orm";
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import type { AppDb } from "../db/client";
import { contentItems, quizItems, reviewLogs, users } from "../db/schema";

export const LOCAL_DEV_USER_ID = "local-dev";

const MAX_DUE_LIMIT = 100;

type ReviewLogRow = typeof reviewLogs.$inferSelect;

export class ReviewRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export interface DueReviewCard {
  quizItemId: number;
  contentItemId: number;
  title: string;
  category: "finance" | "housing" | "seoul_life" | "daily_tips" | "history" | "humor" | "social_skills";
  citationUrl: string | null;
  citationLabel: string;
  question: string;
  choices: string[];
  due: string;
  lastReview: string | null;
  isNew: boolean;
  fsrs: {
    state: string | null;
    stability: number | null;
    difficulty: number | null;
    reps: number;
    lapses: number;
  };
}

export interface SubmitReviewInput {
  userId?: string;
  quizItemId: number;
  answer?: string;
  rating?: unknown;
  now?: Date;
}

export async function ensureReviewUser(db: AppDb, userId = LOCAL_DEV_USER_ID) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);

  if (existing) {
    return existing;
  }

  await db
    .insert(users)
    .values({
      id: userId,
      email: `${sanitizeEmailPart(userId)}@local.life-quiz.invalid`,
      name: userId === LOCAL_DEV_USER_ID ? "Local Dev" : null,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  return { id: userId };
}

export async function getDueReviewCards(
  db: AppDb,
  userId = LOCAL_DEV_USER_ID,
  limit = 20,
  now = new Date(),
): Promise<DueReviewCard[]> {
  await ensureReviewUser(db, userId);

  const latestByQuiz = db.$with("latest_by_quiz").as(
    db
      .select({
        quizItemId: reviewLogs.quizItemId,
        latestId: max(reviewLogs.id).as("latest_id"),
      })
      .from(reviewLogs)
      .where(eq(reviewLogs.userId, userId))
      .groupBy(reviewLogs.quizItemId),
  );

  const rows = await db
    .with(latestByQuiz)
    .select({
      quizItemId: quizItems.id,
      contentItemId: contentItems.id,
      title: contentItems.title,
      category: contentItems.category,
      citationUrl: contentItems.citationUrl,
      citationLabel: contentItems.citationLabel,
      question: quizItems.question,
      choices: quizItems.choices,
      due: reviewLogs.due,
      lastReview: reviewLogs.lastReview,
      state: reviewLogs.state,
      stability: reviewLogs.stability,
      difficulty: reviewLogs.difficulty,
      reps: reviewLogs.reps,
      lapses: reviewLogs.lapses,
    })
    .from(quizItems)
    .innerJoin(contentItems, eq(quizItems.contentItemId, contentItems.id))
    .leftJoin(latestByQuiz, eq(latestByQuiz.quizItemId, quizItems.id))
    .leftJoin(reviewLogs, eq(reviewLogs.id, latestByQuiz.latestId))
    .where(or(isNull(reviewLogs.id), lte(reviewLogs.due, now)))
    .orderBy(sql`case when ${reviewLogs.due} is null then 0 else 1 end`, asc(reviewLogs.due), asc(quizItems.id))
    .limit(normalizeLimit(limit));

  return rows.map((row) => ({
    quizItemId: row.quizItemId,
    contentItemId: row.contentItemId,
    title: row.title,
    category: row.category,
    citationUrl: row.citationUrl,
    citationLabel: row.citationLabel,
    question: row.question,
    choices: row.choices,
    due: toRequiredIso(row.due ?? now),
    lastReview: toIso(row.lastReview),
    isNew: row.due === null,
    fsrs: {
      state: row.state === null ? null : State[row.state as State],
      stability: row.stability,
      difficulty: row.difficulty,
      reps: row.reps ?? 0,
      lapses: row.lapses ?? 0,
    },
  }));
}

export async function submitQuizReview(db: AppDb, input: SubmitReviewInput) {
  const userId = input.userId ?? LOCAL_DEV_USER_ID;
  const now = input.now ?? new Date();

  if (!input.answer && input.rating === undefined) {
    throw new ReviewRequestError("Either answer or rating is required.");
  }

  await ensureReviewUser(db, userId);

  const [quiz] = await db
    .select({
      id: quizItems.id,
      answer: quizItems.answer,
    })
    .from(quizItems)
    .where(eq(quizItems.id, input.quizItemId))
    .limit(1);

  if (!quiz) {
    throw new ReviewRequestError("Quiz item was not found.", 404);
  }

  const isCorrect = input.answer === undefined ? null : normalizeAnswer(input.answer) === normalizeAnswer(quiz.answer);
  const rating = normalizeRating(input.rating ?? (isCorrect ? Rating.Good : Rating.Again));

  const [latestReview] = await db
    .select()
    .from(reviewLogs)
    .where(and(eq(reviewLogs.userId, userId), eq(reviewLogs.quizItemId, input.quizItemId)))
    .orderBy(desc(reviewLogs.id))
    .limit(1);

  const currentCard = latestReview ? reviewLogToCard(latestReview) : createEmptyCard(now);
  const scheduler = fsrs();
  const { card: nextCard } = scheduler.next(currentCard, now, rating);

  const [savedReview] = await db
    .insert(reviewLogs)
    .values({
      userId,
      quizItemId: input.quizItemId,
      rating,
      state: nextCard.state,
      stability: nextCard.stability,
      difficulty: nextCard.difficulty,
      due: nextCard.due,
      elapsedDays: nextCard.elapsed_days,
      scheduledDays: nextCard.scheduled_days,
      learningSteps: nextCard.learning_steps,
      reps: nextCard.reps,
      lapses: nextCard.lapses,
      lastReview: nextCard.last_review ?? now,
    })
    .returning();

  return {
    quizItemId: input.quizItemId,
    isCorrect,
    correctAnswer: isCorrect === false ? quiz.answer : undefined,
    rating,
    ratingLabel: Rating[rating],
    due: toIso(savedReview.due),
    fsrs: {
      state: State[savedReview.state as State],
      stability: savedReview.stability,
      difficulty: savedReview.difficulty,
      reps: savedReview.reps,
      lapses: savedReview.lapses,
      scheduledDays: savedReview.scheduledDays,
    },
  };
}

function reviewLogToCard(row: ReviewLogRow): Card {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.lastReview ?? undefined,
  };
}

function normalizeRating(value: unknown): Grade {
  if (typeof value === "number" && value >= Rating.Again && value <= Rating.Easy) {
    return value as Grade;
  }

  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    const rating = {
      again: Rating.Again,
      hard: Rating.Hard,
      good: Rating.Good,
      easy: Rating.Easy,
    }[key];

    if (rating !== undefined) {
      return rating as Grade;
    }
  }

  throw new ReviewRequestError("Rating must be one of Again, Hard, Good, or Easy.");
}

function normalizeLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_DUE_LIMIT);
}

function normalizeAnswer(answer: string) {
  return answer.trim().replace(/\s+/g, " ").toLowerCase();
}

function sanitizeEmailPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._+-]/g, "_").slice(0, 48) || "user";
}

function toIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

function toRequiredIso(date: Date) {
  return date.toISOString();
}
