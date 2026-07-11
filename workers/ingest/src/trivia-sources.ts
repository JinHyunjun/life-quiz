import type { ScheduledTriviaCategory } from "./schedule";
import { readTextLimited } from "./fetchers/http.ts";

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
    { topic: "첨성대가 고대 천문 관측을 보여 주는 방식", wikipediaTitle: "첨성대" },
    { topic: "고려청자의 빛깔과 제작 기술", wikipediaTitle: "고려청자" },
    { topic: "삼국사기가 고대사를 기록한 방식", wikipediaTitle: "삼국사기" },
    { topic: "수원 화성에 적용된 조선 후기 건축 기술", wikipediaTitle: "수원 화성" },
    { topic: "독립신문이 근대 언론에 남긴 의미", wikipediaTitle: "독립신문" },
    { topic: "조선 통신사가 한일 교류에서 맡은 역할", wikipediaTitle: "조선 통신사" },
    { topic: "거북선의 구조와 임진왜란에서의 역할", wikipediaTitle: "거북선" },
    { topic: "실학이 현실 문제를 바라본 관점", wikipediaTitle: "실학" },
    { topic: "한글날이 만들어지고 기념일이 된 과정", wikipediaTitle: "한글날" },
    { topic: "백제 금동대향로가 보여 주는 백제 문화", wikipediaTitle: "백제 금동대향로" },
    { topic: "3·1 운동이 전국으로 확산된 과정", wikipediaTitle: "3·1 운동" },
    { topic: "대한민국 임시정부가 수행한 역할", wikipediaTitle: "대한민국 임시정부" },
    { topic: "로제타석이 고대 문자를 해독하는 열쇠가 된 이유", wikipediaTitle: "로제타석" },
    { topic: "실크로드가 물건과 문화를 이동시킨 방식", wikipediaTitle: "실크로드" },
    { topic: "구텐베르크 인쇄술이 지식 확산을 바꾼 과정", wikipediaTitle: "요하네스 구텐베르크" },
    { topic: "산업혁명이 일과 도시 생활을 바꾼 과정", wikipediaTitle: "산업혁명" },
    { topic: "폼페이가 고대 도시 생활을 보존하게 된 이유", wikipediaTitle: "폼페이" },
    { topic: "그레고리력이 오늘날 달력의 기준이 된 과정", wikipediaTitle: "그레고리력" },
    { topic: "만국박람회가 새 기술을 소개한 방식", wikipediaTitle: "만국 박람회" },
    { topic: "표준시가 철도와 통신의 발달로 필요해진 이유", wikipediaTitle: "표준시" },
    { topic: "올림픽 성화 봉송 전통이 만들어진 과정", wikipediaTitle: "올림픽 성화" },
    { topic: "도서관 분류법이 책을 찾는 방식을 바꾼 원리", wikipediaTitle: "듀이 십진분류법" },
    { topic: "우편 제도가 먼 거리 소통을 표준화한 과정", wikipediaTitle: "우편" },
    { topic: "국제단위계가 측정 기준을 통일한 이유", wikipediaTitle: "국제단위계" },
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
    { topic: "옥수수 알갱이가 팝콘으로 터지는 원리", wikipediaTitle: "팝콘" },
    { topic: "접착력이 약한 실험이 포스트잇이 된 과정", wikipediaTitle: "포스트잇" },
    { topic: "포장재 버블랩이 처음 구상된 용도", wikipediaTitle: "버블랩" },
    { topic: "지퍼가 작은 이빨로 옷을 여미는 원리", wikipediaTitle: "지퍼" },
    { topic: "도꼬마리 열매에서 아이디어를 얻은 벨크로", wikipediaTitle: "벨크로" },
    { topic: "연필심에 납이 들어 있지 않은 이유", wikipediaTitle: "연필" },
    { topic: "지우개가 흑연 자국을 없애는 방식", wikipediaTitle: "지우개" },
    { topic: "풍선껌이 크게 부풀 수 있는 재료의 특징", wikipediaTitle: "풍선껌" },
    { topic: "보온병이 열의 이동을 늦추는 원리", wikipediaTitle: "보온병" },
    { topic: "신호등의 색과 순서가 표준화된 이유", wikipediaTitle: "신호등" },
    { topic: "에스컬레이터의 계단이 평평해지는 구조", wikipediaTitle: "에스컬레이터" },
    { topic: "자판기가 동전과 상품을 구분하는 방식", wikipediaTitle: "자동판매기" },
    { topic: "종이 클립이 단순한 철사 모양으로 종이를 잡는 원리", wikipediaTitle: "종이 클립" },
    { topic: "빨대가 압력 차이로 음료를 올리는 원리", wikipediaTitle: "빨대" },
    { topic: "우산의 접이식 살대가 펼쳐지는 구조", wikipediaTitle: "우산" },
    { topic: "단추와 단춧구멍이 옷을 여미는 방식", wikipediaTitle: "단추" },
    { topic: "주사위 눈의 배열에 숨은 규칙", wikipediaTitle: "주사위" },
    { topic: "카드 놀이 한 벌의 모양과 숫자 구성", wikipediaTitle: "플레잉 카드" },
    { topic: "직소 퍼즐의 조각이 맞물리는 원리", wikipediaTitle: "직소 퍼즐" },
    { topic: "루빅스 큐브가 회전하면서도 붙어 있는 구조", wikipediaTitle: "루빅스 큐브" },
    { topic: "요요가 줄을 타고 다시 올라오는 원리", wikipediaTitle: "요요" },
    { topic: "종이비행기의 모양이 비행 거리에 미치는 영향", wikipediaTitle: "종이비행기" },
    { topic: "착시가 눈보다 뇌의 해석과 관련된 이유", wikipediaTitle: "착시" },
    { topic: "처음 겪는 일을 익숙하게 느끼는 데자뷔", wikipediaTitle: "데자뷔" },
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
    { topic: "서로 모순되는 생각이 불편함을 만드는 인지 부조화", wikipediaTitle: "인지 부조화" },
    { topic: "상황보다 성격 탓으로 돌리기 쉬운 기본적 귀인 오류", wikipediaTitle: "기본적 귀인 오류" },
    { topic: "처음 제시된 숫자가 판단 기준이 되는 앵커링", wikipediaTitle: "앵커링" },
    { topic: "쉽게 떠오르는 사례를 더 흔하다고 보는 가용성 휴리스틱", wikipediaTitle: "가용성 휴리스틱" },
    { topic: "이미 쓴 비용 때문에 결정을 바꾸지 못하는 매몰 비용", wikipediaTitle: "매몰 비용" },
    { topic: "변화를 피하고 현재 상태를 유지하려는 현상 유지 편향", wikipediaTitle: "현상 유지 편향" },
    { topic: "다수의 선택을 따라가게 되는 동조", wikipediaTitle: "동조" },
    { topic: "상대의 말을 확인하며 듣는 적극적 경청", wikipediaTitle: "적극적 경청" },
    { topic: "관찰과 감정을 구분해 말하는 비폭력대화", wikipediaTitle: "비폭력대화" },
    { topic: "의견 차이를 조정해 합의를 만드는 협상", wikipediaTitle: "협상" },
    { topic: "다른 사람의 감정을 이해하는 공감", wikipediaTitle: "공감" },
    { topic: "자신과 타인의 심리적 경계를 구분하는 방법", wikipediaTitle: "개인적 경계" },
    { topic: "예상보다 일을 오래 잡게 되는 계획 오류", wikipediaTitle: "계획 오류" },
    { topic: "자기 관점을 다른 사람도 안다고 여기는 지식의 저주", wikipediaTitle: "지식의 저주" },
    { topic: "자기 집단을 더 좋게 평가하는 내집단 편향", wikipediaTitle: "내집단 편향" },
    { topic: "다른 사람을 돕는 친사회적 행동", wikipediaTitle: "친사회적 행동" },
    { topic: "선물을 받으면 돌려주고 싶어지는 상호성", wikipediaTitle: "상호성" },
    { topic: "다른 사람의 행동을 판단 기준으로 삼는 사회적 증거", wikipediaTitle: "사회적 증거" },
    { topic: "자주 접한 대상을 더 친숙하게 느끼는 단순 노출 효과", wikipediaTitle: "단순 노출 효과" },
    { topic: "평가보다 구체적인 행동을 다루는 피드백", wikipediaTitle: "피드백" },
    { topic: "의견 충돌이 관계 갈등으로 번지는 과정", wikipediaTitle: "갈등" },
    { topic: "부정적인 정보에 더 크게 반응하는 부정성 편향", wikipediaTitle: "부정성 편향" },
    { topic: "자신에게 유리하게 원인을 해석하는 자기본위 편향", wikipediaTitle: "자기본위 편향" },
    { topic: "소수가 침묵하면서 다수 의견처럼 보이는 침묵의 나선", wikipediaTitle: "침묵의 나선" },
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
    { topic: "세탁기가 물과 회전으로 때를 빼는 원리", wikipediaTitle: "세탁기" },
    { topic: "세제가 물과 기름 사이에서 작동하는 원리", wikipediaTitle: "세제" },
    { topic: "표백제의 종류와 섞어 쓰면 안 되는 이유", wikipediaTitle: "표백제" },
    { topic: "실내 환기가 오염 물질과 습기를 줄이는 이유", wikipediaTitle: "환기" },
    { topic: "창문에 결로가 생기는 조건과 줄이는 방법", wikipediaTitle: "결로" },
    { topic: "일산화탄소가 눈에 보이지 않아 위험한 이유", wikipediaTitle: "일산화 탄소" },
    { topic: "누전 차단기가 전기를 끊는 원리", wikipediaTitle: "누전 차단기" },
    { topic: "식품을 안전하게 보관하기 위한 온도와 시간", wikipediaTitle: "식품 저장" },
    { topic: "냉동이 식품 변화를 늦추는 원리", wikipediaTitle: "냉동" },
    { topic: "냉동식품을 안전하게 해동하는 방법", wikipediaTitle: "해동" },
    { topic: "소비기한과 유통기한을 구분해 읽는 법", wikipediaTitle: "소비기한" },
    { topic: "재활용품을 재질별로 나누는 이유", wikipediaTitle: "재활용" },
    { topic: "건전지를 종류에 맞게 보관하고 버리는 방법", wikipediaTitle: "전지" },
    { topic: "보조배터리의 리튬 이온 전지를 안전하게 쓰는 법", wikipediaTitle: "리튬 이온 전지" },
    { topic: "멀티탭의 허용 전력을 넘기면 위험한 이유", wikipediaTitle: "멀티탭" },
    { topic: "가습기를 깨끗하게 관리해야 하는 이유", wikipediaTitle: "가습기" },
    { topic: "제습기가 공기 속 수분을 모으는 원리", wikipediaTitle: "제습기" },
    { topic: "압력솥이 음식을 더 빨리 익히는 원리", wikipediaTitle: "압력솥" },
    { topic: "자동심장충격기가 심장 리듬을 확인하는 역할", wikipediaTitle: "자동심장충격기" },
    { topic: "상처가 났을 때 필요한 기본 응급처치", wikipediaTitle: "응급처치" },
    { topic: "소화전과 소화기를 상황에 맞게 구분하는 법", wikipediaTitle: "소화전" },
    { topic: "전기 화재에 물을 쓰면 위험한 이유", wikipediaTitle: "전기화재" },
    { topic: "비상식량을 고를 때 보관 기간과 영양을 보는 법", wikipediaTitle: "비상식량" },
    { topic: "청소할 때 산성 세제와 염소계 세제를 섞으면 안 되는 이유", wikipediaTitle: "염소" },
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
  try {
    const response = await fetch(url, { headers: WIKIPEDIA_HEADERS });
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
        if (extract.length < 500) {
          try {
            return await fetchWikipediaIntro(topic);
          } catch {
            // Keep the usable REST summary when the longer endpoint is blocked.
          }
        }
        return wikipediaSource(topic, title, extract, body.content_urls?.desktop?.page);
      }
    }
  } catch {
    // Try the alternate endpoints below.
  }

  try {
    return await fetchWikipediaIntro(topic);
  } catch {
    try {
      return await fetchWikimediaPageSource(topic);
    } catch {
      return fetchWikipediaReaderFallback(topic);
    }
  }
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

