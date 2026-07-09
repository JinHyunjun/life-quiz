# 라이프퀴즈 기술 스택과 무료 운영 범위

> 기준일: 2026-07-09 (KST)
> 저장소: <https://github.com/JinHyunjun/life-quiz>
> 서비스: <https://life-quiz.life-quiz.workers.dev/>

이 문서는 현재 저장소와 실제 Cloudflare 설정을 기준으로 작성한 기술 명세다. 무료 티어 수치는 각 서비스의 공식 문서를 2026-07-09에 다시 확인한 값이며, 제공사 정책에 따라 바뀔 수 있다.

## 1. 서비스 목표

라이프퀴즈는 사회초년생에게 필요한 금융, 주식·투자, 부동산, 서울살이, 생활상식을 출처와 함께 재구성하고, 퀴즈와 FSRS 간격 반복으로 장기 기억을 돕는 서비스다.

핵심 원칙은 다음과 같다.

- 원문을 재배포하지 않고 요약·재구성한 뒤 원문 링크를 남긴다.
- 일반 AI 상식도 외부 문서를 먼저 조회하고, 제공된 문서 안의 사실만 재구성해 실제 원문 링크를 남긴다.
- 콘텐츠 생성은 예약 배치에서 수행하고 중복 URL은 Gemini 호출 전에 제외한다.
- 채팅은 저장된 라이프퀴즈 콘텐츠만 근거로 답한다.
- 주식·투자 콘텐츠는 교육용 개념만 다루며 종목 추천, 수익 보장, 개인화된 투자 지시는 하지 않는다.
- 카드와 4컷 시각 자료는 HTML/CSS와 아이콘으로 렌더링해 이미지 생성 비용을 만들지 않는다.

## 2. 전체 구조

```text
사용자 브라우저
  └─ life-quiz Worker
      ├─ Astro SSR: 홈, 시작 코스, 보관함, 글 상세, 복습, 채팅, 릴리즈 노트
      ├─ Static Assets: CSS, JS, WebP 이미지
      ├─ D1: 콘텐츠 검수 상태, 학습 목록, 퀴즈, 복습 로그, 채팅 사용량, 릴리즈 캐시
      └─ Service Binding
          └─ life-quiz-ingest Worker
              ├─ Hono 내부 API
              ├─ KST 00/06/12/18시 Cron
              ├─ RSS / data.go.kr / YouTube 수집
              ├─ Gemini 콘텐츠 생성 및 근거형 채팅
              └─ Notion 릴리즈 동기화
```

앱 Worker에는 Gemini 키가 없다. 브라우저가 `/api/chat`을 호출하면 앱 Worker가 비공개 Service Binding으로 수집 Worker를 호출한다. 외부에서 수집 Worker의 채팅·수집 라우트를 직접 실행할 수 없도록 별도 헤더도 검사한다.

## 3. 오픈소스 기술 스택

버전은 `package-lock.json`과 로컬 설치 결과를 기준으로 했다.

| 영역 | 기술 / 버전 | 라이선스 | 현재 역할과 상태 |
|---|---|---:|---|
| 프론트·SSR | Astro 7.0.3 | MIT | 페이지, 컴포넌트, API 라우트. 전체 페이지는 현재 SSR |
| Cloudflare 연결 | `@astrojs/cloudflare` 14.0.1 | MIT | Astro 결과물을 Workers Static Assets 형태로 배포 |
| 수집 API | Hono 4.12.27 | MIT | 수집 Worker의 health, chat, trigger 라우팅 |
| DB 쿼리 | Drizzle ORM 0.45.2 | Apache-2.0 | D1 스키마와 타입 안전 쿼리 |
| DB 마이그레이션 | Drizzle Kit 0.31.10 | MIT | SQL 마이그레이션 생성 |
| 복습 엔진 | ts-fsrs 5.4.1 | MIT | 응답 등급별 다음 복습일, 안정성, 난이도 계산 |
| XML 파싱 | fast-xml-parser 5.9.3 | MIT | data.go.kr 및 RSS XML 파싱 |
| 인증 | better-auth 1.6.21 | MIT | 패키지만 설치됨. 실제 로그인·세션은 아직 미연결 |
| UI 아이콘 | lucide-astro 0.556.0 | MIT | 버튼, 카테고리, 4컷 시각 단서 |
| 언어 | TypeScript 6.0.3 | Apache-2.0 | 앱과 Worker 타입 검사 |
| E2E 테스트 | Playwright 1.61.1 | Apache-2.0 | 데스크톱·모바일 주요 흐름 검사 |
| 배포 도구 | Wrangler 4.105.0 | MIT OR Apache-2.0 | Workers, D1, secrets, Cron 배포·관리 |

