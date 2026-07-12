export const CATEGORY_LABELS = {
  finance: "금융",
  investment: "주식·투자",
  housing: "부동산",
  seoul_life: "서울살이",
  career: "직장·커리어",
  rights: "노동·생활법",
  digital_safety: "디지털 안전",
  health: "건강·마음",
  daily_tips: "생활상식",
  history: "역사",
  humor: "유머 상식",
  social_skills: "사회성·매너",
} as const;

export type Category = keyof typeof CATEGORY_LABELS;

export const CATEGORY_GROUPS = [
  {
    id: "money-home",
    label: "돈과 집",
    description: "월급 관리부터 투자, 계약, 서울 생활까지",
    categories: ["finance", "investment", "housing", "seoul_life"],
  },
  {
    id: "work-rights",
    label: "일과 권리",
    description: "첫 직장에 적응하고 내 권리를 지키는 법",
    categories: ["career", "rights", "social_skills"],
  },
  {
    id: "safe-life",
    label: "안전한 생활",
    description: "몸과 마음, 디지털, 자취 생활의 기본기",
    categories: ["digital_safety", "health", "daily_tips"],
  },
  {
    id: "culture-break",
    label: "교양과 쉼",
    description: "기억해두면 대화가 즐거워지는 가벼운 지식",
    categories: ["history", "humor"],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  description: string;
  categories: readonly Category[];
}[];

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  finance: "통장, 신용, 대출, 보험",
  investment: "주식, ETF, 위험과 수익",
  housing: "전월세, 계약, 실거래가",
  seoul_life: "교통, 행정, 자치구 생활",
  career: "업무 기본기와 성장",
  rights: "근로계약과 생활 속 권리",
  digital_safety: "피싱, 개인정보, 계정 보호",
  health: "수면, 스트레스, 건강관리",
  daily_tips: "자취와 소비 생활 요령",
  history: "오늘과 연결되는 역사",
  humor: "가볍고 의외인 사실",
  social_skills: "대화, 협업, 관계의 기술",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as Category] ?? category;
}
