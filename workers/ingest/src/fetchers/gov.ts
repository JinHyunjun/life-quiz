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

export async function fetchLoanProducts(serviceKey: string): Promise<{ url: string; rows: Record<string, unknown>[] }> {
  const { raw, url } = await fetchGovApi({
    endpoint: "https://apis.data.go.kr/B553701/LoanProductSearchingInfo/getLoanProductSearchingInfo",
    serviceKey,
    query: { numOfRows: "10", pageNo: "1", type: "xml", TGT_FLTR: "근로자", RSD_AREA_PAMT_EQLT_ISTM: "전국" },
  });

  const { XMLParser } = await import("fast-xml-parser");
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(raw);
  const header = parsed?.response?.header;
  const items = parsed?.response?.body?.items?.item;
  if (!items) {
    throw new Error(`data.go.kr error: ${header?.resultCode} ${header?.resultMsg ?? ""}`);
  }

  const rows = Array.isArray(items) ? items : [items];
  return { url, rows: rows.filter(Boolean) };
}

// SGG_NM: 시군구명 (e.g. "종로구"), filtered with the LIKE operator.
export async function fetchTrashInfo(serviceKey: string, sggName: string): Promise<{ url: string; rows: Record<string, unknown>[] }> {
  const url = new URL("https://apis.data.go.kr/1741000/household_waste_info/info");
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "10");
  url.searchParams.set("returnType", "json");
  if (sggName) {
    url.searchParams.set("cond[SGG_NM::LIKE]", sggName);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`data.go.kr request failed: ${res.status} ${url.toString()} ${await res.text()}`);
  }

  const data = (await res.json()) as { response?: { body?: { items?: { item?: Record<string, unknown>[] | Record<string, unknown> } } } };
  const items = data.response?.body?.items?.item ?? [];
  const rows = Array.isArray(items) ? items : [items];
  return { url: url.toString(), rows };
}

// Renders any flat record as "key: value" lines, skipping empty values - used for sources whose
// exact field names weren't confirmed ahead of time (LOAN/TRASH).
export function flattenRowsToText(rows: Record<string, unknown>[]): string {
  return rows
    .map((row) =>
      Object.entries(row)
        .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
        .map(([key, value]) => `${key}: ${value}`)
        .join(", "),
    )
    .join("\n");
}