직접 사용하는 패키지는 모두 상용 서비스에 사용할 수 있는 허용적 라이선스다. 배포물이나 오픈소스 배포 시에는 각 패키지의 저작권·라이선스 고지를 유지해야 한다. API로 가져오는 뉴스, 영상, 공공데이터의 이용 조건은 오픈소스 라이선스와 별개다.

## 4. 플랫폼과 외부 서비스

| 서비스 | 용도 | 현재 사용 방식 |
|---|---|---|
| Cloudflare Workers | 앱과 수집 백엔드 | `life-quiz`, `life-quiz-ingest` 두 Worker |
| Workers Static Assets | 정적 자산 전송 | Astro 빌드 결과와 WebP 히어로 이미지 |
| Cloudflare D1 | SQLite 호환 DB | 앱과 수집 Worker가 같은 DB 사용 |
| Cron Triggers | 예약 수집 | 하루 4회, KST 00/06/12/18시 |
| Service Bindings | Worker 간 비공개 호출 | 앱에서 수집 Worker의 Gemini 기능 호출 |
| Cloudflare KV | Astro 세션 바인딩 | 어댑터가 `SESSION`을 자동 생성하지만 앱 코드는 아직 세션을 사용하지 않음 |
| Cloudflare Images | Astro 이미지 변환 바인딩 | 어댑터가 `IMAGES`를 자동 생성하지만 현재 화면은 변환 API를 호출하지 않음 |
| Workers Logs / Traces | 운영 관측 | 로그 100%, trace 5% 샘플링 |
| Gemini Developer API | 요약, 분류, 카드, 퀴즈, 채팅 | `gemini-3.1-flash-lite` |
| Notion API | 공개 릴리즈 노트 원본 | 5분마다 확인하고 마지막 정상 응답은 D1에 보관 |
| data.go.kr | 아파트 매매·전월세, 생활폐기물 | 서울 25개 자치구 중 회차마다 실거래가 2개 구와 생활 정보 대표 1개 구 수집 |
| YouTube Data API v3 | 영상 메타데이터 | 4개 초보자 주제를 회차마다 모두 검색하고 자막·본문 없이 제목, 설명, 링크만 사용 |
| RSS | 경제 기사 메타데이터 | 한국경제 RSS의 제목·요약·링크만 사용 |
| Wikimedia REST·Action API | 일반 상식의 외부 근거 | 한국어 위키백과 요약을 먼저 사용하고, 짧으면 문서 도입부로 보강해 원문 URL과 CC BY-SA 표시 저장 |
| 전국투자자교육협의회 | 투자 입문 참고 출처 | 투자 4컷 가이드에서 교육 페이지 연결 |
| GitHub | 소스 저장소 | 공개 저장소 `JinHyunjun/life-quiz` |

Astro Cloudflare 어댑터가 `SESSION` KV와 `IMAGES` 바인딩을 빌드 결과에 자동으로 추가한다. 현재 앱 코드는 Astro 세션이나 이미지 변환 엔드포인트를 호출하지 않으며, 4컷 가이드는 Lucide 아이콘과 CSS로 표현한다.

## 5. 데이터 모델

| 테이블 | 역할 |
|---|---|
| `users` | 현재 익명 복습 사용자의 최소 정보. better-auth 정식 스키마는 아님 |
| `sources` | 원본 유형, 고유 URL, 마지막 수집 시각. URL unique index로 동시 수집 중복 차단 |
| `content_items` | 본문, 카드 4개, 형식, 분야, 출처, 공개·숨김 검수 상태와 사유, 생성 시각 |
| `quiz_items` | 콘텐츠별 4지선다 문제, 정답, 정답·오답 구분 해설 |
| `learning_items` | 브라우저별 익명 사용자가 명시적으로 복습에 담은 콘텐츠 |
| `review_logs` | FSRS 상태, 응답 등급, 다음 복습일 |
| `chat_usage` | 익명 식별자별 1시간 채팅 횟수 |
| `gemini_request_log` | 배치·채팅이 공유하는 최근 Gemini 호출 시각과 목적 |
| `release_cache` | Notion 릴리즈 노트의 마지막 정상 응답과 동기화 시각 |

