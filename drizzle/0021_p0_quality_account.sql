ALTER TABLE `ingestion_runs` ADD `quality_checked_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_runs` ADD `quality_hidden_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_runs` ADD `quality_hidden_items` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `support_requests` ADD `notification_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `support_requests` ADD `notification_attempted_at` integer;--> statement-breakpoint
ALTER TABLE `support_requests` ADD `notification_error` text;--> statement-breakpoint

UPDATE `content_items`
SET
	`body_md` = '## 먼저 자격부터 확인하세요

LH 청년 주거 지원은 높은 월세와 보증금이 부담스러운 청년에게 시세보다 낮은 임대료의 주택이나 보증금 지원 기회를 제공하는 제도입니다. 다만 청년, 대학생, 취업준비생처럼 신청 유형에 따라 나이·소득·자산·무주택 요건과 우선순위가 달라집니다. 공고 이름만 보고 판단하지 말고 해당 모집 공고의 자격 기준일과 제출 서류를 먼저 확인해야 합니다.

## 공고문에서 볼 항목

LH 청약플러스에서 지역, 임대 유형, 접수 기간, 보증금과 월 임대료, 계약 기간을 차례로 비교하세요. 비슷한 이름의 공고라도 공급 지역과 신청 대상이 다를 수 있습니다. 관심 공고를 찾았다면 신청 마감일뿐 아니라 서류 제출일과 당첨 발표일도 함께 기록해두는 편이 안전합니다.

## 비용은 전체로 계산하세요

저렴한 임대료만 보지 말고 보증금 마련 비용, 관리비, 교통비, 이사비까지 합쳐 현재 소득으로 감당 가능한지 계산해야 합니다. 대출을 함께 이용한다면 금리와 상환 일정도 포함하세요. 사회초년생, 대학생이라면 시세보다 저렴한 임대료로 거주할 수 있는 청년 맞춤형 주택을 눈여겨보세요.

## 신청 전 체크리스트

높은 월세가 고민이라면 LH의 청년 임대주택과 지원 정책을 후보에 넣고, 본인의 자격과 실제 총주거비를 함께 비교하세요. LH 청약플러스 공식 홈페이지에서 현재 모집 중인 공고를 확인하고, 모집 공고 원문·필요 서류·마감 일정을 직접 검토한 뒤 신청하는 것이 마지막 단계입니다.',
	`cards` = '[{"heading":"주거비 부담을 줄이는 선택지","body":"높은 월세가 고민이라면 LH의 청년 임대주택과 지원 정책을 주거 후보에 넣어보세요."},{"heading":"신청 자격부터 확인","body":"청년·대학생·취업준비생 등 유형마다 나이, 소득, 자산, 무주택 요건이 달라 공고문 확인이 먼저입니다."},{"heading":"총주거비로 비교","body":"임대료뿐 아니라 보증금 마련 비용, 관리비, 교통비와 대출 상환액까지 합쳐 비교하세요."},{"heading":"공식 공고로 마무리","body":"LH 청약플러스에서 모집 공고 원문, 필요 서류, 접수 마감일과 발표 일정을 직접 확인하세요."}]',
	`moderation_status` = 'published',
	`moderation_reason` = NULL
WHERE `id` = 29;--> statement-breakpoint

UPDATE `content_items`
SET
	`body_md` = '## 전세 가격보다 먼저 볼 것

전세 가격이 오를 때 사회초년생이 해야 할 일은 시장을 맞히는 것이 아니라 감당 가능한 주거비의 상한을 정하는 것입니다. 보증금 전액을 마련할 수 있는지, 대출 이자와 관리비를 포함한 월 부담이 소득에서 어느 정도를 차지하는지 계산하세요. 시장 상황과 관계없이 무리하게 대출을 늘리면 금리나 소득 변화에 취약해집니다.

## 대출은 조건을 비교하세요

버팀목 전세자금대출처럼 청년이 확인할 수 있는 지원 상품은 대상, 소득·자산 기준, 보증금 한도, 금리와 보증 요건이 서로 다릅니다. 상품 이름만 보고 신청하지 말고 주택도시기금 등 공식 안내와 실제 모집·대출 기준을 확인해야 합니다. 실행 전에는 원금과 이자를 언제, 얼마씩 갚는지도 표로 만들어보세요.

## 계약 안전장치

등기부등본에서 소유자와 근저당을 확인하고, 계약 상대가 소유자와 일치하는지 점검하세요. 전입신고와 확정일자, 전세보증금 반환보증 가능 여부도 계약 전에 확인하는 편이 안전합니다. 특약에는 잔금 전 권리관계 변동, 대출 불승인, 보증 가입 불가 시 대응을 구체적으로 적습니다.

## 현실적인 의사결정

자신의 소득과 예산에 맞는 주거 계획을 세우고, 지원 상품과 정부 정책 정보를 주기적으로 확인하세요. 후보 주택은 보증금·월 비용·통근 시간·계약 위험을 같은 기준으로 비교하고, 이해하기 어려운 계약 조항은 서명 전에 공인중개사나 전문 상담 창구에 확인하는 것이 좋습니다.',
	`cards` = '[{"heading":"예산 상한부터 정하기","body":"전세 가격 전망보다 소득으로 감당할 수 있는 보증금, 이자, 관리비의 상한을 먼저 계산하세요."},{"heading":"지원 상품 조건 비교","body":"버팀목 전세자금대출 등은 대상, 소득·자산 기준, 한도와 금리가 달라 공식 조건을 확인해야 합니다."},{"heading":"계약 위험 점검","body":"등기부등본, 소유자 일치, 전입신고·확정일자와 반환보증 가능 여부를 계약 전에 확인하세요."},{"heading":"후보를 같은 표로 비교","body":"보증금·월 부담·통근 시간·계약 위험을 같은 기준으로 비교하고 무리한 대출은 피하세요."}]',
	`moderation_status` = 'published',
	`moderation_reason` = NULL
WHERE `id` = 30;
