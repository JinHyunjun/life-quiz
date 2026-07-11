# 라이프퀴즈

사회초년생에게 필요한 금융, 주식·투자, 부동산, 서울살이, 생활상식을 출처와 함께 큐레이션하고 FSRS 복습으로 오래 기억하게 돕는 서비스입니다. Gemini는 배치 수집 시 콘텐츠와 퀴즈를 만들고, `라이프 메이트`에서는 저장된 콘텐츠를 근거로 질문에 답합니다.

## 현재 기능

- KST 00시 기준 오늘 피드와 날짜·분야·출처·페이지별 지난 상식 보관함
- 서울 25개 자치구 중 배치마다 2개 자치구를 순환하는 부동산 공공데이터 수집과 대표 자치구 생활 정보 수집
- 분야별 상식 피드와 실제 외부 원문으로 이동하는 SOURCE 영역
- 금융·투자·주거 기초를 생성 순서대로 묶어 주는 사회초년생 시작 코스 (`/start`)
- Gemini가 하나의 학습 섹션에서 함께 생성하고 의미 중복 검사를 통과한 Quick Read와 소제목형 Deep Read
- 마지막 학습 카드를 다시 보여주는 `오늘 바로 확인할 것` 행동 요약
- 금융·주식 투자·부동산 초보 용어를 정의·구조·사례·체크포인트로 설명하는 4컷 가이드
- 글 상세에서 직접 담은 콘텐츠만 보여주는 브라우저별 익명 복습 큐와 `ts-fsrs` 다음 복습일 계산
- 선택한 글 또는 최근 콘텐츠 6개를 근거로 답하는 라이프 메이트
- D1 기반 익명 챗 사용량 제한: IP와 User-Agent의 SHA-256 해시 기준 시간당 8회
- Cloudflare에서 실제 응답이 검증된 금융위원회 공식 RSS의 분야 균형 선별, YouTube 4개 주제별 후보 3개 메타데이터, data.go.kr, 위키백과 원문 기반 AI 상식 수집 Cron
- D1 `ingestion_runs`에 회차별 생성·중복·지연·실패와 RSS·YouTube·공공 API별 후보 수·오류를 남기는 수집 진단 로그
- 무작위 secret과 비공개 Service Binding으로 보호되는 운영자용 즉시 수집 API
- 홈에서 날짜와 무관하게 최근 출처 확인형 AI 상식을 다시 발견하는 `CURATED DISCOVERY` 영역
- 사회초년생 관련성 검사와 소스별 고정 카테고리로 일반 뉴스·오분류 차단
- 공개·숨김 검수 상태로 품질이 낮거나 출처가 없는 콘텐츠를 모든 노출면에서 일괄 제외
- 검수 대기 AI 상식 중 외부 자료로 재검증한 항목은 본문·카드·퀴즈를 다시 쓰고 SOURCE를 연결해 선별 복구
- Gemini 호출 보호: 8초 배치 간격, 60초 슬라이딩 윈도우 12회 상한, 회차당 최대 12개 생성, 용어·트리비아 전체 후보 회전 수집
- Notion에서 관리하고 5분 D1 캐시로 동기화하는 공개 릴리즈 노트 (`/changelog`)

각 AI 학습 섹션은 `summary`와 `details`로 구성됩니다. Quick Read는 `summary`만 사용하고 Deep Read는 같은 `summary`에 `details`를 이어 붙이므로, 카드에만 있고 본문에는 없는 정보가 저장되지 않습니다.

역사·유머·사회성·생활 상식은 각 분야 32개 주제를 순환하며 출처 링크와 최소 근거 문장을 유지합니다. 위키백과 API가 Cloudflare에서 차단되거나 요약이 짧으면 `api.wikimedia.org`의 공식 원문 API를 제한된 길이로 읽어 보강합니다. 모든 직접 경로가 막히면 Gemini URL Context를 사용하되 응답 메타데이터의 원문 조회 성공을 확인한 경우에만 저장합니다. 이 저위험 상식 유형은 네 카드가 완전히 같지만 않으면 의미가 일부 겹쳐도 저장합니다.

## 구조

```text
Astro 7 + Cloudflare Workers Static Assets
├─ /, /start, /archive, /articles/:id, /review, /chat, /changelog
├─ Astro API: /api/learning/*, /api/reviews/*, /api/chat
├─ D1: 콘텐츠 검수 상태, 학습 목록, 퀴즈, 복습 로그, 챗 사용량
└─ Service Binding: life-quiz-ingest
   ├─ Hono 수집 API와 KST 00/06/12/18시 통합 Cron
   └─ Gemini 생성 및 근거형 챗 응답 (D1 공용 RPM 예산 적용)
```

