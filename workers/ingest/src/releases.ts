import { eq } from "drizzle-orm";
import {
  FALLBACK_RELEASE_FEED,
  parseNotionReleaseBlocks,
  type ReleaseFeed,
} from "../../../src/lib/releases";
import { schema, type AppDb } from "./db";

const NOTION_API_VERSION = "2026-03-11";
const RELEASE_CACHE_TTL_MS = 5 * 60 * 1_000;
const MAX_NOTION_BLOCKS = 500;

export async function getReleaseFeed(params: {
  db: AppDb;
  token: string;
  pageId: string;
  now?: Date;
}): Promise<ReleaseFeed> {
  const now = params.now ?? new Date();
  const [cached] = await params.db
    .select()
    .from(schema.releaseCache)
    .where(eq(schema.releaseCache.key, params.pageId))
    .limit(1);

  if (cached && now.getTime() - cached.fetchedAt.getTime() < RELEASE_CACHE_TTL_MS) {
    return { ...cached.payload, source: cached.payload.source === "snapshot" ? "snapshot" : "cache" };
  }

  try {
    if (!params.token) throw new Error("Notion token is not configured");
    const blocks = await fetchNotionBlocks(params.pageId, params.token);
    const releases = parseNotionReleaseBlocks(blocks);
    if (releases.length === 0) throw new Error("Notion release page had no version headings");

    const feed: ReleaseFeed = {
      releases,
      fetchedAt: now.toISOString(),
      source: "notion",
      stale: false,
    };
    await saveReleaseCache(params.db, params.pageId, feed, now);
    return feed;
  } catch (error) {
    console.error(JSON.stringify({
      message: "Notion release sync failed",
      pageId: params.pageId,
      error: error instanceof Error ? error.message : String(error),
    }));
    const fallback: ReleaseFeed = cached
      ? { ...cached.payload, source: "cache", stale: true }
      : { ...FALLBACK_RELEASE_FEED, fetchedAt: now.toISOString() };
    await saveReleaseCache(params.db, params.pageId, fallback, now);
    return fallback;
  }
}

async function fetchNotionBlocks(pageId: string, token: string) {
  const blocks: unknown[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${encodeURIComponent(pageId)}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        "notion-version": NOTION_API_VERSION,
      },
    });
    if (!response.ok) throw new Error(`Notion API returned ${response.status}`);

    const body = asRecord(await response.json());
    const results = Array.isArray(body?.results) ? body.results : [];
    blocks.push(...results);
    if (blocks.length > MAX_NOTION_BLOCKS) throw new Error("Notion release page exceeded the block limit");

    cursor = body?.has_more === true && typeof body.next_cursor === "string" ? body.next_cursor : null;
  } while (cursor);

  return blocks;
}

async function saveReleaseCache(db: AppDb, key: string, payload: ReleaseFeed, fetchedAt: Date) {
  await db
    .insert(schema.releaseCache)
    .values({ key, payload, fetchedAt })
    .onConflictDoUpdate({
      target: schema.releaseCache.key,
      set: { payload, fetchedAt },
    });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
