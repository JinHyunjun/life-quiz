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

export interface AptTransactionRow {
  aptNm: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  deposit: string;
  dealAmount?: string;
  monthlyRent?: string;
  excluUseAr: string;
  umdNm: string;
}

const AptOperation = {
  rent: { path: "RTMSDataSvcAptRent/getRTMSDataSvcAptRent", priceField: "deposit" },
  sale: { path: "RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade", priceField: "dealAmount" },
} as const;

// LAWD_CD: first 5 digits of the legal-dong code (e.g. "11110" = Seoul Jongno-gu).
// DEAL_YMD: contract year+month, 6 digits (e.g. "202505").
export async function fetchAptTransactions(
  kind: keyof typeof AptOperation,
  serviceKey: string,
  lawdCd: string,
  dealYmd: string,
): Promise<{ url: string; rows: AptTransactionRow[] }> {
  const { path } = AptOperation[kind];
  const { raw, url } = await fetchGovApi({
    endpoint: `https://apis.data.go.kr/1613000/${path}`,
    serviceKey,
    query: { LAWD_CD: lawdCd, DEAL_YMD: dealYmd, numOfRows: "20", pageNo: "1" },
  });

  const { XMLParser } = await import("fast-xml-parser");
  // parseTagValue: false keeps "000" as a string instead of coercing it to the number 0.
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(raw);
  const resultCode = parsed?.response?.header?.resultCode;
  if (resultCode !== "000") {
    throw new Error(`data.go.kr error: ${resultCode} ${parsed?.response?.header?.resultMsg ?? ""}`);
  }

  const items = parsed?.response?.body?.items?.item ?? [];
  const rows = Array.isArray(items) ? items : [items];
  return { url, rows: rows.filter(Boolean) };
}
