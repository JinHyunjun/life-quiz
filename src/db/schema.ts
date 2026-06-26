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
  originType: text("origin_type", { enum: ["gov", "news", "youtube"] }).notNull(),
  url: text("url").notNull(),
  lastFetchedAt: integer("last_fetched_at", { mode: "timestamp" }),
});

export const contentItems = sqliteTable("content_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: integer("source_id").references(() => sources.id),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  category: text("category", {
    enum: ["finance", "housing", "seoul_life", "daily_tips"],
  }).notNull(),
  citationUrl: text("citation_url").notNull(),
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