현재 카테고리는 `finance`, `investment`, `housing`, `seoul_life`, `daily_tips`, `history`, `humor`, `social_skills`다.

## 6. 콘텐츠 생성 흐름

1. Cron이 KST 기준 하루 네 번 실행된다.
2. RSS 후보에서 사회초년생의 금융·투자·주거·소비 생활과 직접 관련된 기사만 분야별 최대 2건, 회차당 최대 6건으로 고르고, YouTube 4개 주제와 해당 회차의 서울 자치구 공공데이터를 수집한다.
3. 뉴스는 키워드 관련성 검사와 분야 균형 선별, 공공데이터와 YouTube는 회차별 편집 계획으로 카테고리와 설명 관점을 Gemini 호출 전에 확정한다.
4. 저장된 source URL과 같으면 Gemini 호출 전에 건너뛴다.
5. 새 원본은 8초 이상 간격을 두고 처리하며, 최근 60초 호출이 12회이거나 회차 생성 수가 12개에 도달하면 다음 회차로 미룬다.
6. Gemini가 4개 `section`, 상황형 퀴즈, 정답을 구분하는 해설을 만든다.
7. 각 section의 `summary`는 Quick Read 카드가 되고, `summary + details`는 같은 소제목의 Deep Read가 된다. 마지막 section은 행동 요약으로 한 번 더 노출한다.
8. 뉴스·용어는 카드 의미 중복을 엄격히 검사한다. 저위험 흥미 상식은 빈 카드와 완전 중복만 차단하고 의미가 일부 겹치는 카드는 허용한다. 모든 유형에서 Deep Read의 카드 포함 여부는 계속 검사한다.
9. 역사·유머·사회성·생활상식은 회차별 커리큘럼의 한국어 위키백과 문서를 먼저 조회한다. 요약이 짧으면 최대 1,600자의 문서 도입부로 보강하고, 70자 이상의 근거와 실제 원문 URL을 확보한 경우에만 생성한다.
10. 금융·주식·투자·부동산 기초 용어와 역사·유머·사회성·생활상식 후보는 매 회차 전체 후보를 회전 순서로 넣고, Gemini 예산과 중복 검사에 따라 순차 생성한다.
11. 검수에서 숨김 처리된 콘텐츠는 홈, 보관함, 상세, 채팅 근거, 복습 큐에서 모두 제외한다.

기존 AI 상식을 다시 공개할 때는 제목과 비슷한 링크만 붙이지 않는다. 외부 자료가 실제로 뒷받침하는 사실만 남겨 본문, 카드 4개, 퀴즈와 해설을 함께 다시 작성한 항목만 `published`로 되돌린다. 안전 지침이 과장됐거나 단일 자료로 확인하기 어려운 항목은 계속 `hidden` 상태로 보존한다.

홈의 `CURATED DISCOVERY`는 오늘 생성분과 별도로 최근 공개 AI 상식을 최대 6개 보여 준다. 검수 상태 자체를 우회하지 않고, 이미 출처가 확인된 콘텐츠가 날짜 경계 때문에 보이지 않던 문제를 해결한다.

주식·투자 커리큘럼은 주식과 주주에서 시작해 주문, 지표, 재무제표, ETF, 분산투자, 위험 관리, DART까지 40개 입문 주제로 순환한다. 투자 가이드에는 원금 손실 가능성과 비추천 원칙을 프롬프트와 화면 양쪽에 명시한다.

## 7. 무료 티어 공식 한도

### Cloudflare

