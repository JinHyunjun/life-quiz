import { Hono } from "hono";
import { desc, eq, lt } from "drizzle-orm";
import { createDb, schema, type AppDb } from "./db";
import { answerChat, generateArticleAndQuiz, generateTrivia, type ChatMessage } from "./gemini";
import { fetchAptTransactions, fetchTrashInfo, flattenRowsToText, type AptTransactionRow } from "./fetchers/gov";
import { fetchRssFeed } from "./fetchers/rss";
import { searchRecentYoutubeVideos } from "./fetchers/youtube";

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  // data.go.kr actually issues one shared account-wide serviceKey reused across all approved
  // datasets (confirmed by comparing the values on each dataset's detail page). Kept as separate
  // secrets per dataset anyway in case that policy ever changes per-dataset.
  DATA_GO_KR_KEY_TRASH: string;
  DATA_GO_KR_KEY_LOAN: string;
  DATA_GO_KR_KEY_APT_SALE: string;
  DATA_GO_KR_KEY_APT_RENT: string;
  YOUTUBE_API_KEY: string;
}

type TriviaCategory = "history" | "humor" | "social_skills" | "daily_tips";

type PendingItem =
  | { kind: "sourced"; url: string; originType: "gov" | "news" | "youtube"; citationLabel: string; sourceText: string }
  | { kind: "trivia"; category: TriviaCategory; citationLabel: string };

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

app.post("/internal/chat", async (c) => {
  if (c.req.header("x-life-quiz-service") !== "chat") {
    return c.json({ error: "Not found" }, 404);
  }

  const payload = parseInternalChatPayload(await c.req.json<unknown>());
  const db = createDb(c.env.DB);
  const contextItems = await loadChatContext(db, payload.contentItemId);
  const generated = await answerChat({
    messages: payload.messages,
    contextItems,
    apiKey: c.env.GEMINI_API_KEY,
    model: c.env.GEMINI_MODEL,
  });
  const citedIds = new Set(generated.citedContentIds);

  return c.json({
    answer: generated.answer,
    suggestions: generated.suggestions,
    sources: contextItems
      .filter((item) => citedIds.has(item.id))
      .map(({ id, title, citationLabel, citationUrl }) => ({ id, title, citationLabel, citationUrl })),
  });
});

// Service-binding-only trigger used by local maintenance tooling and future admin workflows.
app.post("/internal/trigger", async (c) => {
  if (c.req.header("x-life-quiz-service") !== "ingest") {
    return c.json({ error: "Not found" }, 404);
  }
  const result = await runIngestion(c.env);
  return c.json(result);
});

app.onError((error, c) => {
  console.error(JSON.stringify({
    message: "ingest worker request failed",
    path: c.req.path,
    error: error instanceof Error ? error.message : String(error),
  }));
  return c.json({ error: "Internal service error" }, 500);
});

function parseInternalChatPayload(value: unknown): { messages: ChatMessage[]; contentItemId?: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid chat payload");
  }

  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.messages) || candidate.messages.length < 1 || candidate.messages.length > 8) {
    throw new Error("Invalid chat messages");
  }

  const messages = candidate.messages.map((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) throw new Error("Invalid chat message");
    const entry = message as Record<string, unknown>;
    if ((entry.role !== "user" && entry.role !== "assistant") || typeof entry.text !== "string") {
      throw new Error("Invalid chat message");
    }
    return { role: entry.role, text: entry.text.slice(0, 800) } satisfies ChatMessage;
  });

  const contentItemId = candidate.contentItemId === undefined ? undefined : Number(candidate.contentItemId);
  if (contentItemId !== undefined && (!Number.isInteger(contentItemId) || contentItemId < 1)) {
    throw new Error("Invalid content item id");
  }

  return { messages, contentItemId };
}

async function loadChatContext(db: AppDb, contentItemId?: number) {
  const selectFields = {
    id: schema.contentItems.id,
    title: schema.contentItems.title,
    bodyMd: schema.contentItems.bodyMd,
    citationLabel: schema.contentItems.citationLabel,
    citationUrl: schema.contentItems.citationUrl,
  };

  if (contentItemId) {
    const selected = await db.select(selectFields).from(schema.contentItems).where(eq(schema.contentItems.id, contentItemId)).limit(1);
    if (selected.length > 0) return selected;
  }

  const recent = await db
    .select(selectFields)
    .from(schema.contentItems)
    .orderBy(desc(schema.contentItems.createdAt))
    .limit(6);

  return recent.map((item) => ({ ...item, bodyMd: item.bodyMd.slice(0, 1_200) }));
}

