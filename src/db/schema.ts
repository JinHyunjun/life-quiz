import { index, uniqueIndex, sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import type { Category } from "../lib/categories";
import type { ReleaseFeed } from "../lib/releases";

// Learning-domain identity. Anonymous browser IDs and authenticated Better Auth IDs both
// point here so learning tables can keep one stable foreign-key boundary.
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
  | "alert"
  | "briefcase"
  | "scale"
  | "lock"
  | "heart";

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
      enum: [
        "finance",
        "investment",
        "housing",
        "seoul_life",
        "career",
        "rights",
        "digital_safety",
        "health",
        "daily_tips",
        "history",
        "humor",
        "social_skills",
      ],
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

export const quizItems = sqliteTable(
  "quiz_items",
  {
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
  },
  (table) => [index("quiz_items_content_item_idx").on(table.contentItemId)],
);

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

export const dailySessionItems = sqliteTable(
  "daily_session_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    kstDate: text("kst_date").notNull(),
    quizItemId: integer("quiz_item_id")
      .notNull()
      .references(() => quizItems.id),
    position: integer("position").notNull(),
    itemType: text("item_type", { enum: ["review", "new"] }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("daily_session_items_user_date_position_unique").on(table.userId, table.kstDate, table.position),
    uniqueIndex("daily_session_items_user_date_quiz_unique").on(table.userId, table.kstDate, table.quizItemId),
    index("daily_session_items_user_date_idx").on(table.userId, table.kstDate),
  ],
);

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  categories: text("categories", { mode: "json" }).notNull().$type<Category[]>(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const authUsers = sqliteTable(
  "auth_user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (table) => [uniqueIndex("auth_user_email_unique").on(table.email)],
);

export const authSessions = sqliteTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    expiresAt: text("expiresAt").notNull(),
    token: text("token").notNull(),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("auth_session_token_unique").on(table.token),
    index("auth_session_user_id_idx").on(table.userId),
    index("auth_session_expires_at_idx").on(table.expiresAt),
  ],
);

export const authAccounts = sqliteTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: text("accessTokenExpiresAt"),
    refreshTokenExpiresAt: text("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (table) => [
    uniqueIndex("auth_account_provider_account_unique").on(table.providerId, table.accountId),
    index("auth_account_user_id_idx").on(table.userId),
  ],
);

export const authVerifications = sqliteTable(
  "auth_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: text("expiresAt").notNull(),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)],
);

export const authRateLimits = sqliteTable(
  "auth_rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: integer("lastRequest").notNull(),
  },
  (table) => [uniqueIndex("auth_rate_limit_key_unique").on(table.key)],
);

export const SUPPORT_REQUEST_CATEGORIES = [
  "account_access",
  "account_data",
  "service_bug",
  "content",
  "suggestion",
  "other",
] as const;

export type SupportRequestCategory = (typeof SUPPORT_REQUEST_CATEGORIES)[number];

export const supportRequests = sqliteTable(
  "support_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").references(() => authUsers.id, { onDelete: "set null" }),
    requesterHash: text("requester_hash").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    category: text("category", { enum: SUPPORT_REQUEST_CATEGORIES }).notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: ["open", "in_progress", "resolved", "dismissed"] }).notNull().default("open"),
    notificationStatus: text("notification_status", { enum: ["pending", "sent", "failed"] })
      .notNull()
      .default("pending"),
    notificationAttemptedAt: integer("notification_attempted_at", { mode: "timestamp" }),
    notificationError: text("notification_error"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  },
  (table) => [
    index("support_requests_status_created_idx").on(table.status, table.createdAt),
    index("support_requests_requester_created_idx").on(table.requesterHash, table.createdAt),
    index("support_requests_email_created_idx").on(table.email, table.createdAt),
  ],
);

export const savedContentItems = sqliteTable(
  "saved_content_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    contentItemId: integer("content_item_id")
      .notNull()
      .references(() => contentItems.id),
    savedAt: integer("saved_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("saved_content_items_user_content_unique").on(table.userId, table.contentItemId),
    index("saved_content_items_user_saved_idx").on(table.userId, table.savedAt),
  ],
);

export const PRODUCT_EVENT_NAMES = [
  "site_visit",
  "login_view",
  "guest_continue",
  "signup_started",
  "auth_failed",
  "home_view",
  "preference_saved",
  "daily_start",
  "first_answer",
  "daily_complete",
  "source_open",
  "content_saved",
  "review_enrolled",
  "chat_asked",
  "account_created",
  "account_signed_in",
  "anonymous_data_linked",
  "support_submitted",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export const productEvents = sqliteTable(
  "product_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    visitorId: text("visitor_id").notNull(),
    eventName: text("event_name", { enum: PRODUCT_EVENT_NAMES }).notNull(),
    path: text("path"),
    contentItemId: integer("content_item_id").references(() => contentItems.id),
    category: text("category"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("product_events_created_name_visitor_idx").on(table.createdAt, table.eventName, table.visitorId),
    index("product_events_visitor_created_idx").on(table.visitorId, table.createdAt),
  ],
);

export type ContentFeedbackKind =
  | "helpful"
  | "hard_to_understand"
  | "duplicate"
  | "outdated"
  | "source_issue"
  | "quiz_issue";

export const contentFeedback = sqliteTable(
  "content_feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contentItemId: integer("content_item_id")
      .notNull()
      .references(() => contentItems.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", {
      enum: ["helpful", "hard_to_understand", "duplicate", "outdated", "source_issue", "quiz_issue"],
    }).notNull(),
    status: text("status", { enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  },
  (table) => [
    uniqueIndex("content_feedback_user_content_kind_unique").on(table.userId, table.contentItemId, table.kind),
    index("content_feedback_status_created_idx").on(table.status, table.createdAt),
    index("content_feedback_content_kind_idx").on(table.contentItemId, table.kind),
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
  category: typeof contentItems.$inferSelect.category;
}

export interface IngestionRunFailure {
  item: string;
  error: string;
}

export interface IngestionQualityGateItem {
  contentItemId: number;
  title: string;
  reasons: string[];
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
    qualityCheckedCount: integer("quality_checked_count").notNull().default(0),
    qualityHiddenCount: integer("quality_hidden_count").notNull().default(0),
    qualityHiddenItems: text("quality_hidden_items", { mode: "json" }).notNull().$type<IngestionQualityGateItem[]>().default([]),
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