설치된 오픈소스, 서비스 구성, 무료 티어 한도와 운영 기준은 [`docs/TECH_STACK_AND_FREE_TIER.md`](docs/TECH_STACK_AND_FREE_TIER.md)에 정리되어 있습니다.

Gemini 키는 `life-quiz-ingest` Worker에만 저장합니다. 앱 Worker는 공개 URL 대신 Cloudflare Service Binding으로 수집 Worker를 호출합니다.

## 처음 보는 사람을 위한 기술 스택

| 기술 | 쉽게 말하면 | 이 프로젝트에서 하는 일 |
| --- | --- | --- |
| Astro | 웹페이지를 만드는 틀 | 홈, 보관함, 상세, 복습, 채팅, 릴리즈 노트 화면을 렌더링 |
| Cloudflare Workers | 서버를 따로 빌리지 않고 Cloudflare 위에서 코드를 실행하는 공간 | 프론트와 API를 같은 배포 단위로 실행 |
| Hono | Workers용 가벼운 API 라우터 | 수집 Worker의 health, 채팅, 수동 수집 요청 처리 |
| Cloudflare D1 | Cloudflare 안의 SQLite 데이터베이스 | 콘텐츠, 퀴즈, 복습 기록, 채팅 사용량, 릴리즈 캐시 저장 |
| Drizzle ORM | DB 테이블을 TypeScript 코드처럼 다루게 해 주는 도구 | 테이블 구조와 쿼리를 타입으로 검증 |
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

## 비밀값

다음 값은 저장소나 `wrangler.jsonc`에 넣지 않고 수집 Worker의 secret으로 등록합니다.

```sh
npx wrangler secret put GEMINI_API_KEY --config workers/ingest/wrangler.jsonc
npx wrangler secret put DATA_GO_KR_KEY_TRASH --config workers/ingest/wrangler.jsonc
npx wrangler secret put DATA_GO_KR_KEY_LOAN --config workers/ingest/wrangler.jsonc
npx wrangler secret put DATA_GO_KR_KEY_APT_SALE --config workers/ingest/wrangler.jsonc
npx wrangler secret put DATA_GO_KR_KEY_APT_RENT --config workers/ingest/wrangler.jsonc
npx wrangler secret put YOUTUBE_API_KEY --config workers/ingest/wrangler.jsonc
npx wrangler secret put NOTION_TOKEN --config workers/ingest/wrangler.jsonc
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

Playwright는 설치된 Chrome을 사용하며 데스크톱과 모바일에서 홈, 시작 코스, 상세, 복습, 챗 흐름을 검사합니다. 외부 Gemini 호출은 반복 소모를 막기 위해 E2E에서 모킹하고, 실제 연결은 별도 스모크 요청으로 확인합니다.

## 배포 순서

```sh
npm run db:migrate:remote
npm run deploy:ingest
npm run build
npm run deploy:app
```

Service Binding의 대상이 먼저 존재해야 하므로 수집 Worker를 앱보다 먼저 배포합니다. 배치 수집은 KST 00시, 06시, 12시, 18시에 실행됩니다. Cloudflare Cron은 UTC 기준이고, 무료 계정의 Trigger 수를 아끼기 위해 설정에는 `0 3/6 * * *` 하나만 등록합니다. 각 배치는 서울 자치구 2곳의 실거래가, 대표 자치구 생활 정보, 분야별 RSS 뉴스, YouTube 4개 주제별 후보 3개, 금융·투자·부동산 용어, 역사·유머·사회성·생활상식 후보를 모은 뒤 중복과 Gemini 예산을 통과한 항목만 최대 12개 생성합니다. 뉴스·영상은 원문 URL, 공공데이터는 응답 내용의 SHA-256 지문으로 중복을 판정하므로 같은 조회 URL의 데이터가 갱신되면 새 콘텐츠가 될 수 있습니다. 실행 결과는 `ingestion_runs`에 수집원별 후보 수와 오류까지 저장합니다.

## 남은 큰 작업

- better-auth 세션과 사용자별 복습 이력
- 공공데이터 지역·관심 분야 개인화
- 수집 소스별 품질 지표와 무료 티어 모니터링
- Gemini 서비스 전체 일일 예산과 관리자 사용량 화면
- 챗 사용량을 로그인 사용자 정책과 연결
