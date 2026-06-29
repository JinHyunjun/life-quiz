CREATE TABLE `learning_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`content_item_id` integer NOT NULL,
	`enrolled_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_items_user_content_unique` ON `learning_items` (`user_id`,`content_item_id`);--> statement-breakpoint
CREATE INDEX `learning_items_user_enrolled_idx` ON `learning_items` (`user_id`,`enrolled_at`);--> statement-breakpoint
ALTER TABLE `content_items` ADD `moderation_status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `content_items` ADD `moderation_reason` text;--> statement-breakpoint
CREATE INDEX `content_items_status_category_created_idx` ON `content_items` (`moderation_status`,`category`,`created_at`);--> statement-breakpoint
UPDATE `content_items`
SET `moderation_status` = 'hidden',
	`moderation_reason` = '외부 원문 없이 생성된 기존 AI 상식: 출처 재검증 대기'
WHERE `content_format` = 'article'
	AND `source_id` IN (
		SELECT `id` FROM `sources` WHERE `origin_type` = 'ai_trivia'
	);--> statement-breakpoint
UPDATE `content_items`
SET `moderation_status` = 'hidden',
	`moderation_reason` = '사회초년생 핵심 생활상식과 관련성이 낮아 비공개'
WHERE `title` IN (
	'가전의 도시 광주가 반도체 기지로? 삼성전자의 깜짝 변신',
	'80년대를 휩쓸고 유튜브 레전드가 된 그 노래, ''Never Gonna Give You Up''',
	'요즘 위스키는 안주가 주인공? ''미식''에 빠진 위스키 트렌드',
	'제네시스가 24시간 ''지옥의 레이스''에 뛰어든 이유',
	'애플 가격 인상설, 지금 사야 할까?',
	'여행 플랫폼 선택 가이드: 야놀자와 여기어때 비교',
	'국민 간식의 귀환, 떡볶이 시장의 변화',
	'3만 원으로 완성하는 가성비 패션 스타일링',
	'BMW 신형 SUV의 파격적인 디자인 변화와 특징',
	'반도체 공급망의 핵심, 일본 소재 산업의 위상',
	'삼성바이오로직스 노조의 독자 노선 결정',
	'만원으로 즐기는 가성비 빵집 탐구'
);--> statement-breakpoint
UPDATE `content_items`
SET `category` = 'social_skills'
WHERE `title` = '삼성전자 퇴직률이 떨어진 진짜 이유? 아빠들의 육아휴직!';--> statement-breakpoint
UPDATE `content_items`
SET `category` = 'investment'
WHERE `title` = 'AI 열풍 뒤에 숨은 진짜 수혜자? 구리와 원유에 주목하는 이유';--> statement-breakpoint
UPDATE `content_items`
SET `category` = 'finance'
WHERE `title` = '기초연금 수급 탈락자 증가의 배경과 이해';--> statement-breakpoint
UPDATE `content_items`
SET `category` = 'daily_tips'
WHERE `title` = '결제 단말기 장애 시 보상 규정 이해하기';--> statement-breakpoint
UPDATE `content_items`
SET `citation_label` = '금융감독원 금융교육센터 참고 · AI 재구성',
	`citation_url` = 'https://www.fss.or.kr/edu/main/main.do'
WHERE `content_format` = 'visual_guide'
	AND `category` = 'finance';--> statement-breakpoint
UPDATE `content_items`
SET `citation_label` = '찾기쉬운 생활법령 주택임대차 참고 · AI 재구성',
	`citation_url` = 'https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=2&cciNo=2&cnpClsNo=1&csmSeq=629&popMenu=ov'
WHERE `content_format` = 'visual_guide'
	AND `category` = 'housing';--> statement-breakpoint
INSERT OR IGNORE INTO `learning_items` (`user_id`, `content_item_id`, `enrolled_at`)
SELECT `review_logs`.`user_id`, `quiz_items`.`content_item_id`, CAST(strftime('%s', 'now') AS INTEGER)
FROM `review_logs`
INNER JOIN `quiz_items` ON `quiz_items`.`id` = `review_logs`.`quiz_item_id`
GROUP BY `review_logs`.`user_id`, `quiz_items`.`content_item_id`;
