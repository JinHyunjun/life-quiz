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
  fetchedAt: "2026-07-10T07:00:00.000Z",
  source: "snapshot",
  stale: true,
  releases: [
    {
      version: "v0.9",
      title: "수집량 회복과 진단 로그",
      date: "2026-07-10",
      changes: [
        { type: "bullet", text: "원격 D1 기준 오늘 생성량이 3건까지 줄어든 상태를 확인하고, 최근 일자별 생성량과 소스별 중단 시점을 점검" },
        { type: "bullet", text: "Cloudflare Cron을 `0 3/6 * * *` 한 표현식으로 정리해 KST 00/06/12/18시 실행 의도를 더 명확히 반영" },
        { type: "bullet", text: "수집 회차마다 생성·중복·지연·실패 건수를 D1 `ingestion_runs`에 저장해 다음 급감 원인을 바로 추적" },
        { type: "bullet", text: "YouTube는 주제별 후보를 3개까지 받아 이미 수집한 최신 영상만 반복 선택되는 문제를 완화" },
        { type: "bullet", text: "짧은 위키백과 요약은 문서 도입부로 보강해 일반 상식 콘텐츠가 근거 부족으로 사라지는 문제를 줄임" },
      ],
    },
    {
      version: "v0.8",
      title: "무료 한도와 수집 안정화",
      date: "2026-07-09",
      changes: [
        { type: "bullet", text: "KST 00/06/12/18시 수집을 Cloudflare Cron 표현식 하나로 통합해 Life Quiz Trigger 사용량을 4개에서 1개로 축소" },
        { type: "bullet", text: "같은 Cloudflare 계정의 Soccer Cron까지 합산해 현재 Trigger 사용량을 2/5로 재산정" },
        { type: "bullet", text: "README와 무료 운영 문서에 통합 Cron, 실제 D1 사용량, Gemini 3.1 Flash Lite 운영 기준을 반영" },
        { type: "bullet", text: "릴리즈 노트 날짜가 서버 시간대에 따라 하루 밀리지 않도록 KST 표시로 고정" },
        { type: "bullet", text: "릴리즈 노트 원본과 웹 표시용 스냅샷을 최신 운영 상태에 맞게 업데이트" },
      ],
    },
    {
      version: "v0.7",
      title: "AI 상식 선별 복구",
      date: "2026-06-29",
      changes: [
        { type: "bullet", text: "검수 대기 AI 상식 중 공식·전문 외부 자료로 확인 가능한 14건을 선별 복구" },
        { type: "bullet", text: "조선왕조실록, 서울시, NASA, APA, Smithsonian, Kew Gardens 등 실제 SOURCE 링크 연결" },
        { type: "bullet", text: "복구 콘텐츠의 과장된 표현과 확인되지 않은 수치를 제거하고 카드 4개와 Deep Read 재작성" },
        { type: "bullet", text: "복구한 14개 퀴즈의 문제, 선택지, 정답 해설도 외부 자료 범위에 맞게 교체" },
        { type: "bullet", text: "안전성이 불분명하거나 근거가 약한 생활 팁과 중복 콘텐츠는 계속 비공개 유지" },
      ],
    },
    {
      version: "v0.6",
      title: "출처와 복습 큐 신뢰성",
      date: "2026-06-29",
      changes: [
        { type: "bullet", text: "출처가 없던 기존 AI 상식을 비공개 검수 상태로 전환하고 서비스 범위 밖 콘텐츠 정리" },
        { type: "bullet", text: "새 AI 상식은 위키백과 원문 안의 사실만 재구성하고 SOURCE에서 실제 외부 페이지로 이동" },
        { type: "bullet", text: "금융·주거 4컷 가이드에 공식 참고 원문 링크 보강" },
        { type: "bullet", text: "글 상세에서 복습에 담은 콘텐츠만 브라우저별 오늘의 복습 큐에 표시" },
        { type: "bullet", text: "숨김 콘텐츠를 홈·보관함·상세·채팅·복습에서 일관되게 제외" },
      ],
    },
    {
      version: "v0.5",
      title: "학습 흐름과 콘텐츠 품질",
      date: "2026-06-29",
      changes: [
        { type: "bullet", text: "금융·투자·주거 기초 용어를 순서대로 배우는 시작 코스 추가" },
        { type: "bullet", text: "일반 경제기사 오분류를 막는 사회초년생 관련성 검사와 소스별 고정 카테고리 적용" },
        { type: "bullet", text: "Deep Read를 4개 소제목으로 구조화하고 오늘 바로 확인할 행동 요약 추가" },
        { type: "bullet", text: "새 복습 퀴즈에 정답과 오답을 구분하는 해설 추가" },
        { type: "bullet", text: "금융·주거 기초 용어에 공식 참고 출처 링크 보강" },
      ],
    },
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
