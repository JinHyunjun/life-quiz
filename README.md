# 라이프퀴즈

사회초년생에게 필요한 금융, 부동산, 서울살이, 생활상식을 출처와 함께 큐레이션하고 FSRS 복습으로 오래 기억하게 돕는 서비스입니다. Gemini는 배치 수집 시 콘텐츠와 퀴즈를 만들고, `라이프 메이트`에서는 저장된 콘텐츠를 근거로 질문에 답합니다.

## 현재 기능

- 분야별 상식 피드와 출처가 연결된 상세 글
- Gemini가 생성한 3~5장의 카드뉴스 요약
- `ts-fsrs` 기반 오늘의 복습 큐와 다음 복습일 계산
- 선택한 글 또는 최근 콘텐츠 6개를 근거로 답하는 라이프 메이트
- D1 기반 익명 챗 사용량 제한: IP와 User-Agent의 SHA-256 해시 기준 시간당 8회
- RSS, YouTube 메타데이터, data.go.kr, AI 상식 수집 Cron

## 구조

```text
Astro 7 + Cloudflare Workers Static Assets
├─ /, /articles/:id, /review, /chat
├─ Astro API: /api/reviews/*, /api/chat
├─ D1: 콘텐츠, 퀴즈, 복습 로그, 챗 사용량
└─ Service Binding: life-quiz-ingest
   ├─ Hono 수집 API와 Cron
   └─ Gemini 생성 및 근거형 챗 응답
```

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

Service Binding의 대상이 먼저 존재해야 하므로 수집 Worker를 앱보다 먼저 배포합니다. 배치 수집은 매일 `0 21 * * *` UTC에 실행됩니다.

## 남은 큰 작업

- better-auth 세션과 사용자별 복습 이력
- 공공데이터 지역·관심 분야 개인화
- 수집 소스별 품질 지표와 무료 티어 모니터링
- 챗 사용량을 로그인 사용자 정책과 연결