async function collectPendingItems(env: Env): Promise<PendingItem[]> {
  const items: PendingItem[] = [];

  const rss = await fetchRssFeed("https://www.hankyung.com/feed/economy").catch(() => []);
  for (const item of rss.slice(0, 3)) {
    items.push({
      kind: "sourced",
      url: item.link,
      originType: "news",
      citationLabel: "한국경제",
      sourceText: `${item.title}\n\n${item.summary}`,
    });
  }

  const youtubeQuery = youtubeQueryForCurrentKstSlot();
  const youtube = await searchRecentYoutubeVideos({
    query: youtubeQuery,
    apiKey: env.YOUTUBE_API_KEY,
    maxResults: 2,
  }).catch(() => []);
  for (const video of youtube) {
    items.push({
      kind: "sourced",
      url: video.watchUrl,
      originType: "youtube",
      citationLabel: `유튜브 - ${video.channelTitle}`,
      sourceText: `${video.title}\n\n${video.description}\n\n게시일: ${video.publishedAt}\n검색 주제: ${youtubeQuery}`,
    });
  }

  const aptJobs: { kind: "rent" | "sale"; key: string; label: string }[] = [
    { kind: "rent", key: env.DATA_GO_KR_KEY_APT_RENT, label: "국토교통부 아파트 전월세 실거래가" },
    { kind: "sale", key: env.DATA_GO_KR_KEY_APT_SALE, label: "국토교통부 아파트 매매 실거래가" },
  ];
  const lawdCd = "11110"; // Seoul Jongno-gu, used as the MVP default region.
  const dealYmd = previousYearMonth();

  for (const job of aptJobs) {
    try {
      const { url, rows } = await fetchAptTransactions(job.kind, job.key, lawdCd, dealYmd);
      if (rows.length === 0) continue;
      items.push({
        kind: "sourced",
        url,
        originType: "gov",
        citationLabel: job.label,
        sourceText: summarizeAptRows(job.kind, rows),
      });
    } catch {
      // Skip this source for this run; next scheduled run will retry.
    }
  }

  const sggName = "종로구"; // Seoul Jongno-gu, used as the MVP default region.
  try {
    const { url, rows } = await fetchTrashInfo(env.DATA_GO_KR_KEY_TRASH, sggName);
    if (rows.length > 0) {
      items.push({
        kind: "sourced",
        url,
        originType: "gov",
        citationLabel: "행정안전부 생활쓰레기배출정보 조회서비스",
        sourceText: `서울 종로구 생활쓰레기 배출 안내:\n${flattenRowsToText(rows.slice(0, 5))}`,
      });
    }
  } catch {
    // Skip this source for this run; next scheduled run will retry.
  }

  // No external data source for these - Gemini generates from its own knowledge (see gemini.ts
  // TRIVIA_PROMPTS). One per category per run keeps daily Gemini calls within the free tier.
  const triviaCategories: { category: TriviaCategory; label: string }[] = [
    { category: "history", label: "AI가 정리한 역사 상식" },
    { category: "humor", label: "AI가 정리한 유머 상식" },
    { category: "social_skills", label: "AI가 정리한 사회성·매너 상식" },
    { category: "daily_tips", label: "AI가 정리한 생활 꿀팁" },
  ];
  for (const job of triviaCategories) {
    items.push({ kind: "trivia", category: job.category, citationLabel: job.label });
  }

  return items;
}

function youtubeQueryForCurrentKstSlot(now = new Date()) {
  const queries = [
    "사회초년생 금융 상식",
    "서울 자취 생활 팁",
    "청년 주거 정책",
    "직장생활 매너 대화법",
  ];
  const kstHour = new Date(now.getTime() + 9 * 60 * 60 * 1_000).getUTCHours();
  return queries[Math.floor(kstHour / 6) % queries.length];
}

function summarizeAptRows(kind: "rent" | "sale", rows: AptTransactionRow[]) {
  const lines = rows.slice(0, 10).map((row) => {
    const price = kind === "rent" ? `보증금 ${row.deposit}만원` : `거래금액 ${row.dealAmount}만원`;
    return `${row.umdNm} ${row.aptNm} | 전용 ${row.excluUseAr}㎡ | ${price} | ${row.dealYear}-${row.dealMonth}-${row.dealDay}`;
  });
  return `서울 종로구 ${kind === "rent" ? "전월세" : "매매"} 실거래가 최근 내역:\n${lines.join("\n")}`;
}