| 항목 | 무료 한도 | 이 프로젝트에 미치는 영향 |
|---|---:|---|
| Worker 요청 | 100,000회/일 | SSR 페이지와 API 요청이 포함된다. 정적 자산 요청은 제외 |
| Worker CPU | HTTP·Cron 호출당 10ms | XML 파싱, Astro SSR, 큰 JSON 처리의 CPU 시간을 계속 관찰해야 함 |
| Worker 메모리 | 128MB | 현재 텍스트 중심 처리에는 충분 |
| 외부 subrequest | 호출당 50회 | 현재 수집 회차의 외부 API 호출 수는 충분히 낮음 |
| 내부 CF subrequest | 호출당 1,000회 | 채팅의 Service Binding 1회는 여유 있음 |
| Worker 개수 | 100개 | 현재 2개 사용 |
| Cron Trigger | 계정당 5개 | 현재 4개 사용, 1개 남음 |
| Worker 압축 크기 | 3MB | 배포 dry-run에서 계속 확인 |
| Static Assets | 버전당 20,000개, 파일당 25MiB | 정적 자산 요청 자체는 무료·무제한 |
| D1 읽기 | 5,000,000 rows/일 | 결과 행이 아니라 스캔한 행 기준 |
| D1 쓰기 | 100,000 rows/일 | 콘텐츠, 퀴즈, 복습 로그, 채팅 제한 기록이 공유 |
| D1 저장소 | 계정 전체 5GB | 현재 텍스트 DB에는 큰 여유가 있음 |
| Workers Logs/Traces | 200,000 events/일, 3일 보관 | 로그와 trace가 같은 계정 한도를 공유 |

공식 문서: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

Astro가 향후 `SESSION` KV를 실제로 사용하게 되면 무료 한도는 읽기 100,000회/일, 쓰기·삭제·목록 각각 1,000회/일, 저장 1GB다. 현재는 바인딩만 있고 앱 코드의 세션 읽기·쓰기는 없다. [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)

