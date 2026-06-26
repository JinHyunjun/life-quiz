import { Hono } from "hono";
import { fetchRssFeed } from "./fetchers/rss";
import { fetchYoutubeVideoMeta } from "./fetchers/youtube";

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  // data.go.kr issues one serviceKey per approved dataset, not one shared account-wide key.
  DATA_GO_KR_KEY_TRASH: string;
  DATA_GO_KR_KEY_LOAN: string;
  DATA_GO_KR_KEY_APT_SALE: string;
  DATA_GO_KR_KEY_APT_RENT: string;
  YOUTUBE_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

// Manual trigger for local dev: `wrangler dev` then hit this route instead of waiting for cron.
app.post("/trigger", async (c) => {
  const result = await runIngestion(c.env);
  return c.json(result);
});

async function runIngestion(env: Env) {
  const [rss, youtube] = await Promise.all([
    fetchRssFeed("https://www.hankyung.com/feed/economy").catch((err) => ({ error: String(err) })),
    fetchYoutubeVideoMeta(["dQw4w9WgXcQ"], env.YOUTUBE_API_KEY).catch((err) => ({ error: String(err) })),
  ]);

  // data.go.kr fetch is omitted from the default run until a real serviceKey + endpoint are chosen.
  return { rss, youtube };
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env) {
    await runIngestion(env);
  },
};
