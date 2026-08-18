import type { ContentCard } from "../db/schema";
import type { Category } from "./categories";

export interface KeywordSourceItem {
  title: string;
  cards: ContentCard[] | null;
  category: Category;
}

export interface ContentKeyword {
  keyword: string;
  count: number;
  category: Category;
  fontSizeRem: number;
}

interface KeywordAccumulator {
  count: number;
  categoryCounts: Map<Category, number>;
}

interface KeywordCloudOptions {
  limit?: number;
  minCount?: number;
}

const CURATED_KEYWORDS = [
  ["청년정책", ["청년정책", "청년 정책"]],
  ["청년수당", ["청년수당", "청년 수당"]],
  ["내 집 마련", ["내 집 마련", "내집 마련"]],
  ["주거 예산", ["주거 예산"]],
  ["실거래가", ["실거래가"]],
  ["전월세", ["전월세", "전·월세", "전세와 월세"]],
  ["근로계약", ["근로계약", "근로 계약"]],
  ["최저임금", ["최저임금", "최저 임금"]],
  ["개인정보", ["개인정보", "개인 정보"]],
  ["보이스피싱", ["보이스피싱", "보이스 피싱"]],
  ["고정금리", ["고정금리", "고정 금리"]],
  ["변동금리", ["변동금리", "변동 금리"]],
  ["신용점수", ["신용점수", "신용 점수"]],
  ["예금자보호", ["예금자보호", "예금자 보호"]],
  ["연말정산", ["연말정산", "연말 정산"]],
  ["원금균등상환", ["원금균등상환", "원금 균등 상환"]],
  ["원리금균등상환", ["원리금균등상환", "원리금 균등 상환"]],
  ["만기일시상환", ["만기일시상환", "만기 일시 상환"]],
  ["평가손익", ["평가손익", "평가 손익"]],
  ["실현손익", ["실현손익", "실현 손익"]],
  ["수익률", ["수익률"]],
  ["복리", ["복리"]],
  ["배당", ["배당"]],
  ["ETF", ["etf"]],
  ["CMA", ["cma"]],
  ["ISA", ["isa"]],
] as const;

const STOP_WORDS = new Set([
  "가이드", "가장", "가치", "각자", "건강한", "결과", "관련", "구분", "구조", "기록", "기본", "기억할", "기준",
  "놓치기", "다시", "다양한", "대응", "대한", "따져보는", "만드는", "먼저", "무엇", "무엇인", "방법", "방식",
  "바꾸는", "배경", "보는", "사례", "사회초년생", "상황", "새로운", "생각하기", "성공적인", "스마트한", "시작",
  "실제", "실체", "실천", "안전한", "알아보는", "완성", "완전", "왜", "요소", "위한", "유형", "의미", "이끄는",
  "이란", "이유", "이해", "이해하기", "익히기", "있는", "적용", "정복", "정리", "정의", "정확히", "조건", "좋은",
  "주요", "주의사항", "주의점", "줄이기", "중요성", "지침", "진실", "진짜", "차이", "체크", "체크리스트", "콘텐츠",
  "통해", "필수", "필요한", "하는", "핵심", "현대적", "확산", "확인", "확인법", "확인하기", "확인하는", "확인해야",
  "활용", "활용법", "효과", "힘", "THE", "AND", "FOR", "WITH", "FROM", "THIS", "THAT", "VS",
  "강남", "강동", "강북", "강서", "관악", "광진", "구로", "금천", "노원", "도봉", "동대문", "동작", "마포",
  "서대문", "서초", "성동", "성북", "송파", "양천", "영등포", "용산", "은평", "종로", "중구", "중랑",
  "강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구", "노원구", "도봉구",
  "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구", "성북구", "송파구", "양천구", "영등포구",
  "용산구", "은평구", "종로구", "중랑구",
]);

const PARTICLE_SUFFIXES = [
  "으로부터", "에서부터", "이라고", "이라는", "으로", "에게", "까지", "부터", "처럼", "보다", "에는", "과는", "와는",
  "에서", "으로", "의", "과", "와", "을", "를", "은", "는", "이", "가", "에", "도", "만", "로",
];

