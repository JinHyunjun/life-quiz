# 라이프퀴즈

사회초년생에게 필요한 돈, 집, 직장, 권리, 디지털 안전, 건강과 교양 상식을 출처와 함께 큐레이션하고 FSRS 복습으로 오래 기억하게 돕는 서비스입니다. Gemini는 배치 수집 시 콘텐츠와 퀴즈를 만들고, `라이프 메이트`에서는 저장된 콘텐츠를 근거로 질문에 답합니다.

## 현재 기능

- KST 00시 기준 오늘 피드와 키워드·날짜·분야·출처·페이지별 지난 상식 보관함
- 돈과 집, 일과 권리, 안전한 생활, 교양과 쉼으로 묶은 12개 주제 지식 지도와 오늘 분야별 생성 수
- FSRS 복습 최대 2장과 서로 다른 분야의 새 상식을 합친 브라우저별 `오늘의 5분 학습` (`/daily`)
- 최대 5개 관심 분야를 고르면 다음에 만드는 5분 학습에서 선호 분야를 먼저 보여주는 개인화
- 첫 방문에서 필요한 분야 2~3개를 고르고 개인화된 5분 학습으로 바로 이동하는 온보딩
- 연속 학습일·최근 7일 활동·누적 복습·기억 성공률·분야별 기억 현황을 모아보는 `내 학습` (`/me`)
- 글 상세에서 다시 보고 싶은 상식을 저장하고 `내 학습`에서 모아보거나 해제하는 브라우저별 보관 기능
- 로그인 없이 익명으로 계속 쓰거나 better-auth 이메일 계정으로 현재 기록을 합쳐 여러 기기에서 이어 쓰는 선택형 동기화 (`/login`, `/account`)
- 서울 25개 자치구 중 배치마다 4개 구를 순환하고 전월세·매매를 교대하는 비교 브리핑 1건과 생활정보 비교 브리핑으로 통합
- 분야별 상식 피드와 실제 외부 원문으로 이동하는 SOURCE 영역
- 금융·투자·주거 기초를 생성 순서대로 묶어 주는 사회초년생 시작 코스 (`/start`)
- Gemini가 하나의 학습 섹션에서 함께 생성하고 의미 중복 검사를 통과한 Quick Read와 소제목형 Deep Read
- 금융·주식 투자·부동산 초보 용어를 정의·구조·사례·체크포인트로 설명하는 4컷 가이드
- 글 상세에서 직접 담은 콘텐츠만 보여주는 브라우저별 익명 복습 큐와 `ts-fsrs` 다음 복습일 계산
- 글 상세의 도움됨·이해 어려움·중복·오래된 정보·출처·퀴즈 문제 피드백과 운영자용 콘텐츠 QA 큐
- 선택한 글 또는 최근 콘텐츠 6개를 근거로 답하는 라이프 메이트
- D1 기반 익명 챗 사용량 제한: IP와 User-Agent의 SHA-256 해시 기준 시간당 8회
- Cloudflare에서 실제 응답이 검증된 금융위원회 공식 RSS의 분야 균형 선별, YouTube 8개 주제별 최근 180일 후보 5개 메타데이터, data.go.kr, 위키백과 원문 기반 AI 상식 수집 Cron
- D1 `ingestion_runs`에 회차별 생성·중복·지연·실패와 RSS·YouTube·공공 API별 후보 수·오류를 남기는 수집 진단 로그
- 운영자 대시보드에서 최근 7일·28일 방문→학습 시작→첫 답변→완료 퍼널과 계정 생성·로그인·기록 연결, 최근 14일 Gemini 요청량, 최근 7일 수집원 상태, 오늘 누락 분야 확인
- KST 18:15 전에는 수집 진행 상태로 표시하고 이후 `10/12개 분야·12개 이상·단일 분야 35% 이하`, 48시간 `12/12개 분야`를 판정하는 공급 SLO
- 12개 분야의 일일 최소 1개를 우선하고 주거·서울살이 각 4개 등 상한을 적용하는 분야별 발행량 제어
- 무작위 secret과 비공개 Service Binding으로 보호되는 운영자용 즉시 수집 API
- 홈에서 날짜와 무관하게 최근 출처 확인형 AI 상식을 다시 발견하는 `CURATED DISCOVERY` 영역
- 사회초년생 관련성 검사와 소스별 고정 카테고리로 일반 뉴스·오분류 차단
- 공개·숨김 검수 상태로 품질이 낮거나 출처가 없는 콘텐츠를 모든 노출면에서 일괄 제외
- 검수 대기 AI 상식 중 외부 자료로 재검증한 항목은 본문·카드·퀴즈를 다시 쓰고 SOURCE를 연결해 선별 복구
- Gemini 호출 보호: 8초 배치 간격, 60초 슬라이딩 윈도우 12회와 KST 하루 400회 통합 상한, 성공·실패를 합친 회차당 최대 12번 생성 시도, 일시적인 429·5xx 응답 1회 재시도
- Notion에서 관리하고 5분 D1 캐시로 동기화하는 공개 릴리즈 노트 (`/changelog`)

