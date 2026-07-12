import { Hono } from "hono";
import { and, desc, eq, lt } from "drizzle-orm";
import type { ContentCard, IngestionCollectorDiagnostic } from "../../../src/db/schema";
import { createDb, schema, type AppDb } from "./db";
import {
  answerChat,
  generateArticleAndQuiz,
  generateGlossaryGuide,
  generateTrivia,
  type BeforeGeminiRequest,
  type ChatMessage,
} from "./gemini";
import { seoulDistrictsForKstRun } from "./districts";
import {
  classifyNewsForBeginners,
  youtubeEditorialPlansForKstRun,
  type EditorialPlan,
  type SourcedContentCategory,
} from "./editorial";
import { fetchAptTransactions, fetchTrashInfo, flattenRowsToText, type AptTransactionRow } from "./fetchers/gov";
import { fetchRssFeed, type RssItem } from "./fetchers/rss";
import { contentFingerprint } from "./fingerprint";
import type { GlossaryCategory } from "./glossary";
import {
  GeminiRateLimitError,
  normalizeGeminiRpmBudget,
  pruneGeminiRequestLog,
  reserveGeminiRequest,
  type GeminiRequestPurpose,
} from "./rate-limit";
import {
  ingestionPacingDelayMs,
  normalizeIngestionIntervalMs,
  scheduledAiCurriculumBatchForKstRun,
} from "./schedule";
import { searchRecentYoutubeVideos } from "./fetchers/youtube";
import { getReleaseFeed } from "./releases";
import { fetchWikipediaSummary, type TriviaSourceTopic } from "./trivia-sources";

type Env = IngestEnv;

type PendingItem =
  | {
      kind: "sourced";
      url: string;
      dedupeKey: string;
      originType: "gov" | "news" | "youtube";
      citationLabel: string;
      sourceText: string;
      category: SourcedContentCategory;
      editorialFocus: string;
      matchedTerms: string[];
    }
  | { kind: "glossary"; url: string; category: GlossaryCategory; term: string; citationLabel: string; citationUrl: string | null }
  | ({ kind: "trivia" } & TriviaSourceTopic);

type BalancedContentCategory = SourcedContentCategory | TriviaSourceTopic["category"];

const GLOSSARY_SOURCES: Record<GlossaryCategory, { citationLabel: string; citationUrl: string | null }> = {
  finance: {
    citationLabel: "금융감독원 금융교육센터 참고 · AI 재구성",
    citationUrl: "https://www.fss.or.kr/edu/main/main.do",
  },
  investment: {
    citationLabel: "전국투자자교육협의회 참고 · AI 재구성",
    citationUrl: "https://www.kcie.or.kr/yeouitv/howtoList",
  },
  housing: {
    citationLabel: "찾기쉬운 생활법령 주택임대차 참고 · AI 재구성",
    citationUrl: "https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=2&cciNo=2&cnpClsNo=1&csmSeq=629&popMenu=ov",
  },
};

const NEWS_FEEDS = [
  { url: "https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111", citationLabel: "금융위원회 보도자료" },
  { url: "https://www.fsc.go.kr/about/fsc_card_rss/?fid=0411", citationLabel: "금융위원회 카드뉴스" },
] as const;

const CATEGORY_ORDER: readonly BalancedContentCategory[] = [
  "finance",
  "investment",
  "housing",
  "seoul_life",
  "career",
  "rights",
  "social_skills",
  "digital_safety",
  "health",
  "daily_tips",
  "history",
  "humor",
];

const DEFAULT_MAX_INGEST_ITEMS = 12;
const MAX_NEWS_ITEMS_PER_RUN = 6;
const MAX_NEWS_ITEMS_PER_CATEGORY = 2;
const MAX_YOUTUBE_RESULTS_PER_TOPIC = 3;
const MAX_DISTRICTS_PER_BRIEF = 4;

interface CollectionResult {
  items: PendingItem[];
  diagnostics: IngestionCollectorDiagnostic[];
}

