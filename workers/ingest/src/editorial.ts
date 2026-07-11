export type SourcedContentCategory =
  | "finance"
  | "investment"
  | "housing"
  | "seoul_life"
  | "daily_tips"
  | "social_skills";

export interface EditorialPlan {
  category: SourcedContentCategory;
  focus: string;
  matchedTerms: string[];
}

interface CategoryRule {
  category: SourcedContentCategory;
  focus: string;
  keywords: readonly string[];
  strongKeywords: readonly string[];
}

const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: "finance",
    focus: "월급 관리, 신용, 대출, 세금, 보험처럼 개인의 돈 관리에 미치는 영향과 확인할 행동",
    keywords: [
      "금리", "대출", "예금", "적금", "신용", "카드", "보험", "연금", "세금", "월급", "소득",
      "은행", "환율", "물가", "금융", "재무", "금융교육", "자산관리", "보험금", "가계", "채무", "이자", "상속", "연말정산",
    ],
    strongKeywords: ["리볼빙", "신용점수", "예금자보호", "dsr", "대환대출", "연말정산"],
  },
  {
    category: "investment",
    focus: "시장 뉴스 자체보다 초보 투자자가 이해해야 할 원리, 지표, 위험과 판단 기준",
    keywords: [
      "주식", "증시", "코스피", "코스닥", "etf", "채권", "펀드", "배당", "공시", "상장", "투자",
      "수익률", "자산배분", "주가", "기업가치", "고용지표",
    ],
    strongKeywords: ["코스피", "코스닥", "etf", "채권", "배당", "공모주", "리밸런싱"],
  },
  {
    category: "housing",
    focus: "집을 구하거나 계약할 때 드는 비용, 권리 보호, 계약 확인 순서와 위험 신호",
    keywords: [
      "주택", "아파트", "전세", "월세", "부동산", "임대", "청약", "분양", "보증금", "주거",
      "전입", "등기", "관리비", "임차", "계약갱신",
    ],
    strongKeywords: ["전세", "월세", "청약", "보증금", "등기부", "확정일자", "전입신고"],
  },
  {
    category: "seoul_life",
    focus: "서울에서 독립 생활할 때 실제로 이용할 수 있는 제도, 교통, 주거·생활 행정 정보",
    keywords: [
      "서울", "청년정책", "청년 지원", "대중교통", "기후동행", "생활쓰레기", "주민센터", "서울시",
      "자치구", "1인가구",
    ],
    strongKeywords: ["청년정책", "기후동행카드", "생활쓰레기", "1인가구", "서울청년"],
  },
  {
    category: "daily_tips",
    focus: "자취와 소비 생활에서 비용이나 실수를 줄이기 위해 바로 확인할 수 있는 절차",
    keywords: [
      "환불", "소비자", "보상", "통신비", "구독", "계약 해지", "공과금", "전기요금", "가스요금",
      "생활비", "택배", "사기", "수수료", "피해구제",
    ],
    strongKeywords: ["환불", "피해구제", "공과금", "구독 해지", "소비자보호"],
  },
  {
    category: "social_skills",
    focus: "첫 직장에서 오해와 갈등을 줄이기 위한 대화, 협업, 보고와 경계 설정 방법",
    keywords: [
      "직장생활", "조직문화", "직장 갈등", "직장갈등", "대화법", "피드백", "상사와", "동료와",
      "회의 문화", "업무 보고", "협업", "직장 내 괴롭힘", "노동 상담", "노동상담", "신입사원",
      "사회초년생", "커뮤니케이션",
    ],
    strongKeywords: ["직장 내 괴롭힘", "조직문화", "직장 갈등", "직장갈등", "대화법", "피드백"],
  },
];

const OFF_TOPIC_TERMS = [
  "연예", "스포츠", "신차", "suv", "맛집", "빵집", "패션", "게임 출시", "드라마", "공연",
] as const;

export function classifyNewsForBeginners(title: string, summary = ""): EditorialPlan | null {
  const normalizedTitle = normalize(title);
  const normalizedSummary = normalize(summary);
  const combined = `${normalizedTitle} ${normalizedSummary}`;

  const candidates = CATEGORY_RULES.map((rule) => {
    const matchedTerms = rule.keywords.filter((keyword) => combined.includes(keyword));
    const strongMatches = rule.strongKeywords.filter((keyword) => combined.includes(keyword));
    const titleMatches = matchedTerms.filter((keyword) => normalizedTitle.includes(keyword));
    const score = matchedTerms.length + titleMatches.length + strongMatches.length * 2;
    return { rule, matchedTerms: [...new Set([...matchedTerms, ...strongMatches])], strongMatches, score };
  }).sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || (best.matchedTerms.length < 2 && best.strongMatches.length === 0)) return null;

  const hasOffTopicTerm = OFF_TOPIC_TERMS.some((term) => combined.includes(term));
  if (hasOffTopicTerm && best.strongMatches.length === 0) return null;

  return {
    category: best.rule.category,
    focus: best.rule.focus,
    matchedTerms: best.matchedTerms,
  };
}

const YOUTUBE_EDITORIAL_PLANS: readonly (EditorialPlan & { query: string })[] = [
  {
    query: "사회초년생 금융 기초 신용 대출",
    category: "finance",
    focus: "사회초년생이 월급과 신용을 관리할 때 바로 적용할 수 있는 금융 기초",
    matchedTerms: [],
  },
  {
    query: "서울 자취 1인가구 생활 행정 팁",
    category: "seoul_life",
    focus: "서울 자취생이 실제 생활에서 확인할 수 있는 행정 절차와 비용 절약 방법",
    matchedTerms: [],
  },
  {
    query: "청년 전월세 계약 주거 기초",
    category: "housing",
    focus: "청년 임차인이 계약 전후에 확인할 권리, 비용, 위험 신호",
    matchedTerms: [],
  },
  {
    query: "직장생활 매너 대화 갈등 해결",
    category: "social_skills",
    focus: "첫 직장에서 오해를 줄이는 구체적인 대화와 갈등 대응 방법",
    matchedTerms: [],
  },
];

export function youtubeEditorialPlanForKstSlot(now = new Date()) {
  return youtubeEditorialPlansForKstRun(now)[0];
}

export function youtubeEditorialPlansForKstRun(now = new Date()) {
  const kstHour = new Date(now.getTime() + 9 * 60 * 60 * 1_000).getUTCHours();
  const slot = Math.floor(kstHour / 6) % YOUTUBE_EDITORIAL_PLANS.length;
  return YOUTUBE_EDITORIAL_PLANS.map((_, index) => YOUTUBE_EDITORIAL_PLANS[(slot + index) % YOUTUBE_EDITORIAL_PLANS.length]);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}