각 AI 학습 섹션은 `summary`와 `details`로 구성됩니다. Quick Read는 `summary`만 사용하고 Deep Read는 같은 `summary`에 `details`를 이어 붙이므로, 카드에만 있고 본문에는 없는 정보가 저장되지 않습니다. 4번 카드는 확인 행동을 맡으며 상세 화면 아래에서 같은 내용을 다시 반복하지 않습니다.

역사·유머·사회성·생활 상식은 각 분야 32개, 직장·권리·디지털 안전·건강은 각 분야 20개 주제를 순환합니다. 한 바퀴 뒤에는 같은 자료를 그대로 반복하지 않고 핵심 원리, 초보자 오해, 행동 체크리스트, 다시 설명하기의 네 관점을 교대하며 별도 학습판으로 생성합니다. 위키백과 API가 차단되면 MediaWiki·Wikimedia를 거친 뒤 Gemini URL Context의 조회 성공 메타데이터가 확인된 경우에만 생성합니다. 첫 출처가 실패하거나 이미 발행됐으면 다음 용어·출처 후보로 이동하고, 서울살이·권리·디지털 안전·건강은 서울시·고용노동부·KISA·질병관리청 공식 페이지를 최종 폴백으로 사용합니다.

## 구조

```text
Astro 7 + Cloudflare Workers Static Assets
├─ /, /start, /archive, /articles/:id, /daily, /review, /me, /chat, /login, /account, /changelog
├─ Astro API: /api/auth/*, /api/account/link, /api/daily*, /api/onboarding, /api/events, /api/feedback/*, /api/learning/*, /api/reviews/*, /api/profile, /api/saved/*, /api/chat
├─ D1: 인증 계정·세션, 콘텐츠, 일일 학습, 관심 분야, 90일 익명 행동 이벤트, 저장한 상식, 사용자 피드백, 퀴즈, 복습 로그, 챗 사용량
└─ Service Binding: life-quiz-ingest
   ├─ Hono 수집 API와 KST 00/06/12/18시 통합 Cron
   └─ Gemini 생성 및 근거형 챗 응답 (D1 공용 RPM·KST 일일 예산 적용)
```

설치된 오픈소스, 서비스 구성, 무료 티어 한도와 운영 기준은 [`docs/TECH_STACK_AND_FREE_TIER.md`](docs/TECH_STACK_AND_FREE_TIER.md)에 정리되어 있습니다.

## PM 포트폴리오

서비스 기능 소개와 별도로 문제 정의, 가설, 우선순위, 핵심 PRD, 출시 판단, 실제 결과와 미검증 항목을 정리한 지원용 문서를 제공합니다.

- [PM 사례 원고](docs/portfolio/LIFE_QUIZ_PM_CASE_STUDY.md)
- [잡코리아 가이드 대조 분석](docs/portfolio/JOBKOREA_PORTFOLIO_GAP_ANALYSIS.md)
- [수치·근거 관리대장](docs/portfolio/LIFE_QUIZ_EVIDENCE_LEDGER.md)
- [제출용 10쪽 PDF](output/pdf/Life_Quiz_PM_Portfolio_2026-08.pdf)
- [1쪽 의사결정 맵](output/pdf/Life_Quiz_Decision_Map_2026-08.pdf)

Gemini 키는 `life-quiz-ingest` Worker에만 저장합니다. 앱 Worker는 공개 URL 대신 Cloudflare Service Binding으로 수집 Worker를 호출합니다.

## 처음 보는 사람을 위한 기술 스택

| 기술 | 쉽게 말하면 | 이 프로젝트에서 하는 일 |
| --- | --- | --- |
| Astro | 웹페이지를 만드는 틀 | 홈, 보관함, 상세, 5분 학습, 내 학습, 복습, 채팅, 릴리즈 노트 화면을 렌더링 |
| Cloudflare Workers | 서버를 따로 빌리지 않고 Cloudflare 위에서 코드를 실행하는 공간 | 프론트와 API를 같은 배포 단위로 실행 |
| Hono | Workers용 가벼운 API 라우터 | 수집 Worker의 health, 채팅, 수동 수집 요청 처리 |
| Cloudflare D1 | Cloudflare 안의 SQLite 데이터베이스 | 콘텐츠, 5분 학습 진행, 관심 분야, 저장한 상식, 사용자 QA 제보, 퀴즈, 복습 기록, 채팅 사용량 저장 |
| Drizzle ORM | DB 테이블을 TypeScript 코드처럼 다루게 해 주는 도구 | 테이블 구조와 쿼리를 타입으로 검증 |
| better-auth | 로그인과 세션을 만드는 인증 도구 | 이메일 계정, 30일 세션, D1 요청 제한과 익명 기록의 계정 연결 |
| ts-fsrs | 망각 곡선을 고려해 다음 복습일을 정하는 엔진 | 사용자가 맞힘/틀림을 누르면 다음 복습 시점 계산 |
| Gemini 3.1 Flash Lite | 텍스트를 요약하고 구조화하는 AI 모델 | 배치 수집 때 카드뉴스·퀴즈 초안을 만들고, 저장 콘텐츠 근거로만 챗 응답 |
| RSS, YouTube, data.go.kr, Wikipedia | 외부 원천 자료 | 원문 재배포 없이 제목·요약·공공데이터·문서 링크를 근거로 재구성 |
| Notion API | 운영 문서를 가져오는 연결 통로 | Notion 릴리즈 노트를 웹 `/changelog`에 표시 |