Cloudflare Images는 외부 저장 이미지의 고유 변환 5,000건/월까지 무료지만 Cloudflare Images 자체 이미지 저장은 유료다. 현재는 이 기능을 사용하지 않는다. [Images pricing](https://developers.cloudflare.com/images/pricing/)

### Gemini

- 현재 모델은 `gemini-3.1-flash-lite`다. `workers/ingest/wrangler.jsonc`의 `GEMINI_MODEL`도 같은 값으로 고정되어 있다.
- RPM, TPM, RPD는 프로젝트 단위이며 Google AI Studio에서 현재 한도를 확인해야 한다. 2026-07-09 화면 기준 `Gemini 3.1 Flash Lite`는 15 RPM, 250K TPM, 500 RPD로 보인다.
- 서비스 내부에서는 D1의 60초 슬라이딩 윈도우로 배치와 채팅을 합산해 12회까지만 허용한다. AI Studio의 15 RPM 대비 3회의 여유를 남기며, 초과 요청은 Gemini에 보내지 않고 429 또는 다음 Cron 회차로 처리한다.
- 무료 티어에 보낸 데이터는 Google 제품 개선에 사용될 수 있다고 가격표에 명시되어 있다. 주민번호, 계좌번호, 비밀번호, 계약서 원문 등 개인정보를 채팅에 입력받지 않는 것이 운영 원칙이다.
- 무료 검색 grounding은 현재 모델에서 제공되지 않으므로 채팅은 D1에 저장된 콘텐츠만 근거로 사용한다.

공식 문서: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Gemini billing](https://ai.google.dev/gemini-api/docs/billing).

### YouTube와 공공데이터

- YouTube `search.list`는 현재 공식 문서상 하루 100회 기본 버킷이며 각 호출은 1 quota를 사용한다. 현재는 4개 주제를 회차마다 1회씩 검색하므로 하루 16회, 기본 버킷의 약 16%를 사용한다. [quota cost](https://developers.google.com/youtube/v3/determine_quota_cost)
- data.go.kr 호출 한도는 API와 승인받은 활용 신청별로 다르다. 포털의 각 활용 신청 화면을 기준으로 확인해야 하며, 코드에는 전역 무제한을 가정하지 않는다. 현재는 회차당 실거래가 4회와 생활폐기물 1회, 하루 약 20회 요청한다.
- RSS는 별도 호출 요금이 없지만 저작권이 사라지는 것은 아니다. 제목·요약만 재구성하고 원문 링크를 유지한다.

## 8. 현재 사용량 스냅샷

2026-07-09 KST에 원격 D1을 `wrangler d1 info`와 검수 쿼리로 확인한 결과다.

| 항목 | 현재 값 | 무료 한도 대비 |
|---|---:|---:|
| D1 크기 | 1.4MB | 계정 저장소 5GB의 약 0.03%, DB당 500MB의 약 0.28% |
| 최근 24시간 rows read | 59,396 | 5,000,000의 약 1.19% |
| 최근 24시간 rows written | 73 | 100,000의 약 0.07% |
| 콘텐츠 / 퀴즈 | 256 / 256 | 매우 작음 |
| 공개 / 숨김 콘텐츠 | 215 / 41 | 숨김 콘텐츠는 모든 노출면에서 제외 |
| 학습 목록 / 복습 로그 | 1 / 1 | 매우 작음 |
| Cron | 4개 | 5개 중 80% |
| YouTube 검색 | 16회/일 | 100회의 16% |

Worker 일일 요청량은 Cloudflare Dashboard에서, Gemini 프로젝트 전체 사용량은 Google AI Studio에서 확인한다. D1의 `gemini_request_log`는 이 서비스가 실제로 허용한 최근 호출만 추적하며 다른 API 키·서비스의 호출은 포함하지 않는다.

배치가 만들 수 있는 Gemini 호출의 코드상 상한은 하루 48회다. `GEMINI_INGEST_MAX_ITEMS=12`가 회차당 생성 수를 제한하고 하루 4회 실행되기 때문이다. 실제로는 URL 중복 제거, 이미 수집된 Wikipedia URL, 빈 공공데이터, Gemini RPM 회로 차단기 때문에 더 적다. 배치와 채팅 모두 공용 12 RPM 회로 차단기를 통과하지만 서비스 전체 RPD 상한은 아직 별도로 두지 않았다.

## 9. 무료로 구현 가능한 범위

현재 구조로 비용 없이 계속 제공하기 적합한 범위는 다음과 같다.

- 텍스트 중심 공개 콘텐츠 피드, 날짜·분야·출처별 보관함
- 하루 네 번의 RSS·YouTube 메타데이터·공공데이터 수집과 회차당 최대 12개 콘텐츠 생성
- 금융·주식·투자·부동산 기초 4컷 가이드와 일반 상식 커리큘럼의 점진 생성
- 수만 건 규모의 콘텐츠와 퀴즈 저장
- 사용자별 FSRS 복습 이력과 관심 분야
- 제한된 로그인과 소규모 공개 베타
- 저장 콘텐츠에만 답하는 횟수 제한형 AI 채팅
- HTML/CSS/아이콘 기반 카드뉴스와 4컷 콘텐츠

다음 기능은 무료 범위를 빠르게 벗어나거나 별도 이용 조건 검토가 필요하다.

| 기능 | 이유 | 권장 방향 |
|---|---|---|
| 실시간 주가·호가 | 실시간 시세 API와 재배포 권리는 대개 별도 계약 대상 | 우선 지연 시세도 아닌 투자 개념 교육에 집중 |
| 사용자마다 AI 맞춤 콘텐츠 생성 | Gemini 호출량이 방문자 수에 비례 | 배치 생성 콘텐츠를 공용으로 재사용 |
| 무제한 AI 채팅 | 사용자 증가 시 무료 Gemini RPD 소진 가능 | 적용된 RPM 회로 차단기에 더해 일일 전역 예산 추가 |
| AI 이미지 4컷 대량 생성 | 이미지 모델·저장·변환 비용과 품질 검수 필요 | 현재 코드 기반 4컷 유지 |
| 6번째 독립 Cron | 무료 계정의 Trigger 5개 초과 | 기존 한 Cron 내부에서 작업을 묶기 |
| 대규모 이메일 인증 | 발송 서비스 비용과 스팸·개인정보 운영 필요 | 초기에는 OAuth 또는 제한된 이메일 흐름 검토 |
| 100,000회/일 초과 동적 요청 | Workers 무료 요청 한도 초과 | 인기 콘텐츠 정적 생성·캐시 후 유료 전환 판단 |

## 10. 무료 운영을 오래 유지하는 기준

1. **Gemini 전역 예산 유지**: 현재 12 RPM 공용 예산을 유지하고, 다음 단계로 서비스 전체 일일 호출 수를 D1에서 집계해 RPD의 70~80%에서 채팅을 일시 제한한다.
2. **개인정보 차단**: 채팅 UI와 서버 양쪽에서 민감정보 입력 금지를 안내하고, 로그인 도입 전 개인정보 처리방침을 만든다.
3. **SSR 요청 절감**: 조회가 많은 글 상세는 필요할 때 캐시하거나 정적 생성해 Worker와 D1 읽기를 줄인다.
4. **D1 인덱스 유지**: 현재 `created_at`, `(category, created_at)`, `(moderation_status, category, created_at)`, `(user_id, due)` 인덱스를 유지하고 새 필터는 실행 계획을 확인한다.
5. **배치 호출 재사용**: 원본 URL 중복 검사와 공용 콘텐츠 생성 방식을 유지한다. 사용자별 요약을 새로 만들지 않는다.
6. **Cron 추가 금지**: 새 수집원은 기존 네 회차에 넣고 작업 실패를 소스별로 격리한다.
7. **월 1회 한도 점검**: Cloudflare Workers Analytics, D1, Gemini AI Studio, YouTube Console을 같은 날 기록한다.

운영 경보 기준은 50%에서 추세 확인, 80%에서 기능 제한 또는 캐시 적용, 100% 도달 전에 유료 전환 여부 결정으로 잡는다.

## 11. 현재 완료·미완료 기능

### 완료

- Astro + Workers Static Assets 통합 앱
- Hono 수집 Worker와 Service Binding
- D1 / Drizzle 스키마와 원격 마이그레이션
- 서울 25개 자치구 순환 수집
- 회차당 서울 실거래가 2개 자치구 수집과 분야 균형 뉴스 선별
- 회차당 YouTube 4개 주제 수집과 AI 커리큘럼 후보 회전 생성
- 날짜·분야·출처별 아카이브와 페이지네이션
- 금융·투자·주거 4컷 용어를 순서대로 묶는 시작 코스
- Quick Read / Deep Read 일관성 검사
- Deep Read 소제목, 행동 요약, 복습 퀴즈 해설
- 금융·주식·투자·부동산 4컷 기초 용어
- 뉴스 관련성 필터와 소스별 고정 카테고리
- 외부 원문 기반 AI 일반 상식과 실제 SOURCE 링크
- 공개·숨김 콘텐츠 검수 상태와 전 노출면 필터
- 공식·전문 자료로 재검증한 기존 AI 상식의 선별 복구 절차
- 사용자가 직접 담은 콘텐츠만 포함하는 브라우저별 익명 ts-fsrs 복습 큐
- D1 사용량 제한이 있는 근거형 Gemini 채팅
- 배치·채팅 공용 12 RPM 회로 차단기와 8초 배치 호출 간격
- Notion 원본과 5분 D1 캐시를 사용하는 공개 릴리즈 노트
- Playwright E2E와 콘텐츠 로직 테스트

### 남은 작업

- better-auth 실제 로그인·세션·계정 연결
- 사용자별 복습 이력의 계정 귀속과 마이그레이션
- Gemini 서비스 전체 일일 예산과 관리자 사용량 화면
- 출처별 품질 점수, 오류율, 중복률 모니터링
- 개인정보 처리방침과 이용약관
- 배포 CI와 자동 smoke test

## 12. 주식·투자 기능의 범위

이번 기능은 “무엇을 살지”가 아니라 “투자 화면과 기사를 이해하는 법”에 초점을 둔다.

- 포함: 주식·주주, 주문 방식, 거래량·변동성, PER/PBR/ROE, 재무제표, ETF, 분산투자, 복리, 리밸런싱, 위험 등급, 공시 확인
- 제외: 종목 추천, 목표가, 매매 신호, 수익률 예측, 개인 자산에 맞춘 포트폴리오, 실시간 시세
- 출처 원칙: [전국투자자교육협의회 초보 투자자 교육](https://www.kcie.or.kr/yeouitv/howtoList)을 입문 참고 링크로 제공하고, 공시 관련 내용은 [금융감독원 DART](https://dart.fss.or.kr/) 원문 확인을 유도한다.

이 경계는 비용을 낮추기 위한 선택인 동시에, 사회초년생에게 더 안전하고 오래 쓰이는 지식을 제공하기 위한 제품 원칙이다.