function collectorDiagnostic(source: string, candidateCount: number, error?: unknown): IngestionCollectorDiagnostic {
  if (error !== undefined) {
    return {
      source,
      status: "error",
      candidateCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return { source, status: candidateCount > 0 ? "success" : "empty", candidateCount };
}

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

app.get("/internal/releases", async (c) => {
  if (c.req.header("x-life-quiz-service") !== "releases") {
    return c.json({ error: "Not found" }, 404);
  }

  const feed = await getReleaseFeed({
    db: createDb(c.env.DB),
    token: c.env.NOTION_TOKEN,
    pageId: c.env.NOTION_PAGE_ID,
  });
  return c.json(feed);
});

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
    beforeRequest: createGeminiRequestGate(c.env, "chat"),
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
  const startedAt = new Date();
  const db = createDb(c.env.DB);
  const result = await runIngestion(c.env);
  await saveIngestionRun(db, {
    trigger: "manual",
    status: "success",
    result,
    startedAt,
    finishedAt: new Date(),
  });
  return c.json(result);
});

app.onError((error, c) => {
  if (error instanceof GeminiRateLimitError) {
    return c.json(
      { error: "AI 요청이 잠시 몰렸습니다. 잠시 후 다시 시도해주세요." },
      429,
      { "retry-after": String(error.retryAfterSeconds) },
    );
  }

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
    const selected = await db
      .select(selectFields)
      .from(schema.contentItems)
      .where(and(
        eq(schema.contentItems.id, contentItemId),
        eq(schema.contentItems.moderationStatus, "published"),
      ))
      .limit(1);
    if (selected.length > 0) return selected;
  }

  const recent = await db
    .select(selectFields)
    .from(schema.contentItems)
    .where(eq(schema.contentItems.moderationStatus, "published"))
    .orderBy(desc(schema.contentItems.createdAt))
    .limit(6);

  return recent.map((item) => ({ ...item, bodyMd: item.bodyMd.slice(0, 1_200) }));
}