## 로컬 실행

Node.js 22.12 이상이 필요합니다.

```sh
npm ci
npm run generate-types
npm run db:migrate:local
npm run build
npx wrangler dev --port 8787
```

`http://127.0.0.1:8787`에서 확인할 수 있습니다. `wrangler.jsonc`의 `INGEST` 바인딩은 로컬에서도 배포된 수집 Worker를 원격 호출하므로, 챗 기능을 사용하려면 수집 Worker가 먼저 배포되어 있어야 합니다.

로컬 로그인 테스트에는 32자 이상의 `BETTER_AUTH_SECRET`이 필요합니다. Playwright 설정은 테스트 전용 값을 주입하며 운영 값은 Cloudflare Secret으로만 관리합니다.

## 비밀값

다음 값은 저장소나 `wrangler.jsonc`에 넣지 않습니다. Gemini·수집 키는 수집 Worker에, `BETTER_AUTH_SECRET`은 앱 Worker에 Cloudflare Secret으로 등록합니다.

```sh
npx wrangler secret put GEMINI_API_KEY --config workers/ingest/wrangler.jsonc
npx wrangler secret put DATA_GO_KR_KEY_TRASH --config workers/ingest/wrangler.jsonc
npx wrangler secret put DATA_GO_KR_KEY_LOAN --config workers/ingest/wrangler.jsonc
npx wrangler secret put DATA_GO_KR_KEY_APT_SALE --config workers/ingest/wrangler.jsonc
npx wrangler secret put DATA_GO_KR_KEY_APT_RENT --config workers/ingest/wrangler.jsonc
npx wrangler secret put YOUTUBE_API_KEY --config workers/ingest/wrangler.jsonc
npx wrangler secret put NOTION_TOKEN --config workers/ingest/wrangler.jsonc
npx wrangler secret put BETTER_AUTH_SECRET
```

`NOTION_TOKEN`이 있어도 Notion 페이지가 해당 integration에 공유되지 않으면 Notion API는 404를 반환합니다. 이 경우 `/changelog`는 저장소의 최신 스냅샷을 표시하므로 페이지는 유지되지만, Notion에서 새 항목을 자동 반영하려면 릴리즈 노트 페이지를 같은 integration에 다시 공유해야 합니다.

## 검증

```sh
npm run typecheck
npm run build
npm run test:logic
npm run test:e2e
npx wrangler deploy --dry-run
npx wrangler deploy --dry-run --config workers/ingest/wrangler.jsonc
```

Playwright는 설치된 Chrome을 사용하며 데스크톱과 모바일에서 첫 방문 온보딩, 홈, 시작 코스, 상세, 5분 학습, 관심 분야, 저장한 상식, 내 학습 리포트, 피드백, 복습, 가입·기록 병합·재로그인, 챗과 운영 대시보드 흐름을 순차 검사합니다. 외부 Gemini 호출은 반복 소모를 막기 위해 E2E에서 모킹하고, 실제 연결은 별도 스모크 요청으로 확인합니다.

## 배포 순서

```sh
npm run db:migrate:remote
npm run deploy:ingest
npm run build
npm run deploy:app
```

Service Binding의 대상이 먼저 존재해야 하므로 수집 Worker를 앱보다 먼저 배포합니다. 배치 수집은 KST 00시, 06시, 12시, 18시에 실행됩니다. Cloudflare Cron은 UTC 기준이고, 무료 계정의 Trigger 수를 아끼기 위해 설정에는 `0 3/6 * * *` 하나만 등록합니다. 각 배치는 서울 자치구 4곳의 전월세·매매 중 한 종류를 교대로 비교하고 생활정보 브리핑과 분야별 RSS 뉴스를 수집합니다. YouTube는 8개 주제 중 2개씩 검색합니다. 출처형 커리큘럼은 앞 회차의 분야와 후보를 다시 포함하되, 이미 발행한 후보는 다음 후보로 이동하고 해당 분야가 일일 최소 1개를 채우면 나머지는 호출 전에 멈춥니다. 처리 순서는 당일 최소 발행량이 부족한 분야부터 다시 정렬하고, 분야별 상한에 도달한 후보는 건너뜁니다. 중복 확인 뒤 성공 여부와 관계없이 최대 12개 항목만 생성을 시도합니다. 기존 Cron은 수집과 함께 90일이 지난 익명 행동 이벤트와 만료된 인증 세션·검증·rate-limit 기록을 정리합니다.

## 남은 큰 작업

- 이메일 확인·비밀번호 재설정·웹 계정 삭제 흐름
- 공공데이터 지역 개인화
- 수집 소스별 중복률과 Cloudflare·YouTube 무료 티어 사용량 추세 모니터링
- 챗 사용량을 로그인 사용자 정책과 연결
- 배포 CI와 자동 smoke test
