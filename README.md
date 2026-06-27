# 라이프퀴즈

사회초년생에게 필요한 금융, 주식·투자, 부동산, 서울살이, 생활상식을 출처와 함께 큐레이션하고 FSRS 복습으로 오래 기억하게 돕는 서비스입니다. Gemini는 배치 수집 시 콘텐츠와 퀴즈를 만들고, `라이프 메이트`에서는 저장된 콘텐츠를 근거로 질문에 답합니다.

## 현재 기능

- KST 00시 기준 오늘 피드와 날짜·분야·출처·페이지별 지난 상식 보관함
- 서울 25개 자치구를 배치마다 순환하는 부동산·생활 공공데이터 수집
- 분야별 상식 피드와 출처가 연결된 상세 글
- Gemini가 하나의 학습 섹션에서 함께 생성하고 의미 중복 검사를 통과한 Quick Read와 Deep Read
- 금융·주식 투자·부동산 초보 용어를 정의·구조·사례·체크포인트로 설명하는 4컷 가이드
- `ts-fsrs` 기반 오늘의 복습 큐와 다음 복습일 계산
- 선택한 글 또는 최근 콘텐츠 6개를 근거로 답하는 라이프 메이트
- D1 기반 익명 챗 사용량 제한: IP와 User-Agent의 SHA-256 해시 기준 시간당 8회
- RSS, YouTube 메타데이터, data.go.kr, AI 상식 수집 Cron
- Gemini 호출 보호: 8초 배치 간격, 60초 슬라이딩 윈도우 12회 상한, 용어·트리비아의 4개 Cron 슬롯 분산

각 AI 학습 섹션은 `summary`와 `details`로 구성됩니다. Quick Read는 `summary`만 사용하고 Deep Read는 같은 `summary`에 `details`를 이어 붙이므로, 카드에만 있고 본문에는 없는 정보가 저장되지 않습니다.

## 구조

```text
Astro 7 + Cloudflare Workers Static Assets
├─ /, /archive, /articles/:id, /review, /chat
├─ Astro API: /api/reviews/*, /api/chat
├─ D1: 콘텐츠, 퀴즈, 복습 로그, 챗 사용량
└─ Service Binding: life-quiz-ingest
   ├─ Hono 수집 API와 KST 00/06/12/18시 Cron
   └─ Gemini 생성 및 근거형 챗 응답 (D1 공용 RPM 예산 적용)
```

설치된 오픈소스, 서비스 구성, 무료 티어 한도와 운영 기준은 [`docs/TECH_STACK_AND_FREE_TIER.md`](docs/TECH_STACK_AND_FREE_TIER.md)에 정리되어 있습니다.

Gemini 키는 `life-quiz-ingest` Worker에만 저장합니다. 앱 Worker는 공개 URL 대신 Cloudflare Service Binding으로 수집 Worker를 호출합니다.

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
```

## 검증

```sh
npm run typecheck
npm run build
npm run test:logic
npm run test:e2e
npx wrangler deploy --dry-run
npx wrangler deploy --dry-run --config workers/ingest/wrangler.jsonc
```

Playwright는 설치된 Chrome을 사용하며 데스크톱과 모바일에서 홈, 상세, 복습, 챗 흐름을 검사합니다. 외부 Gemini 호출은 반복 소모를 막기 위해 E2E에서 모킹하고, 실제 연결은 별도 스모크 요청으로 확인합니다.

## 배포 순서

```sh
npm run db:migrate:remote
npm run deploy:ingest
npm run build
npm run deploy:app
```

Service Binding의 대상이 먼저 존재해야 하므로 수집 Worker를 앱보다 먼저 배포합니다. 배치 수집은 KST 00시, 06시, 12시, 18시에 실행됩니다. Cloudflare Cron은 UTC 기준이므로 설정에는 `0 15`, `0 21`, `0 3`, `0 9`가 등록됩니다. 각 배치는 서울 자치구 하나를 순환하고, 매일 금융·주식 투자·부동산 기초 용어를 하나씩 추가합니다.

## 남은 큰 작업

- better-auth 세션과 사용자별 복습 이력
- 공공데이터 지역·관심 분야 개인화
- 수집 소스별 품질 지표와 무료 티어 모니터링
- 챗 사용량을 로그인 사용자 정책과 연결