// Real-estate transaction reports typically lag ~1 month, so the current month rarely has data yet.
function previousYearMonth() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function isAlreadyIngested(db: AppDb, url: string) {
  const [existing] = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.url, url)).limit(1);
  return Boolean(existing);
}

async function recentTitlesForCategory(db: AppDb, category: TriviaCategory, limit = 15) {
  const rows = await db
    .select({ title: schema.contentItems.title })
    .from(schema.contentItems)
    .where(eq(schema.contentItems.category, category))
    .orderBy(desc(schema.contentItems.createdAt))
    .limit(limit);
  return rows.map((r) => r.title);
}

async function ingestSourcedItem(db: AppDb, env: Env, item: Extract<PendingItem, { kind: "sourced" }>) {
  const generated = await generateArticleAndQuiz({
    sourceText: item.sourceText,
    citationLabel: item.citationLabel,
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
  });

  const [source] = await db
    .insert(schema.sources)
    .values({ originType: item.originType, url: item.url, lastFetchedAt: new Date() })
    .returning();

  return insertContentAndQuiz(db, {
    sourceId: source.id,
    title: generated.title,
    bodyMd: generated.bodyMd,
    cards: generated.cards,
    category: generated.category,
    citationUrl: item.url,
    citationLabel: item.citationLabel,
    question: generated.question,
    choices: generated.choices,
    answer: generated.answer,
  });
}

async function ingestTriviaItem(db: AppDb, env: Env, item: Extract<PendingItem, { kind: "trivia" }>) {
  const avoidTitles = await recentTitlesForCategory(db, item.category);
  const generated = await generateTrivia({
    category: item.category,
    avoidTitles,
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
  });

  const [source] = await db
    .insert(schema.sources)
    .values({ originType: "ai_trivia", url: `internal://trivia/${item.category}/${crypto.randomUUID()}`, lastFetchedAt: new Date() })
    .returning();

  return insertContentAndQuiz(db, {
    sourceId: source.id,
    title: generated.title,
    bodyMd: generated.bodyMd,
    cards: generated.cards,
    category: item.category,
    citationUrl: null,
    citationLabel: item.citationLabel,
    question: generated.question,
    choices: generated.choices,
    answer: generated.answer,
  });
}

async function insertContentAndQuiz(
  db: AppDb,
  params: {
    sourceId: number;
    title: string;
    bodyMd: string;
    cards: { heading: string; body: string }[];
    category: string;
    citationUrl: string | null;
    citationLabel: string;
    question: string;
    choices: string[];
    answer: string;
  },
) {
  const [contentItem] = await db
    .insert(schema.contentItems)
    .values({
      sourceId: params.sourceId,
      title: params.title,
      bodyMd: params.bodyMd,
      cards: params.cards,
      category: params.category as (typeof schema.contentItems.$inferInsert)["category"],
      citationUrl: params.citationUrl,
      citationLabel: params.citationLabel,
      createdAt: new Date(),
    })
    .returning();

  await db.insert(schema.quizItems).values({
    contentItemId: contentItem.id,
    question: params.question,
    choices: params.choices,
    answer: params.answer,
  });

  return { contentItemId: contentItem.id, title: params.title };
}

async function runIngestion(env: Env) {
  const db = createDb(env.DB);
  const pending = await collectPendingItems(env);
  const created: { contentItemId: number; title: string }[] = [];
  const skipped: string[] = [];
  const failed: { item: string; error: string }[] = [];

  for (const item of pending) {
    const label = item.kind === "sourced" ? item.url : `trivia:${item.category}`;

    if (item.kind === "sourced" && (await isAlreadyIngested(db, item.url))) {
      skipped.push(label);
      continue;
    }

    try {
      created.push(item.kind === "sourced" ? await ingestSourcedItem(db, env, item) : await ingestTriviaItem(db, env, item));
    } catch (err) {
      failed.push({ item: label, error: String(err) });
    }
  }

  return { created, skipped, failed };
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env) {
    const result = await runIngestion(env);
    const db = createDb(env.DB);
    const expiry = new Date(Date.now() - 48 * 60 * 60 * 1_000);
    await db.delete(schema.chatUsage).where(lt(schema.chatUsage.windowStartedAt, expiry));
    console.log(JSON.stringify({ message: "scheduled ingestion completed", ...result }));
  },
};
