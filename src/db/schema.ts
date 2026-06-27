import { index, sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Placeholder shape; Phase 5 regenerates this via `better-auth` CLI to match its session/account tables.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // "ai_trivia": no external raw source - Gemini generates from its own knowledge (history/humor/
  // social_skills). url is a synthetic internal:// id for these, used only for bookkeeping.
  originType: text("origin_type", { enum: ["gov", "news", "youtube", "ai_trivia"] }).notNull(),
  url: text("url").notNull(),
  lastFetchedAt: integer("last_fetched_at", { mode: "timestamp" }),
});

export interface ContentCard {
  heading: string;
  body: string;
}

export const contentItems = sqliteTable("content_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: integer("source_id").references(() => sources.id),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  // Card-news style slides (3-5 short heading+body pairs) for skimmable rendering; null for
  // content ingested before this column existed.
  cards: text("cards", { mode: "json" }).$type<ContentCard[]>(),
  category: text("category", {
    enum: ["finance", "housing", "seoul_life", "daily_tips", "history", "humor", "social_skills"],
  }).notNull(),
  // Nullable: ai_trivia content has no real external article to cite. The frontend shows an
  // "AI가 정리한 상식" badge instead of a citation link when this is null.
  citationUrl: text("citation_url"),
  citationLabel: text("citation_label").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const quizItems = sqliteTable("quiz_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contentItemId: integer("content_item_id")
    .notNull()
    .references(() => contentItems.id),
  question: text("question").notNull(),
  choices: text("choices", { mode: "json" }).notNull().$type<string[]>(),
  answer: text("answer").notNull(),
});

export const reviewLogs = sqliteTable(
  "review_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    quizItemId: integer("quiz_item_id")
      .notNull()
      .references(() => quizItems.id),
    rating: integer("rating").notNull().default(0),
    state: integer("state").notNull().default(0),
    stability: real("stability").notNull(),
    difficulty: real("difficulty").notNull(),
    due: integer("due", { mode: "timestamp" }).notNull(),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    lastReview: integer("last_review", { mode: "timestamp" }),
  },
  (table) => [
    index("review_logs_user_quiz_idx").on(table.userId, table.quizItemId),
    index("review_logs_user_due_idx").on(table.userId, table.due),
  ],
);

export const chatUsage = sqliteTable(
  "chat_usage",
  {
    key: text("key").primaryKey(),
    identityHash: text("identity_hash").notNull(),
    windowStartedAt: integer("window_started_at", { mode: "timestamp" }).notNull(),
    requestCount: integer("request_count").notNull().default(1),
  },
  (table) => [index("chat_usage_window_idx").on(table.windowStartedAt)],
);
