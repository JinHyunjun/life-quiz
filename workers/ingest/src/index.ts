import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb, schema, type AppDb } from "./db";
import { generateArticleAndQuiz } from "./gemini";
import { fetchAptTransactions, fetchTrashInfo, flattenRowsToText, type AptTransactionRow } from "./fetchers/gov";
import { fetchRssFeed } from "./fetchers/rss";
import { fetchYoutubeVideoMeta } from "./fetchers/youtube";

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

interface PendingItem {
  url: string;
  originType: "gov" | "news" | "youtube";
  citationLabel: string;
  sourceText: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

// Manual trigger for local dev: `wrangler dev` then hit this route instead of waiting for cron.
app.post("/trigger", async (c) => {
  const result = await runIngestion(c.env);
  return c.json(result);
});

async function collectPendingItems(env: Env): Promise<PendingItem[]> {
  const items: PendingItem[] = [];

  const rss = await fetchRssFeed("https://www.hankyung.com/feed/economy").catch(() => []);
  for (const item of rss.slice(0, 3)) {
    items.push({
      url: item.link,
      originType: "news",
      citationLabel: "한국경제",
      sourceText: `${item.title}\n\n${item.summary}`,
    });
  }

  const youtube = await fetchYoutubeVideoMeta(["dQw4w9WgXcQ"], env.YOUTUBE_API_KEY).catch(() => []);
  for (const video of youtube) {
    items.push({
      url: video.watchUrl,
      originType: "youtube",
      citationLabel: `유튜브 - ${video.channelTitle}`,
      sourceText: `${video.title}\n\n${video.description}`,
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
        url,
        originType: "gov",
        citationLabel: "행정안전부 생활쓰레기배출정보 조회서비스",
        sourceText: `서울 종로구 생활쓰레기 배출 안내:\n${flattenRowsToText(rows.slice(0, 5))}`,
      });
    }
  } catch {
    // Skip this source for this run; next scheduled run will retry.
  }

  return items;
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

async function ingestItem(db: AppDb, env: Env, item: PendingItem) {
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

  const [contentItem] = await db
    .insert(schema.contentItems)
    .values({
      sourceId: source.id,
      title: generated.title,
      bodyMd: generated.bodyMd,
      category: generated.category,
      citationUrl: item.url,
      citationLabel: item.citationLabel,
      createdAt: new Date(),
    })
    .returning();

  await db.insert(schema.quizItems).values({
    contentItemId: contentItem.id,
    question: generated.question,
    choices: generated.choices,
    answer: generated.answer,
  });

  return { contentItemId: contentItem.id, title: generated.title };
}

async function runIngestion(env: Env) {
  const db = createDb(env.DB);
  const pending = await collectPendingItems(env);
  const created: { contentItemId: number; title: string }[] = [];
  const skipped: string[] = [];
  const failed: { url: string; error: string }[] = [];

  for (const item of pending) {
    if (await isAlreadyIngested(db, item.url)) {
      skipped.push(item.url);
      continue;
    }

    try {
      created.push(await ingestItem(db, env, item));
    } catch (err) {
      failed.push({ url: item.url, error: String(err) });
    }
  }

  return { created, skipped, failed };
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env) {
    await runIngestion(env);
  },
};
