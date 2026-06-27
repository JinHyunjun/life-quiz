export type GlossaryCategory = "finance" | "housing";

const GLOSSARY_CURRICULUM: Record<GlossaryCategory, readonly string[]> = {
  finance: [
    "예금과 적금",
    "단리와 복리",
    "기준금리와 시장금리",
    "원금과 이자",
    "신용점수",
    "체크카드와 신용카드",
    "결제일과 이용기간",
    "할부와 리볼빙",
    "연체이자",
    "원리금균등상환",
    "원금균등상환",
    "만기일시상환",
    "고정금리와 변동금리",
    "DSR",
    "LTV",
    "중도상환수수료",
    "예금자보호",
    "CMA",
    "파킹통장",
    "ETF",
    "주식과 채권",
    "분산투자",
    "시가총액",
    "배당",
    "인플레이션",
    "세전과 세후",
    "소득공제와 세액공제",
    "연금저축과 IRP",
    "퇴직연금 DB형과 DC형",
    "비상금",
    "보험료와 보장금액",
    "실손보험",
    "환율",
    "복리의 72법칙",
    "가처분소득",
    "자동이체와 납부일",
    "대환대출",
    "마이너스통장",
    "총부채와 순자산",
    "재무제표 기초",
  ],
  housing: [
    "전세와 월세",
    "보증금과 월세",
    "등기부등본",
    "근저당권",
    "전입신고",
    "확정일자",
    "대항력",
    "우선변제권",
    "임대인과 임차인",
    "공인중개사",
    "중개보수",
    "가계약금",
    "계약금과 잔금",
    "특약",
    "전용면적과 공급면적",
    "평과 제곱미터",
    "관리비",
    "공용관리비와 개별사용료",
    "다가구와 다세대",
    "빌라와 오피스텔",
    "주택임대차계약 신고",
    "전세보증금 반환보증",
    "깡통전세",
    "전세사기 위험 신호",
    "선순위 권리",
    "임차권등기명령",
    "묵시적 갱신",
    "계약갱신요구권",
    "청년 전세자금대출",
    "공공임대주택",
    "청약통장",
    "무주택 세대구성원",
    "용도지역",
    "실거래가와 호가",
    "공시가격",
    "취득세",
    "재산세",
    "하자 점검",
    "원상복구",
    "이사 전 체크리스트",
  ],
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const CURRICULUM_START_DAY = Math.floor(Date.UTC(2026, 5, 27) / DAY_MS);

export function glossaryTopicsForKstDay(now = new Date()) {
  const dayNumber = Math.floor((now.getTime() + KST_OFFSET_MS) / DAY_MS);
  const curriculumDay = Math.max(0, dayNumber - CURRICULUM_START_DAY);

  return (["finance", "housing"] as const).map((category) => {
    const curriculum = GLOSSARY_CURRICULUM[category];
    const term = curriculum[curriculumDay % curriculum.length];
    return {
      category,
      term,
      url: `internal://glossary/${category}/${encodeURIComponent(term)}`,
    };
  });
}