async function fetchWikipediaReaderFallback(topic: TriviaSourceTopic) {
  const readerUrl = `https://r.jina.ai/http://ko.wikipedia.org/wiki/${encodeURIComponent(topic.wikipediaTitle.replace(/ /g, "_"))}`;
  const response = await fetch(readerUrl, {
    headers: {
      accept: "text/plain",
      "x-return-format": "markdown",
    },
  });
  if (!response.ok) throw new Error(`Wikipedia reader fallback failed: ${response.status} ${topic.wikipediaTitle}`);

  const markdown = await readTextLimited(response, 18_000);
  const extract = normalizeReaderExtract(markdown).slice(0, 7_000);
  if (!isUsableWikipediaExtract(extract)) {
    throw new Error(`Wikipedia reader fallback had too little source text: ${topic.wikipediaTitle}`);
  }
  return wikipediaSource(topic, topic.wikipediaTitle, extract, topic.sourceUrl);
}

async function fetchWikimediaPageSource(topic: TriviaSourceTopic) {
  const url = `https://api.wikimedia.org/core/v1/wikipedia/ko/page/${encodeURIComponent(topic.wikipediaTitle.replace(/ /g, "_"))}`;
  const response = await fetch(url, { headers: WIKIPEDIA_HEADERS });
  if (!response.ok) throw new Error(`Wikimedia page source failed: ${response.status} ${topic.wikipediaTitle}`);

  const body = JSON.parse(await readTextLimited(response, 256_000)) as { title?: string; source?: string };
  const title = body.title?.trim() || topic.wikipediaTitle;
  const extract = normalizeWikitextLead(body.source);
  if (!isUsableWikipediaExtract(extract)) {
    throw new Error(`Wikimedia page source had too little source text: ${topic.wikipediaTitle}`);
  }
  return wikipediaSource(topic, title, extract.slice(0, 7_000), wikipediaPageUrl(title));
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

function normalizeReaderExtract(value: string) {
  return value
    .replace(/^.*?Markdown Content:\s*/s, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\[?\d+\]?\]/g, " ")
    .replace(/[*#>`_|~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeWikitextLead(value: string | undefined) {
  if (!value) return "";
  let lead = value.split(/\n==[^=]/, 1)[0];
  const firstDefinition = lead.indexOf("'''");
  if (firstDefinition >= 0) lead = lead.slice(firstDefinition);
  return lead
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, " ")
    .replace(/<ref\b[^>]*\/>/gi, " ")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\[(?:https?:\/\/\S+)(?:\s+([^\]]+))?\]/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/'{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wikipediaPageUrl(title: string) {
  return `https://ko.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}
