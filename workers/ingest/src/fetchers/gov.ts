export interface GovApiParams {
  endpoint: string;
  serviceKey: string;
  query?: Record<string, string>;
}

export interface GovApiResult {
  raw: string;
  url: string;
}

export async function fetchGovApi({ endpoint, serviceKey, query = {} }: GovApiParams): Promise<GovApiResult> {
  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", serviceKey);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`data.go.kr request failed: ${res.status} ${url.toString()}`);
  }

  return { raw: await res.text(), url: url.toString() };
}