async function collectPendingItems(env: Env): Promise<CollectionResult> {
  const items: PendingItem[] = [];
  const diagnostics: IngestionCollectorDiagnostic[] = [];
  const now = new Date();

  const rssCollections = await Promise.all(
    NEWS_FEEDS.map(async (feed) => {
      try {
        const rss = await fetchRssFeed(feed.url);
        const candidates = rss.flatMap((item) => {
          const plan = classifyNewsForBeginners(item.title, item.summary);
          return plan ? [{ item, plan, citationLabel: feed.citationLabel }] : [];
        });
        return {
          candidates,
          diagnostic: collectorDiagnostic(`rss:${feed.citationLabel}`, candidates.length),
        };
      } catch (error) {
        return {
          candidates: [] as Array<{ item: RssItem; plan: EditorialPlan; citationLabel: string }>,
          diagnostic: collectorDiagnostic(`rss:${feed.citationLabel}`, 0, error),
        };
      }
    }),
  );
  diagnostics.push(...rssCollections.map(({ diagnostic }) => diagnostic));
  const newsCandidates = interleaveCandidates(rssCollections.map(({ candidates }) => candidates));
  for (const { item, plan, citationLabel } of selectBalancedNews(newsCandidates)) {
    items.push({
      kind: "sourced",
      url: item.link,
      dedupeKey: item.link,
      originType: "news",
      citationLabel,
      sourceText: `${item.title}\n\n${item.summary}`,
      category: plan.category,
      editorialFocus: plan.focus,
      matchedTerms: plan.matchedTerms,
    });
  }

  for (const youtubePlan of youtubeEditorialPlansForKstRun(now)) {
    let youtube;
    try {
      youtube = await searchRecentYoutubeVideos({
        query: youtubePlan.query,
        apiKey: env.YOUTUBE_API_KEY,
        maxResults: MAX_YOUTUBE_RESULTS_PER_TOPIC,
      });
      diagnostics.push(collectorDiagnostic(`youtube:${youtubePlan.category}`, youtube.length));
    } catch (error) {
      diagnostics.push(collectorDiagnostic(`youtube:${youtubePlan.category}`, 0, error));
      continue;
    }
    for (const video of youtube) {
      items.push({
        kind: "sourced",
        url: video.watchUrl,
        dedupeKey: video.watchUrl,
        originType: "youtube",
        citationLabel: `유튜브 - ${video.channelTitle}`,
        sourceText: `${video.title}\n\n${video.description}\n\n게시일: ${video.publishedAt}\n검색 주제: ${youtubePlan.query}`,
        category: youtubePlan.category,
        editorialFocus: youtubePlan.focus,
        matchedTerms: youtubePlan.matchedTerms,
      });
    }
  }

  const aptJobs: { kind: "rent" | "sale"; key: string; label: string }[] = [
    { kind: "rent", key: env.DATA_GO_KR_KEY_APT_RENT, label: "국토교통부 아파트 전월세 실거래가" },
    { kind: "sale", key: env.DATA_GO_KR_KEY_APT_SALE, label: "국토교통부 아파트 매매 실거래가" },
  ];
  const districts = seoulDistrictsForKstRun(now, MAX_DISTRICTS_PER_BRIEF);
  const dealYmd = previousYearMonth(now);

  for (const job of aptJobs) {
    const results = await Promise.all(districts.map(async (district) => {
      try {
        const { url, rows } = await fetchAptTransactions(job.kind, job.key, district.lawdCd, dealYmd);
        return {
          snapshot: rows.length > 0 ? { district, url, rows } : null,
          diagnostic: collectorDiagnostic(`gov:apt-${job.kind}:${district.name}`, rows.length),
        };
      } catch (error) {
        return {
          snapshot: null,
          diagnostic: collectorDiagnostic(`gov:apt-${job.kind}:${district.name}`, 0, error),
        };
      }
    }));
    diagnostics.push(...results.map(({ diagnostic }) => diagnostic));
    const snapshots = results.flatMap(({ snapshot }) => snapshot ? [snapshot] : []);
    if (snapshots.length === 0) continue;

    const sourceText = summarizeAptDistricts(job.kind, snapshots);
    const districtNames = snapshots.map(({ district }) => district.name);
    const sourceUrl = snapshots[0].url;
    items.push({
      kind: "sourced",
      url: sourceUrl,
      dedupeKey: `${sourceUrl}#district-brief=${await contentFingerprint(sourceText)}`,
      originType: "gov",
      citationLabel: `${job.label} · ${districtNames.join("·")} 비교`,
      sourceText,
      category: "housing",
      editorialFocus: `${districtNames.join(", ")}의 거래를 한 건씩 나열하지 말고 자치구 비교 브리핑으로 구성하세요. 가격을 단정적으로 평가하지 말고 면적, 거래 유형, 계약 시점과 예산 확인 기준의 차이를 설명하세요. 제목에 비교한 자치구를 자연스럽게 드러내세요.`,
      matchedTerms: ["자치구 비교", "실거래가", job.kind === "rent" ? "전월세" : "매매", "계약"],
    });
  }

  const trashResults = await Promise.all(districts.map(async (district) => {
    try {
      const { url, rows } = await fetchTrashInfo(env.DATA_GO_KR_KEY_TRASH, district.name);
      return {
        snapshot: rows.length > 0 ? { district, url, rows } : null,
        diagnostic: collectorDiagnostic(`gov:trash:${district.name}`, rows.length),
      };
    } catch (error) {
      return {
        snapshot: null,
        diagnostic: collectorDiagnostic(`gov:trash:${district.name}`, 0, error),
      };
    }
  }));
  diagnostics.push(...trashResults.map(({ diagnostic }) => diagnostic));
  const trashSnapshots = trashResults.flatMap(({ snapshot }) => snapshot ? [snapshot] : []);
  if (trashSnapshots.length > 0) {
    const sourceText = trashSnapshots
      .map(({ district, rows }) => `서울 ${district.name} 생활쓰레기 배출 안내:\n${flattenRowsToText(rows.slice(0, 4))}`)
      .join("\n\n");
    const districtNames = trashSnapshots.map(({ district }) => district.name);
    const sourceUrl = trashSnapshots[0].url;
    items.push({
      kind: "sourced",
      url: sourceUrl,
      dedupeKey: `${sourceUrl}#district-brief=${await contentFingerprint(sourceText)}`,
      originType: "gov",
      citationLabel: `행정안전부 생활쓰레기배출정보 · ${districtNames.join("·")} 비교`,
      sourceText,
      category: "seoul_life",
      editorialFocus: `${districtNames.join(", ")}의 정보를 자치구별 카드로 반복하지 말고 한 번에 비교할 수 있는 생활 브리핑으로 구성하세요. 공통 규칙과 구별 차이, 이사 직후 확인할 행동을 구분해서 설명하세요.`,
      matchedTerms: ["자치구 비교", "생활쓰레기", "배출", "요일", "품목"],
    });
  }

  const scheduledCurriculum = scheduledAiCurriculumBatchForKstRun(now);
  for (const topic of scheduledCurriculum.glossary) {
    const source = GLOSSARY_SOURCES[topic.category];
    items.push({
      kind: "glossary",
      url: topic.url,
      category: topic.category,
      term: topic.term,
      citationLabel: source.citationLabel,
      citationUrl: source.citationUrl,
    });
  }

  for (const trivia of scheduledCurriculum.trivia) {
    items.push({ kind: "trivia", ...trivia });
  }
  diagnostics.push(collectorDiagnostic("curriculum:glossary", scheduledCurriculum.glossary.length));
  diagnostics.push(collectorDiagnostic("curriculum:trivia", scheduledCurriculum.trivia.length));

  return { items: sortPendingItemsByCategory(items), diagnostics };
}

