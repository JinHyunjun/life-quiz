import { XMLParser } from "fast-xml-parser";
import { readTextLimited } from "./http.ts";

export interface RssItem {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | undefined;
}

const parser = new XMLParser({ ignoreAttributes: false });

export async function fetchRssFeed(feedUrl: string): Promise<RssItem[]> {
  const res = await fetch(feedUrl);
  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status} ${feedUrl}`);
  }

  const xml = parser.parse(await readTextLimited(res, 512_000));
  const items = xml?.rss?.channel?.item ?? [];
  const list = Array.isArray(items) ? items : [items];

  return list
    .filter(Boolean)
    .map((item: Record<string, unknown>) => ({
      title: String(item.title ?? ""),
      link: String(item.link ?? ""),
      summary: String(item.description ?? ""),
      publishedAt: item.pubDate ? String(item.pubDate) : undefined,
    }));
}
