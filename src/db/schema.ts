import { index, uniqueIndex, sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import type { ReleaseFeed } from "../lib/releases";

// Placeholder shape; Phase 5 regenerates this via `better-auth` CLI to match its session/account tables.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const sources = sqliteTable(
  "sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // "ai_trivia": curated evergreen content. Glossaries use a curriculum key and general
    // knowledge articles store the external source URL used to ground Gemini.
    originType: text("origin_type", { enum: ["gov", "news", "youtube", "ai_trivia"] }).notNull(),
    url: text("url").notNull(),
    lastFetchedAt: integer("last_fetched_at", { mode: "timestamp" }),
  },
  (table) => [uniqueIndex("sources_url_unique").on(table.url)],
);

export interface ContentCard {
  heading: string;
  body: string;
  visual?: ContentVisualCue;
}

export type ContentVisualCue =
  | "wallet"
  | "bank"
  | "coins"
  | "chart"
  | "card"
  | "calculator"
  | "shield"
  | "home"
  | "key"
  | "contract"
  | "search"
  | "alert";

export const contentItems = sqliteTable(
  "content_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id").references(() => sources.id),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    // Card-news slides (four distinct heading+body pairs) for skimmable rendering; null for
    // content ingested before this column existed.
    cards: text("cards", { mode: "json" }).$type<ContentCard[]>(),
    contentFormat: text("content_format", { enum: ["article", "visual_guide"] }).notNull().default("article"),
    category: text("category", {
      enum: ["finance", "investment", "housing", "seoul_life", "daily_tips", "history", "humor", "social_skills"],
    }).notNull(),
    // Nullable: ai_trivia content has no real external article to cite. The frontend shows an
    // "AI가 정리한 상식" badge instead of a citation link when this is null.
    citationUrl: text("citation_url"),
    citationLabel: text("citation_label").notNull(),
    moderationStatus: text("moderation_status", { enum: ["published", "hidden"] })
      .notNull()
      .default("published"),
    moderationReason: text("moderation_reason"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("content_items_created_at_idx").on(table.createdAt),
    index("content_items_category_created_idx").on(table.category, table.createdAt),
    index("content_items_status_category_created_idx").on(table.moderationStatus, table.category, table.createdAt),
  ],
);

export const quizItems = sqliteTable("quiz_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contentItemId: integer("content_item_id")
    .notNull()
    .references(() => contentItems.id),
  question: text("question").notNull(),
  choices: text("choices", { mode: "json" }).notNull().$type<string[]>(),
  answer: text("answer").notNull(),
  explanation: text("explanation")
    .notNull()
    .default("관련 글에서 정답의 근거와 핵심 개념을 다시 확인해보세요."),
});

export const learningItems = sqliteTable(
  "learning_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    contentItemId: integer("content_item_id")
      .notNull()
      .references(() => contentItems.id),
    enrolledAt: integer("enrolled_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("learning_items_user_content_unique").on(table.userId, table.contentItemId),
    index("learning_items_user_enrolled_idx").on(table.userId, table.enrolledAt),
  ],
);

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

export const geminiRequestLog = sqliteTable(
  "gemini_request_log",
  {
    requestId: text("request_id").primaryKey(),
    requestedAtMs: integer("requested_at_ms").notNull(),
    purpose: text("purpose", { enum: ["ingestion", "chat"] }).notNull(),
  },
  (table) => [index("gemini_request_log_requested_at_idx").on(table.requestedAtMs)],
);

export interface IngestionRunCreatedItem {
  contentItemId: number;
  title: string;
}

export interface IngestionRunFailure {
  item: string;
  error: string;
}

export interface IngestionCollectorDiagnostic {
  source: string;
  status: "success" | "empty" | "error";
  candidateCount: number;
  error?: string;
}

export const ingestionRuns = sqliteTable(
  "ingestion_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trigger: text("trigger", { enum: ["scheduled", "manual"] }).notNull(),
    status: text("status", { enum: ["success", "error"] }).notNull(),
    pendingCount: integer("pending_count").notNull().default(0),
    createdCount: integer("created_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    deferredCount: integer("deferred_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    minIntervalMs: integer("min_interval_ms").notNull().default(0),
    maxItems: integer("max_items").notNull().default(0),
    createdItems: text("created_items", { mode: "json" }).notNull().$type<IngestionRunCreatedItem[]>(),
    skippedItems: text("skipped_items", { mode: "json" }).notNull().$type<string[]>(),
    deferredItems: text("deferred_items", { mode: "json" }).notNull().$type<string[]>(),
    failedItems: text("failed_items", { mode: "json" }).notNull().$type<IngestionRunFailure[]>(),
    collectorDiagnostics: text("collector_diagnostics", { mode: "json" }).$type<IngestionCollectorDiagnostic[]>(),
    error: text("error"),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("ingestion_runs_started_at_idx").on(table.startedAt),
    index("ingestion_runs_status_started_idx").on(table.status, table.startedAt),
  ],
);

export const releaseCache = sqliteTable("release_cache", {
  key: text("key").primaryKey(),
  payload: text("payload", { mode: "json" }).notNull().$type<ReleaseFeed>(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});