function selectBalancedNews(candidates: Array<{ item: RssItem; plan: EditorialPlan; citationLabel: string }>) {
  const selected: typeof candidates = [];
  const counts = new Map<SourcedContentCategory, number>();

  for (const candidate of candidates) {
    const count = counts.get(candidate.plan.category) ?? 0;
    if (count >= MAX_NEWS_ITEMS_PER_CATEGORY) continue;
    selected.push(candidate);
    counts.set(candidate.plan.category, count + 1);
    if (selected.length >= MAX_NEWS_ITEMS_PER_RUN) return selected;
  }

  for (const candidate of candidates) {
    if (selected.includes(candidate)) continue;
    selected.push(candidate);
    if (selected.length >= MAX_NEWS_ITEMS_PER_RUN) break;
  }

  return selected;
}

function interleaveCandidates<T>(groups: readonly T[][]) {
  const interleaved: T[] = [];
  const maxLength = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < maxLength; index += 1) {
    for (const group of groups) {
      if (group[index]) interleaved.push(group[index]);
    }
  }
  return interleaved;
}

function sortPendingItemsByCategory(items: PendingItem[]) {
  const buckets = new Map<BalancedContentCategory, PendingItem[]>();
  for (const item of items) {
    const category = pendingItemCategory(item);
    const bucket = buckets.get(category) ?? [];
    bucket.push(item);
    buckets.set(category, bucket);
  }

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => pendingKindPriority(a) - pendingKindPriority(b));
  }

  const sorted: PendingItem[] = [];
  let consumed = 0;
  while (consumed < items.length) {
    const before = consumed;
    for (const category of CATEGORY_ORDER) {
      const next = buckets.get(category)?.shift();
      if (!next) continue;
      sorted.push(next);
      consumed += 1;
    }
    if (consumed === before) break;
  }

  return sorted.concat([...buckets.values()].flat());
}

function pendingItemCategory(item: PendingItem): BalancedContentCategory {
  if (item.kind === "trivia") return item.category;
  return item.category;
}

