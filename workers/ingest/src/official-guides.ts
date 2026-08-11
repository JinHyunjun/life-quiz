export type OfficialGuideCategory = "seoul_life" | "rights" | "digital_safety" | "health";

export interface OfficialGuideTopic {
  category: OfficialGuideCategory;
  topic: string;
  sourceUrl: string;
  citationLabel: string;
  dedupeKey: string;
  editorialFocus: string;
  edition: number;
}

const OFFICIAL_GUIDES: Record<OfficialGuideCategory, readonly Omit<OfficialGuideTopic, "category" | "dedupeKey" | "edition">[]> = {
  seoul_life: [
    {
      topic: "서울 1인가구 지원 서비스를 상황별로 찾는 법",
      sourceUrl: "https://www.seoul.go.kr/policy/view.do?id=63&lan=KO",
      citationLabel: "서울특별시 1인가구 지원 정책",
      editorialFocus: "병원 동행, 주거, 관계 지원을 상황별로 구분하고 신청 전 확인할 조건과 공식 문의 경로를 설명하세요.",
    },
    {
      topic: "청년몽땅정보통에서 내 조건에 맞는 서울 청년정책 찾기",
      sourceUrl: "https://youth.seoul.go.kr/infoData/plcyInfo/list.do",
      citationLabel: "서울특별시 청년몽땅정보통",
      editorialFocus: "정책 이름을 나열하지 말고 연령, 거주지, 취업 상태, 모집 기간을 확인하는 탐색 순서를 설명하세요.",
    },
    {
      topic: "서울 청년수당을 확인할 때 놓치기 쉬운 신청 조건",
      sourceUrl: "https://www.seoul.go.kr/policy/view.do?id=1054&lan=KO",
      citationLabel: "서울특별시 청년수당 정책",
      editorialFocus: "금액만 강조하지 말고 대상, 제외 조건, 신청 시점과 공식 공고 재확인 행동을 설명하세요.",
    },
  ],
  rights: [
    {
      topic: "첫 근로계약서에서 반드시 확인할 항목",
      sourceUrl: "https://www.moel.go.kr/mainpop2.do",
      citationLabel: "고용노동부 근로계약 안내",
      editorialFocus: "임금, 근로시간, 휴일, 연차와 서면 교부 여부를 실제 계약서 확인 순서로 설명하세요.",
    },
    {
      topic: "최저임금이 근로계약에 적용되는 기본 원리",
      sourceUrl: "https://m.easylaw.go.kr/MOB/CsmInfoRetrieve.laf?ccfNo=2&cciNo=1&cnpClsNo=1&csmSeq=1002",
      citationLabel: "찾기쉬운 생활법령 최저임금 안내",
      editorialFocus: "적용 원칙, 계약 금액이 기준보다 낮을 때의 효력과 최신 연도 금액을 다시 확인할 곳을 설명하세요.",
    },
  ],
  digital_safety: [
    {
      topic: "계정정보를 노리는 스미싱의 위험 신호와 대응 순서",
      sourceUrl: "https://www.boho.or.kr/common/cmm/fms/FileDown.do?atchFileId=FILE_000000000084934&fileSn=1",
      citationLabel: "KISA 보호나라 스미싱 주의 권고",
      editorialFocus: "링크, 앱 설치, 계정 입력 요구의 위험 신호와 피해 의심 직후 해야 할 행동을 순서대로 설명하세요.",
    },
    {
      topic: "피싱 범죄를 줄이기 위한 스마트폰 보안 점검",
      sourceUrl: "https://www.kisa.or.kr/402/form?lang_type=KO&postSeq=2585",
      citationLabel: "한국인터넷진흥원 피싱 예방 안내",
      editorialFocus: "특정 캠페인 홍보보다 일반 사용자가 메시지와 계정 설정에서 확인할 예방 행동을 추려 설명하세요.",
    },
  ],
  health: [
    {
      topic: "피곤함이 이어질 때 수면 건강을 점검하는 기준",
      sourceUrl: "https://health.kdca.go.kr/healthinfo/biz/health/ntcnInfo/healthSourc/thtimtCntnts/thtimtCntntsView.do?thtimt_cntnts_sn=171",
      citationLabel: "질병관리청 국가건강정보포털 수면 건강정보",
      editorialFocus: "자가진단을 단정하지 말고 생활 습관 점검, 지속되는 증상과 전문가 상담 기준을 구분하세요.",
    },
    {
      topic: "오래 앉아 일할 때 목과 손목 부담을 줄이는 방법",
      sourceUrl: "https://health.kdca.go.kr/healthinfo/biz/health/ntcnInfo/healthSourc/thtimtCntnts/thtimtCntntsView.do?thtimt_cntnts_sn=121",
      citationLabel: "질병관리청 국가건강정보포털 직장인 건강정보",
      editorialFocus: "업무 중 반복되는 자세 위험과 휴식, 작업 환경 조정, 진료가 필요한 신호를 구분하세요.",
    },
  ],
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const CURRICULUM_START_DAY = Math.floor(Date.UTC(2026, 7, 11) / DAY_MS);

export function officialGuideCandidatesForKstDay(
  category: OfficialGuideCategory,
  now = new Date(),
  count = 2,
): OfficialGuideTopic[] {
  const dayNumber = Math.floor((now.getTime() + KST_OFFSET_MS) / DAY_MS);
  const curriculumDay = Math.max(0, dayNumber - CURRICULUM_START_DAY);
  const curriculum = OFFICIAL_GUIDES[category];

  return Array.from({ length: Math.max(1, count) }, (_, offset) => {
    const position = curriculumDay + offset;
    const source = curriculum[position % curriculum.length];
    const edition = Math.floor(position / curriculum.length);
    return {
      category,
      ...source,
      dedupeKey: `${source.sourceUrl}#life-quiz-official-edition=${edition}`,
      edition,
    };
  });
}
