export interface YoutubeVideoMeta {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  watchUrl: string;
}

export async function fetchYoutubeVideoMeta(videoIds: string[], apiKey: string): Promise<YoutubeVideoMeta[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`YouTube Data API request failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    items: { id: string; snippet: { title: string; description: string; channelTitle: string } }[];
  };

  return data.items.map((item) => ({
    videoId: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    channelTitle: item.snippet.channelTitle,
    watchUrl: `https://www.youtube.com/watch?v=${item.id}`,
  }));
}
