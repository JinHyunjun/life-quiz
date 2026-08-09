# Life Quiz 포트폴리오 수치·근거 대장

> 기준 시각: 2026.08.01 15:30 KST 전후. 운영 데이터는 계속 변하므로 제출 전에 다시 확인한다.

## 1. 사용 가능한 핵심 수치

| 주장 | 값 | 근거 | 안전한 표현 |
| --- | ---: | --- | --- |
| 공개 콘텐츠 | 617건 | 원격 D1 `content_items.moderation_status='published'` | 운영 DB 기준 공개 콘텐츠 617건 |
| 전체 콘텐츠 | 658건 | 원격 D1 `content_items` | 공개 617건, 숨김 41건 |
| 분야 | 12개 | `src/lib/categories.ts` | 금융·주거·직장·권리 등 12개 분야 체계 |
| 공개 콘텐츠 출처 | 617/617 | 원격 D1 `citation_url` 누락 0 | 공개 콘텐츠 모두 SOURCE 링크 보유 |
| 공개 콘텐츠 퀴즈 | 617/617 | 공개 항목 중 `quiz_items` 미연결 0 | 공개 콘텐츠 모두 퀴즈 연결 |
| 4장 카드 규칙 | 615/617 | 공개 항목 중 카드 누락·4장 아님 2 | 공개 콘텐츠의 99.7%가 4장 카드 규칙 충족 |
| 릴리즈 | 17개 | `src/lib/releases.ts` v0.1-v0.17 | 한 달여 동안 17개 버전으로 반복 개선 |
| 커밋 | 36개 | `git shortlog -sn HEAD` | 공개 저장소 36개 커밋 |
| 로직 테스트 | 32건 | `npm run test:logic` | 로직 테스트 32건 통과 |
| E2E | 22건 | 11개 테스트 x desktop/mobile | 핵심 흐름 E2E 22건 통과 |
| 예약 수집 | 하루 4회 | `0 3/6 * * *` | KST 00·06·12·18시를 Cron 한 개로 운영 |
| Gemini 예산 | 12 RPM, 400회/일 | ingest `wrangler.jsonc` | 자체 예산을 외부 호출 전에 적용 |
| D1 크기 | 약 4.0MB | 원격 D1 실행 메타 `size_after=4,038,656` | 운영 DB 약 4.0MB |

## 2. 반드시 한계와 함께 써야 하는 수치

| 신호 | 현재 값 | 해석 |
| --- | ---: | --- |
| 2026.08.01 오늘 발행 | 9건 | 양은 최소 목표 12건보다 적음 |
| 오늘 분야 커버리지 | 3/12 | 다양성 목표 미달. 출시한 복구 로직의 효과를 추가 검증해야 함 |
| 오늘 분야 구성 | 주거 6, 금융 2, 투자 1 | 주거 편중이 남아 있음 |
| 최근 15일 발행량 | 3-24건/일 | 공급 변동성이 큼 |
| 최근 15일 분야 수 | 2-11개/일 | 12개 전부 발행한 날 없음 |
| 누적 부동산 비중 | 264/617, 약 42.8% | 과거 수집 구조의 편중이 누적 데이터에 남아 있음 |
| 익명 사용자 레코드 | 3개 | 운영·테스트 데이터가 섞일 수 있어 실제 사용자 수로 표현 금지 |
| 일일 학습 세션 | 2개 | 표본이 작아 완료율을 말할 수 없음 |
| 완료 항목 | 0개 | 활성화 가설 미검증 |
| 복습 로그 | 1건 | 장기 기억 효과 미검증 |

## 3. 표현 금지

- “사용자 만족도가 높아졌다”
- “리텐션이 개선됐다”
- “FSRS로 기억력이 향상됐다”
- “12개 분야를 매일 균형 있게 제공한다”
- “수집 문제가 해결됐다”
- “AI 비용을 00% 절감했다”

근거가 생기기 전에는 각각 `가설`, `운영 목표`, `시스템 검증`, `후속 검증`으로 표현한다.

## 4. 제출 전 재확인 SQL

```sql
SELECT COUNT(*) AS published
FROM content_items
WHERE moderation_status = 'published';

SELECT date(created_at, 'unixepoch', '+9 hours') AS kst_date,
       COUNT(*) AS published,
       COUNT(DISTINCT category) AS categories
FROM content_items
WHERE moderation_status = 'published'
  AND created_at >= unixepoch('now', '-14 days')
GROUP BY kst_date
ORDER BY kst_date DESC;

SELECT COUNT(*) AS published,
       SUM(CASE WHEN citation_url IS NULL OR TRIM(citation_url) = '' THEN 1 ELSE 0 END) AS missing_citation,
       SUM(CASE WHEN cards IS NULL OR json_array_length(cards) <> 4 THEN 1 ELSE 0 END) AS invalid_cards
FROM content_items
WHERE moderation_status = 'published';
```

## 5. 다음 사용자 검증에서 채울 표

| 지표 | 정의 | 현재 | 1차 목표 |
| --- | --- | ---: | ---: |
| 5분 학습 시작률 | 홈 방문 중 `/daily` 세션을 만든 비율 | 미측정 | 기준선 확보 |
| 첫 문제 응답률 | 세션 시작 후 첫 답을 제출한 비율 | 미측정 | 기준선 확보 |
| 세션 완료율 | 5개 항목을 모두 끝낸 비율 | 미검증 | 60% 이상 가설 |
| 7일 재방문율 | 첫 완료 후 7일 안에 복습한 비율 | 미검증 | 25% 이상 가설 |
| 출처 확인률 | 상세에서 SOURCE를 연 비율 | 미측정 | 기준선 확보 |
| 콘텐츠 이해 문제율 | `이해 어려움` 제보 / 상세 조회 | 미측정 | 기준선 확보 후 감소 |

## 6. 면접용 문장 구조

### 문제와 행동

“최근 일일 발행이 3건까지 떨어지고 분야도 2개에 그치는 날이 있어, Cron 성공 여부가 아니라 수집원별 후보·빈 응답·오류를 D1에 기록하고 부족 분야를 우선하는 발행 정책을 만들었습니다.”

### 결과와 한계

“공개 콘텐츠 617건에 출처와 퀴즈를 모두 연결하고 로직 32건·E2E 22건을 통과했지만, 8월 1일 실제 분야 커버리지는 3/12라 다양성 목표 달성으로 보지는 않습니다. 다음 단계는 분야별 대체 출처와 18시 마감 SLO 검증입니다.”
