import type { ScheduledTriviaCategory } from "./schedule";

export interface TriviaSourceTopic {
  category: ScheduledTriviaCategory;
  topic: string;
  wikipediaTitle: string;
  sourceUrl: string;
}

const CURRICULUM: Record<ScheduledTriviaCategory, readonly { topic: string; wikipediaTitle: string }[]> = {
  history: [
    { topic: "훈민정음이 만들어지고 반포된 과정", wikipediaTitle: "훈민정음" },
    { topic: "강수량을 재는 측우기의 역사", wikipediaTitle: "측우기" },
    { topic: "대동여지도가 보여 준 조선의 지도 제작", wikipediaTitle: "대동여지도" },
    { topic: "조선왕조실록이 기록되고 보존된 방식", wikipediaTitle: "조선왕조실록" },
    { topic: "팔만대장경과 목판 인쇄 기술", wikipediaTitle: "팔만대장경" },
    { topic: "온돌이 한국의 생활 방식에 미친 영향", wikipediaTitle: "온돌" },
    { topic: "직지와 금속활자 인쇄의 의미", wikipediaTitle: "직지심체요절" },
    { topic: "혼천의로 하늘의 움직임을 관측한 원리", wikipediaTitle: "혼천의" },
  ],
  humor: [
    { topic: "해달이 돌을 도구로 사용하는 행동", wikipediaTitle: "해달" },
    { topic: "바나나가 나무가 아닌 여러해살이풀인 이유", wikipediaTitle: "바나나" },
    { topic: "나무늘보의 느린 생활 방식", wikipediaTitle: "나무늘보" },
    { topic: "문어의 독특한 신체와 지능", wikipediaTitle: "문어" },
    { topic: "까마귀가 보여 주는 높은 문제 해결 능력", wikipediaTitle: "까마귀" },
    { topic: "홍학의 색과 무리 생활", wikipediaTitle: "플라밍고" },
    { topic: "웜뱃의 독특한 생태", wikipediaTitle: "웜뱃" },
    { topic: "근위대 계급을 받은 펭귄 닐스 올라프", wikipediaTitle: "닐스 올라브" },
  ],
  social_skills: [
    { topic: "보고 싶은 정보만 받아들이는 확증 편향", wikipediaTitle: "확증 편향" },
    { topic: "주변 사람이 많을수록 행동이 늦어지는 방관자 효과", wikipediaTitle: "방관자 효과" },
    { topic: "첫인상이 전체 평가를 좌우하는 후광 효과", wikipediaTitle: "후광 효과" },
    { topic: "자기 실력을 잘못 판단하는 더닝-크루거 효과", wikipediaTitle: "더닝-크루거 효과" },
    { topic: "표현 방식이 판단을 바꾸는 프레이밍 효과", wikipediaTitle: "프레이밍 효과" },
    { topic: "집단의 합의가 비판적 사고를 막는 집단사고", wikipediaTitle: "집단사고" },
    { topic: "협력과 개인 이익이 충돌하는 죄수의 딜레마", wikipediaTitle: "죄수의 딜레마" },
    { topic: "기대가 행동에 영향을 주는 피그말리온 효과", wikipediaTitle: "피그말리온 효과" },
  ],
  daily_tips: [
    { topic: "식중독의 원인과 예방 원칙", wikipediaTitle: "식중독" },
    { topic: "소화기의 종류와 기본 작동 원리", wikipediaTitle: "소화기" },
    { topic: "심폐소생술의 목적과 기본 원리", wikipediaTitle: "심폐소생술" },
    { topic: "전자레인지가 음식을 데우는 원리와 주의점", wikipediaTitle: "전자레인지" },
    { topic: "곰팡이가 자라는 조건과 생활 환경 관리", wikipediaTitle: "곰팡이" },
    { topic: "화재가 발생하는 조건과 예방 원칙", wikipediaTitle: "화재" },
    { topic: "화상의 종류와 기본적인 위험 이해", wikipediaTitle: "화상" },
    { topic: "냉장고의 작동 원리와 식품 보관", wikipediaTitle: "냉장고" },
  ],
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const CURRICULUM_START_DAY = Math.floor(Date.UTC(2026, 5, 29) / DAY_MS);
const MIN_TRIVIA_EXTRACT_LENGTH = 70;

const WIKIPEDIA_HEADERS = {
  accept: "application/json",
  "api-user-agent": "LifeQuiz/0.7 (https://github.com/JinHyunjun/life-quiz)",
};

export function triviaSourceForKstDay(category: ScheduledTriviaCategory, now = new Date()): TriviaSourceTopic {
  const dayNumber = Math.floor((now.getTime() + KST_OFFSET_MS) / DAY_MS);
  const curriculumDay = Math.max(0, dayNumber - CURRICULUM_START_DAY);
  const source = CURRICULUM[category][curriculumDay % CURRICULUM[category].length];
  return {
    category,
    ...source,
    sourceUrl: wikipediaPageUrl(source.wikipediaTitle),
  };
}

export async function fetchWikipediaSummary(topic: TriviaSourceTopic) {
  const url = `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.wikipediaTitle)}`;
  const response = await fetch(url, {
    headers: WIKIPEDIA_HEADERS,
  });

  if (response.ok) {
    const body = (await response.json()) as {
      title?: string;
      type?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    const extract = normalizeExtract(body.extract);
    if (body.type !== "disambiguation" && isUsableWikipediaExtract(extract)) {
      const title = body.title?.trim() || topic.wikipediaTitle;
      return wikipediaSource(topic, title, extract, body.content_urls?.desktop?.page);
    }
  }

  return fetchWikipediaIntro(topic);
}

export function isUsableWikipediaExtract(extract: string) {
  return normalizeExtract(extract).length >= MIN_TRIVIA_EXTRACT_LENGTH;
}

async function fetchWikipediaIntro(topic: TriviaSourceTopic) {
  const url = new URL("https://ko.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("prop", "extracts|info");
  url.searchParams.set("titles", topic.wikipediaTitle);
  url.searchParams.set("redirects", "1");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exchars", "1600");
  url.searchParams.set("inprop", "url");

  const response = await fetch(url, { headers: WIKIPEDIA_HEADERS });
  if (!response.ok) throw new Error(`Wikipedia intro failed: ${response.status} ${topic.wikipediaTitle}`);

  const body = (await response.json()) as {
    query?: { pages?: Array<{ title?: string; extract?: string; fullurl?: string; missing?: boolean }> };
  };
  const page = body.query?.pages?.[0];
  const extract = normalizeExtract(page?.extract);
  if (!page || page.missing || !isUsableWikipediaExtract(extract)) {
    throw new Error(`Wikipedia article had too little source text: ${topic.wikipediaTitle}`);
  }

  return wikipediaSource(topic, page.title?.trim() || topic.wikipediaTitle, extract, page.fullurl);
}

function wikipediaSource(topic: TriviaSourceTopic, title: string, extract: string, url?: string) {
  return {
    title,
    extract,
    url: url ?? topic.sourceUrl,
    citationLabel: `위키백과 '${title}' · CC BY-SA`,
  };
}

function normalizeExtract(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function wikipediaPageUrl(title: string) {
  return `https://ko.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}
