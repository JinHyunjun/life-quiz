export type ReleaseChangeType = "bullet" | "numbered" | "text" | "callout";

export interface ReleaseChange {
  type: ReleaseChangeType;
  text: string;
  section?: string;
}

export interface ReleaseNote {
  version: string;
  title: string;
  date: string | null;
  changes: ReleaseChange[];
}

export interface ReleaseFeed {
  releases: ReleaseNote[];
  fetchedAt: string;
  source: "notion" | "cache" | "snapshot";
  stale: boolean;
}

export const NOTION_RELEASE_PAGE_ID = "38ccb889-5490-8102-93b1-c63f45626a20";

export const FALLBACK_RELEASE_FEED: ReleaseFeed = {
  fetchedAt: "2026-06-28T00:00:00.000Z",
  source: "snapshot",
  stale: true,
  releases: [
    {
      version: "v0.4",
      title: "릴리즈 노트",
      date: "2026-06-28",
      changes: [
        { type: "bullet", text: "웹사이트에서 업데이트 내역을 모아보는 릴리즈 노트 페이지 추가" },
        { type: "bullet", text: "Notion에 정리한 새 버전 내용을 최대 5분 안에 웹페이지에 자동 반영" },
        { type: "bullet", text: "Notion 연결이 잠시 불안정해도 마지막 업데이트 내역을 계속 표시" },
      ],
    },
    {
      version: "v0.3",
      title: "2차 업데이트",
      date: "2026-06-27",
      changes: [
        { type: "bullet", text: "서울 25개 자치구를 순환하며 부동산·생활폐기물 정보를 수집하도록 확장" },
        { type: "bullet", text: "금융·주식·투자·부동산 기초 용어를 4단계로 보여주는 시각 가이드 추가" },
        { type: "bullet", text: "주식·투자 카테고리를 신설하고 투자 개념 교육에 집중" },
        { type: "bullet", text: "콘텐츠 카드 사이 의미 중복을 자동으로 걸러내는 품질 검증 추가" },
        { type: "bullet", text: "오픈소스 구성과 무료 운영 범위를 정리한 기술 문서 추가" },
      ],
    },
    {
      version: "v0.2",
      title: "1차 업데이트",
      date: "2026-06-27",
      changes: [
        { type: "bullet", text: "콘텐츠 주제를 역사, 유머, 사회성·매너까지 확장" },
        { type: "bullet", text: "저장된 글에 근거해 답하는 AI 채팅 라이프 메이트 출시" },
        { type: "bullet", text: "날짜·분야·출처별 지난 상식 보관함 출시" },
        { type: "bullet", text: "콘텐츠 수집 주기를 하루 1회에서 4회로 확대" },
        { type: "bullet", text: "콘텐츠 생성 내부 서버의 외부 직접 접근 차단" },
      ],
    },
    {
      version: "v0.1",
      title: "첫 출시",
      date: "2026-06-26",
      changes: [
        { type: "bullet", text: "금융·부동산·서울살이·생활상식 콘텐츠를 출처와 함께 제공" },
        { type: "bullet", text: "글마다 한눈에 훑어보는 카드뉴스 요약 제공" },
        { type: "bullet", text: "FSRS 기반 오늘의 복습 퀴즈 제공" },
        { type: "bullet", text: "공공데이터, 뉴스, 유튜브를 통한 콘텐츠 자동 수집" },
      ],
    },
  ],
};

const VERSION_RE = /\bv\d+(?:\.\d+){1,2}\b/i;
const DATE_RE = /\b20\d{2}[-./]\d{1,2}[-./]\d{1,2}\b/;

export function parseNotionReleaseBlocks(values: readonly unknown[]): ReleaseNote[] {
  const releases: ReleaseNote[] = [];
  let current: ReleaseNote | null = null;
  let section: string | undefined;

  for (const value of values) {
    const block = asRecord(value);
    const type = typeof block?.type === "string" ? block.type : "";
    if (type === "divider") {
      section = undefined;
      continue;
    }
    const text = notionBlockText(block, type).trim();
    if (!text) continue;

    if (type === "heading_1" || type === "heading_2") {
      const heading = parseReleaseHeading(text);
      if (heading) {
        current = { ...heading, changes: [] };
        releases.push(current);
        section = undefined;
      } else if (current) {
        section = text;
      }
      continue;
    }

    if (!current) continue;
    if (type === "heading_3" || type === "heading_4") {
      section = text;
      continue;
    }
    if (type === "paragraph" && !current.date && DATE_RE.test(text) && text.length < 40) {
      current.date = normalizeReleaseDate(text.match(DATE_RE)?.[0] ?? text);
      continue;
    }

    const changeType = releaseChangeType(type);
    if (changeType) current.changes.push({ type: changeType, text, ...(section ? { section } : {}) });
  }

  return releases.filter((release) => release.changes.length > 0);
}

export function isReleaseFeed(value: unknown): value is ReleaseFeed {
  const feed = asRecord(value);
  return Boolean(
    feed
      && Array.isArray(feed.releases)
      && typeof feed.fetchedAt === "string"
      && (feed.source === "notion" || feed.source === "cache" || feed.source === "snapshot")
      && typeof feed.stale === "boolean",
  );
}

function parseReleaseHeading(text: string): Omit<ReleaseNote, "changes"> | null {
  const versionMatch = text.match(VERSION_RE);
  if (!versionMatch) return null;

  const dateMatch = text.match(DATE_RE);
  let title = text
    .replace(versionMatch[0], "")
    .replace(dateMatch?.[0] ?? "", "")
    .replace(/^[\s📦—–-]+|[\s—–-]+$/g, "")
    .replace(/^\((.+)\)$/, "$1")
    .trim();
  if (/^\d+차$/.test(title)) title = `${title} 업데이트`;

  return {
    version: versionMatch[0].toLowerCase(),
    title: title || "업데이트",
    date: dateMatch ? normalizeReleaseDate(dateMatch[0]) : null,
  };
}

function normalizeReleaseDate(value: string) {
  const [year, month, day] = value.split(/[-./]/).map(Number);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function releaseChangeType(type: string): ReleaseChangeType | null {
  if (type === "bulleted_list_item") return "bullet";
  if (type === "numbered_list_item") return "numbered";
  if (type === "callout" || type === "quote") return "callout";
  if (type === "paragraph" || type === "toggle" || type === "to_do") return "text";
  return null;
}

function notionBlockText(block: Record<string, unknown> | null, type: string) {
  const payload = asRecord(block?.[type]);
  const richText = Array.isArray(payload?.rich_text) ? payload.rich_text : [];
  return richText
    .map((item) => asRecord(item)?.plain_text)
    .filter((text): text is string => typeof text === "string")
    .join("");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
