export interface YoutubeVideoMeta {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  watchUrl: string;
}

export interface YoutubeSearchOptions {
  query: string;
  apiKey: string;
  maxResults?: number;
  publishedAfter?: Date;
}

export async function searchRecentYoutubeVideos({
  query,
  apiKey,
  maxResults = 2,
  publishedAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000),
}: YoutubeSearchOptions): Promise<YoutubeVideoMeta[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("maxResults", String(Math.min(Math.max(Math.trunc(maxResults), 1), 10)));
  url.searchParams.set("publishedAfter", publishedAfter.toISOString());
  url.searchParams.set("regionCode", "KR");
  url.searchParams.set("relevanceLanguage", "ko");
  url.searchParams.set("safeSearch", "strict");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`YouTube Data API search failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        description?: string;
        channelTitle?: string;
        publishedAt?: string;
      };
    }>;
  };

  return (data.items ?? []).flatMap((item) => {
    const videoId = item.id?.videoId;
    const snippet = item.snippet;
    if (!videoId || !snippet?.title || !snippet.channelTitle || !snippet.publishedAt) return [];

    return [{
      videoId,
      title: snippet.title,
      description: snippet.description ?? "",
      channelTitle: snippet.channelTitle,
      publishedAt: snippet.publishedAt,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    }];
  });
}