export function buildContentKeywordCloud(
  items: KeywordSourceItem[],
  options: KeywordCloudOptions = {},
): ContentKeyword[] {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 72), 12), 120);
  const minCount = Math.max(1, Math.trunc(options.minCount ?? 2));
  const accumulators = new Map<string, KeywordAccumulator>();

  for (const item of items) {
    for (const keyword of extractContentKeywords(item)) {
      const accumulator = accumulators.get(keyword) ?? { count: 0, categoryCounts: new Map() };
      accumulator.count += 1;
      accumulator.categoryCounts.set(item.category, (accumulator.categoryCounts.get(item.category) ?? 0) + 1);
      accumulators.set(keyword, accumulator);
    }
  }

  const ranked = [...accumulators.entries()]
    .filter(([, value]) => value.count >= minCount)
    .map(([keyword, value]) => ({
      keyword,
      count: value.count,
      category: dominantCategory(value.categoryCounts),
    }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword, "ko"));

  const selected = selectDiverseKeywords(ranked, limit);
  if (selected.length === 0) return [];

  const minimum = Math.min(...selected.map((item) => item.count));
  const maximum = Math.max(...selected.map((item) => item.count));
  const range = Math.max(1, Math.sqrt(maximum) - Math.sqrt(minimum));

  return spreadLargeKeywords(selected).map((item) => {
    const ratio = (Math.sqrt(item.count) - Math.sqrt(minimum)) / range;
    const lengthCeiling = item.keyword.length >= 9 ? 1.75 : item.keyword.length >= 7 ? 2.1 : item.keyword.length >= 5 ? 2.55 : 3.2;
    return {
      ...item,
      fontSizeRem: Number(Math.min(1 + ratio * 2.2, lengthCeiling).toFixed(2)),
    };
  });
}

export function extractContentKeywords(item: KeywordSourceItem): Set<string> {
  const titleAndHeadings = [item.title, ...(item.cards ?? []).map((card) => card.heading)].join(" ");
  const comparable = titleAndHeadings.normalize("NFKC").toLocaleLowerCase("ko");
  const keywords = new Set<string>();
  const coveredPhraseTokens = new Set<string>();

  for (const [keyword, variants] of CURATED_KEYWORDS) {
    if (!variants.some((variant) => comparable.includes(variant))) continue;
    keywords.add(keyword);
    if (keyword.includes(" ")) {
      for (const token of keyword.split(" ")) coveredPhraseTokens.add(token);
    }
  }

  const tokens = comparable.match(/[가-힣]{2,14}|[a-z][a-z0-9+.-]{1,14}/g) ?? [];
  for (const rawToken of tokens) {
    const keyword = normalizeKeywordToken(rawToken);
    if (!keyword || STOP_WORDS.has(keyword) || coveredPhraseTokens.has(keyword)) continue;
    keywords.add(keyword);
  }

  return keywords;
}

export function normalizeKeywordQuery(value: string | undefined): string | undefined {
  const normalized = value?.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 40);
  return normalized && /^[가-힣A-Za-z0-9+.-]+(?: [가-힣A-Za-z0-9+.-]+){0,2}$/.test(normalized)
    ? normalized
    : undefined;
}

function normalizeKeywordToken(value: string): string | undefined {
  let token = value.replace(/^[+.-]+|[+.-]+$/g, "");
  if (/^[a-z]/.test(token)) {
    token = token.toUpperCase();
    return token.length >= 2 ? token : undefined;
  }

  for (const suffix of PARTICLE_SUFFIXES) {
    if (token.length - suffix.length >= 2 && token.endsWith(suffix)) {
      token = token.slice(0, -suffix.length);
      break;
    }
  }
  return token.length >= 2 ? token : undefined;
}

function dominantCategory(categoryCounts: Map<Category, number>): Category {
  return [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
}

function selectDiverseKeywords<T extends { keyword: string; count: number; category: Category }>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;

  const categories = [...new Set(items.map((item) => item.category))];
  const minimumPerCategory = Math.max(2, Math.floor(limit / Math.max(categories.length * 2, 1)));
  const maximumPerCategory = Math.max(minimumPerCategory, Math.ceil(limit / 5));
  const selected = new Map<string, T>();
  const selectedCategoryCounts = new Map<Category, number>();

  for (const category of categories) {
    for (const item of items.filter((candidate) => candidate.category === category).slice(0, minimumPerCategory)) {
      selected.set(item.keyword, item);
      selectedCategoryCounts.set(category, (selectedCategoryCounts.get(category) ?? 0) + 1);
    }
  }
  for (const item of items) {
    if (selected.size >= limit) break;
    if (selected.has(item.keyword)) continue;
    if ((selectedCategoryCounts.get(item.category) ?? 0) >= maximumPerCategory) continue;
    selected.set(item.keyword, item);
    selectedCategoryCounts.set(item.category, (selectedCategoryCounts.get(item.category) ?? 0) + 1);
  }
  for (const item of items) {
    if (selected.size >= limit) break;
    selected.set(item.keyword, item);
  }

  return [...selected.values()].sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword, "ko"));
}

function spreadLargeKeywords<T>(items: T[]): T[] {
  const ordered: T[] = [];
  let start = 0;
  let end = items.length - 1;
  while (start <= end) {
    ordered.push(items[start++]!);
    if (start <= end) ordered.push(items[end--]!);
  }
  return ordered;
}