function pendingKindPriority(item: PendingItem) {
  if (item.kind === "sourced") return 0;
  if (item.kind === "glossary") return 1;
  return 2;
}

function summarizeAptDistricts(
  kind: "rent" | "sale",
  snapshots: Array<{ district: { name: string }; rows: AptTransactionRow[] }>,
) {
  const sections = snapshots.map(({ district, rows }) => {
    const lines = rows.slice(0, 4).map((row) => {
      const price = kind === "rent"
        ? `보증금 ${row.deposit}만원${row.monthlyRent && row.monthlyRent !== "0" ? ` · 월세 ${row.monthlyRent}만원` : ""}`
        : `거래금액 ${row.dealAmount}만원`;
      return `${row.umdNm} ${row.aptNm} | 전용 ${row.excluUseAr}㎡ | ${price} | ${row.dealYear}-${row.dealMonth}-${row.dealDay}`;
    });
    return `[${district.name}]\n${lines.join("\n")}`;
  });
  return `서울 자치구 ${kind === "rent" ? "전월세" : "매매"} 실거래가 비교 자료:\n\n${sections.join("\n\n")}`;
}

// Real-estate transaction reports typically lag ~1 month, so the current month rarely has data yet.
function previousYearMonth(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1_000);
  const previous = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - 1, 1));
  return `${previous.getUTCFullYear()}${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

function createGeminiRequestGate(env: Env, purpose: GeminiRequestPurpose): BeforeGeminiRequest {
  const maxRequests = normalizeGeminiRpmBudget(Number(env.GEMINI_RPM_BUDGET));
  return () => reserveGeminiRequest(env.DB, { purpose, maxRequests }).then(() => undefined);
}

function normalizeIngestionBatchLimit(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 4), 24) : DEFAULT_MAX_INGEST_ITEMS;
}

async function isAlreadyIngested(db: AppDb, url: string) {
  const [existing] = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.url, url)).limit(1);
  return Boolean(existing);
}

async function recentTitlesForCategory(
  db: AppDb,
  category: (typeof schema.contentItems.$inferSelect)["category"],
  limit = 15,
) {
  const rows = await db
    .select({ title: schema.contentItems.title })
    .from(schema.contentItems)
    .where(and(
      eq(schema.contentItems.category, category),
      eq(schema.contentItems.moderationStatus, "published"),
    ))
    .orderBy(desc(schema.contentItems.createdAt))
    .limit(limit);
  return rows.map((r) => r.title);
}

async function ingestSourcedItem(
  db: AppDb,
  env: Env,
  item: Extract<PendingItem, { kind: "sourced" }>,
  beforeRequest: BeforeGeminiRequest,
) {
  const avoidTitles = await recentTitlesForCategory(db, item.category);
  const generated = await generateArticleAndQuiz({
    sourceText: item.sourceText,
    citationLabel: item.citationLabel,
    category: item.category,
    editorialFocus: item.editorialFocus,
    matchedTerms: item.matchedTerms,
    avoidTitles,
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    beforeRequest,
  });

  const [source] = await db
    .insert(schema.sources)
    .values({ originType: item.originType, url: item.dedupeKey, lastFetchedAt: new Date() })
    .returning();

  return insertContentAndQuiz(db, {
    sourceId: source.id,
    title: generated.title,
    bodyMd: generated.bodyMd,
    cards: generated.cards,
    contentFormat: "article",
    category: generated.category,
    citationUrl: item.url,
    citationLabel: item.citationLabel,
    question: generated.question,
    choices: generated.choices,
    answer: generated.answer,
    explanation: generated.explanation,
  });
}

async function ingestGlossaryItem(
  db: AppDb,
  env: Env,
  item: Extract<PendingItem, { kind: "glossary" }>,
  beforeRequest: BeforeGeminiRequest,
) {
  const avoidTitles = await recentTitlesForCategory(db, item.category);
  const generated = await generateGlossaryGuide({
    category: item.category,
    term: item.term,
    avoidTitles,
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    beforeRequest,
  });

  const [source] = await db
    .insert(schema.sources)
    .values({ originType: "ai_trivia", url: item.url, lastFetchedAt: new Date() })
    .returning();

  return insertContentAndQuiz(db, {
    sourceId: source.id,
    title: generated.title,
    bodyMd: generated.bodyMd,
    cards: generated.cards,
    contentFormat: "visual_guide",
    category: item.category,
    citationUrl: item.citationUrl,
    citationLabel: item.citationLabel,
    question: generated.question,
    choices: generated.choices,
    answer: generated.answer,
    explanation: generated.explanation,
  });
}

async function ingestTriviaItem(
  db: AppDb,
  env: Env,
  item: Extract<PendingItem, { kind: "trivia" }>,
  beforeRequest: BeforeGeminiRequest,
) {
  let sourceMaterial: Awaited<ReturnType<typeof fetchWikipediaSummary>>;
  let useUrlContext = false;
  try {
    sourceMaterial = await fetchWikipediaSummary(item);
  } catch {
    useUrlContext = true;
    sourceMaterial = {
      title: item.wikipediaTitle,
      extract: "",
      url: item.sourceUrl,
      citationLabel: `위키백과 '${item.wikipediaTitle}' · CC BY-SA · Gemini URL Context 확인`,
    };
  }
  const generated = await generateTrivia({
    category: item.category,
    topic: item.topic,
    sourceText: sourceMaterial.extract,
    citationLabel: sourceMaterial.citationLabel,
    sourceUrl: sourceMaterial.url,
    useUrlContext,
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    beforeRequest,
  });

  const [source] = await db
    .insert(schema.sources)
    .values({ originType: "ai_trivia", url: item.sourceUrl, lastFetchedAt: new Date() })
    .returning();

  return insertContentAndQuiz(db, {
    sourceId: source.id,
    title: generated.title,
    bodyMd: generated.bodyMd,
    cards: generated.cards,
    contentFormat: "article",
    category: item.category,
    citationUrl: sourceMaterial.url,
    citationLabel: sourceMaterial.citationLabel,
    question: generated.question,
    choices: generated.choices,
    answer: generated.answer,
    explanation: generated.explanation,
  });
}

async function insertContentAndQuiz(
  db: AppDb,
  params: {
    sourceId: number;
    title: string;
    bodyMd: string;
    cards: ContentCard[];
    contentFormat: "article" | "visual_guide";
    category: string;
    citationUrl: string | null;
    citationLabel: string;
    question: string;
    choices: string[];
    answer: string;
    explanation: string;
  },
) {
  const [contentItem] = await db
    .insert(schema.contentItems)
    .values({
      sourceId: params.sourceId,
      title: params.title,
      bodyMd: params.bodyMd,
      cards: params.cards,
      contentFormat: params.contentFormat,
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
    explanation: params.explanation,
  });

  return { contentItemId: contentItem.id, title: params.title };
}

async function runIngestion(env: Env) {
  const db = createDb(env.DB);
  const collection = await collectPendingItems(env);
  const pending = collection.items;
  const beforeRequest = createGeminiRequestGate(env, "ingestion");
  const minIntervalMs = normalizeIngestionIntervalMs(Number(env.GEMINI_INGEST_MIN_INTERVAL_MS));
  const maxItems = normalizeIngestionBatchLimit(Number(env.GEMINI_INGEST_MAX_ITEMS));
  const created: { contentItemId: number; title: string }[] = [];
  const skipped: string[] = [];
  const deferred: string[] = [];
  const failed: { item: string; error: string }[] = [];
  let lastStartedAtMs = 0;

  for (let itemIndex = 0; itemIndex < pending.length; itemIndex += 1) {
    const item = pending[itemIndex];
    const label = pendingItemKey(item);

    if (await isAlreadyIngested(db, label)) {
      skipped.push(label);
      continue;
    }

    if (created.length >= maxItems) {
      deferred.push(label);
      continue;
    }

    const delayMs = ingestionPacingDelayMs(lastStartedAtMs, minIntervalMs);
    if (delayMs > 0) await scheduler.wait(delayMs);
    lastStartedAtMs = Date.now();

    try {
      if (item.kind === "sourced") created.push(await ingestSourcedItem(db, env, item, beforeRequest));
      else if (item.kind === "glossary") created.push(await ingestGlossaryItem(db, env, item, beforeRequest));
      else created.push(await ingestTriviaItem(db, env, item, beforeRequest));
    } catch (err) {
      if (err instanceof GeminiRateLimitError) {
        deferred.push(label);
        deferred.push(...pending.slice(itemIndex + 1).map(pendingItemKey));
        break;
      }
      failed.push({ item: label, error: String(err) });
    }
  }

  return {
    pendingCount: pending.length,
    created,
    skipped,
    deferred,
    failed,
    collectorDiagnostics: collection.diagnostics,
    minIntervalMs,
    maxItems,
  };
}

function pendingItemKey(item: PendingItem) {
  if (item.kind === "trivia") return item.sourceUrl;
  if (item.kind === "sourced") return item.dedupeKey;
  return item.url;
}

type IngestionResult = Awaited<ReturnType<typeof runIngestion>>;
type IngestionTrigger = "scheduled" | "manual";

function failedIngestionResult(env: Env, error: unknown): IngestionResult {
  return {
    pendingCount: 0,
    created: [],
    skipped: [],
    deferred: [],
    failed: [{ item: "run", error: error instanceof Error ? error.message : String(error) }],
    collectorDiagnostics: [],
    minIntervalMs: normalizeIngestionIntervalMs(Number(env.GEMINI_INGEST_MIN_INTERVAL_MS)),
    maxItems: normalizeIngestionBatchLimit(Number(env.GEMINI_INGEST_MAX_ITEMS)),
  };
}

async function saveIngestionRun(
  db: AppDb,
  params: {
    trigger: IngestionTrigger;
    status: "success" | "error";
    result: IngestionResult;
    startedAt: Date;
    finishedAt: Date;
    error?: string;
  },
) {
  await db.insert(schema.ingestionRuns).values({
    trigger: params.trigger,
    status: params.status,
    pendingCount: params.result.pendingCount,
    createdCount: params.result.created.length,
    skippedCount: params.result.skipped.length,
    deferredCount: params.result.deferred.length,
    failedCount: params.result.failed.length,
    minIntervalMs: params.result.minIntervalMs,
    maxItems: params.result.maxItems,
    createdItems: params.result.created,
    skippedItems: params.result.skipped,
    deferredItems: params.result.deferred,
    failedItems: params.result.failed,
    collectorDiagnostics: params.result.collectorDiagnostics,
    error: params.error,
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
  });
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env) {
    const startedAt = new Date();
    const db = createDb(env.DB);
    let result: IngestionResult;
    let status: "success" | "error" = "success";
    let errorMessage: string | undefined;

    try {
      result = await runIngestion(env);
      const expiry = new Date(Date.now() - 48 * 60 * 60 * 1_000);
      await Promise.all([
        db.delete(schema.chatUsage).where(lt(schema.chatUsage.windowStartedAt, expiry)),
        pruneGeminiRequestLog(env.DB),
      ]);
    } catch (error) {
      status = "error";
      errorMessage = error instanceof Error ? error.message : String(error);
      result = failedIngestionResult(env, error);
      console.error(JSON.stringify({ message: "scheduled ingestion failed", error: errorMessage }));
    }

    await saveIngestionRun(db, {
      trigger: "scheduled",
      status,
      result,
      startedAt,
      finishedAt: new Date(),
      error: errorMessage,
    });
    console.log(JSON.stringify({ message: "scheduled ingestion completed", status, ...result }));
  },
};
