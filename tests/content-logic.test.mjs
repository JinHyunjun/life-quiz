import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertDeepReadCoversCards, assertDistinctCards, sanitizeContentCards } from "../src/lib/card-quality.ts";
import { createAdminSessionCookie, isAuthorizedAdminRequest, isAuthorizedAdminSession } from "../src/lib/admin.ts";
import { selectBalancedDailyCandidates } from "../src/lib/daily-selection.ts";
import {
  calculateLearningStreak,
  normalizePreferenceCategories,
} from "../src/lib/personalization-logic.ts";
import {
  geminiBudgetStatus,
  kstDayWindowMs,
  normalizeGeminiDailyBudget,
  summarizeCollectorHealth,
} from "../src/lib/operations.ts";
import {
  hasDailyPublishingCapacity,
  prioritizeByDailyPublishingTargets,
} from "../src/lib/publishing-policy.ts";
import { SEOUL_DISTRICTS, seoulDistrictForKstRun, seoulDistrictsForKstRun } from "../workers/ingest/src/districts.ts";
import { glossaryTopicCandidatesForKstDay, glossaryTopicsForKstDay } from "../workers/ingest/src/glossary.ts";
import { officialGuideCandidatesForKstDay } from "../workers/ingest/src/official-guides.ts";
import { rowMatchesRegion } from "../workers/ingest/src/fetchers/gov.ts";
import { classifyNewsForBeginners, youtubeEditorialPlanForKstSlot, youtubeEditorialPlansForKstRun } from "../workers/ingest/src/editorial.ts";
import { normalizeGeminiRpmBudget } from "../workers/ingest/src/rate-limit.ts";
import { isRetryableGeminiStatus } from "../workers/ingest/src/gemini-retry.ts";
import { hasSuccessfulUrlContext } from "../workers/ingest/src/gemini-url-context.ts";
import { contentFingerprint } from "../workers/ingest/src/fingerprint.ts";
import { isUsableWikipediaExtract, normalizeWikitextLead, triviaSourceCandidatesForKstDay, triviaSourceForKstDay } from "../workers/ingest/src/trivia-sources.ts";
import {
  apartmentBriefKindForKstRun,
  hasIngestionAttemptBudget,
  ingestionPacingDelayMs,
  scheduledAiCurriculumBatchForKstRun,
  scheduledAiCurriculumForKstRun,
} from "../workers/ingest/src/schedule.ts";
import { FALLBACK_RELEASE_FEED, parseNotionReleaseBlocks } from "../src/lib/releases.ts";
import { normalizeProductEvent } from "../src/lib/product-events.ts";
import { mergePreferenceCategories } from "../src/lib/account-linking-logic.ts";

const verifiedAiRestorationSql = readFileSync(
  new URL("../drizzle/0012_restore_verified_ai_content.sql", import.meta.url),
  "utf8",
);

test("all 25 Seoul districts are selected across 25 consecutive runs", () => {
  const firstRun = new Date("2026-06-26T15:00:00Z");
  const selected = new Set(
    Array.from({ length: 25 }, (_, index) =>
      seoulDistrictForKstRun(new Date(firstRun.getTime() + index * 6 * 60 * 60 * 1_000)).name,
    ),
  );

  assert.equal(SEOUL_DISTRICTS.length, 25);
  assert.equal(selected.size, 25);
});

test("duplicate cards are removed while distinct four-card stories pass", () => {
  const repeated = [
    { heading: "보증금 뜻", body: "보증금은 집주인에게 맡기는 큰돈입니다." },
    { heading: "같은 뜻", body: "보증금은 집주인에게 맡기는 큰돈입니다." },
    { heading: "계약 확인", body: "계약 전에 등기부를 확인하세요." },
    { heading: "안전 장치", body: "반환보증 가입 가능 여부를 확인하세요." },
  ];
  const distinct = [
    { heading: "정의", body: "전세는 큰 보증금을 맡기고 사는 임대차 방식입니다." },
    { heading: "구조", body: "집주인은 보증금을 계약 종료 때 돌려줘야 합니다." },
    { heading: "예시", body: "보증금 2억 원 주택이라면 대출 이자도 주거비에 포함합니다." },
    { heading: "확인", body: "계약 전에 등기부와 반환보증 가입 가능 여부를 봅니다." },
  ];

  assert.equal(sanitizeContentCards(repeated).length, 3);
  assert.equal(assertDistinctCards(distinct).length, 4);
});

test("Deep Read contains every Quick Read summary and adds detail", () => {
  const cards = [
    { heading: "정의", body: "적금은 매달 일정한 금액을 나누어 저축하는 상품입니다." },
    { heading: "구조", body: "은행은 약정 기간이 끝나면 원금과 이자를 지급합니다." },
    { heading: "예시", body: "매달 50만 원씩 1년을 넣으면 원금은 600만 원입니다." },
    { heading: "확인", body: "가입 전 기본금리와 중도해지금리를 함께 확인해야 합니다." },
  ];
  const body = cards
    .map((card, index) => `${card.body} ${"상세한 원리와 실제 적용 시 주의할 점을 설명합니다. ".repeat(index + 2)}`)
    .join("\n\n");

  assert.doesNotThrow(() => assertDeepReadCoversCards(body, cards));
  assert.throws(() => assertDeepReadCoversCards("적금은 저축 상품입니다.", cards));
});

test("starter glossary begins with the most basic finance, investment, and housing terms", () => {
  const topics = glossaryTopicsForKstDay(new Date("2026-06-26T15:00:00Z"));
  assert.deepEqual(
    topics.map(({ category, term }) => ({ category, term })),
    [
      { category: "finance", term: "예금과 적금" },
      { category: "investment", term: "주식과 주주" },
      { category: "housing", term: "전세와 월세" },
    ],
  );
});

test("same-name districts from outside Seoul are rejected", () => {
  assert.equal(rowMatchesRegion({ CTPV_NM: "서울특별시", SGG_NM: "중구" }, "서울", "중구"), true);
  assert.equal(rowMatchesRegion({ CTPV_NM: "대구광역시", SGG_NM: "중구" }, "서울", "중구"), false);
});

test("daily AI curriculum is distributed across four six-hour slots", () => {
  const firstRun = new Date("2026-06-26T15:00:00Z");
  const schedules = Array.from({ length: 4 }, (_, index) =>
    scheduledAiCurriculumForKstRun(new Date(firstRun.getTime() + index * 6 * 60 * 60 * 1_000)),
  );

  assert.deepEqual(
    schedules.map((schedule) => schedule.glossary?.category ?? null),
    ["finance", "investment", "housing", null],
  );
  assert.deepEqual(
    schedules.map((schedule) => schedule.trivia.category),
    ["history", "humor", "social_skills", "daily_tips"],
  );
  assert.ok(schedules.every((schedule) => schedule.trivia.sourceUrl.startsWith("https://ko.wikipedia.org/wiki/")));
});

test("glossary look-ahead advances past duplicates and creates a new edition after a full cycle", () => {
  const firstDay = new Date("2026-06-26T15:00:00Z");
  const candidates = glossaryTopicCandidatesForKstDay("finance", firstDay, 3);
  const nextEdition = glossaryTopicCandidatesForKstDay(
    "finance",
    new Date(firstDay.getTime() + 40 * 24 * 60 * 60 * 1_000),
    1,
  )[0];

  assert.equal(candidates.length, 3);
  assert.equal(new Set(candidates.map(({ url }) => url)).size, 3);
  assert.equal(candidates[0].term, nextEdition.term);
  assert.notEqual(candidates[0].url, nextEdition.url);
  assert.equal(nextEdition.edition, 1);
});

test("daily five fills unused categories before repeating a subject", () => {
  const candidates = [
    { id: 1, category: "housing" },
    { id: 2, category: "finance" },
    { id: 3, category: "housing" },
    { id: 4, category: "career" },
    { id: 5, category: "health" },
    { id: 6, category: "finance" },
  ];

  assert.deepEqual(
    selectBalancedDailyCandidates(candidates, new Set(["finance"]), 4).map(({ id }) => id),
    [1, 4, 5, 2],
  );
});

test("daily five prioritizes preferred subjects without losing category variety", () => {
  const candidates = [
    { id: 1, category: "housing" },
    { id: 2, category: "finance" },
    { id: 3, category: "career" },
    { id: 4, category: "health" },
    { id: 5, category: "finance" },
  ];

  assert.deepEqual(
    selectBalancedDailyCandidates(candidates, new Set(), 4, new Set(["health", "finance"]))
      .map(({ id }) => id),
    [2, 4, 1, 3],
  );
});

test("learning streak keeps yesterday's run until today's session is complete", () => {
  assert.deepEqual(
    calculateLearningStreak(["2026-07-27", "2026-07-28", "2026-07-29"], "2026-07-30"),
    { current: 3, longest: 3 },
  );
  assert.deepEqual(
    calculateLearningStreak(["2026-07-27", "2026-07-29", "2026-07-30"], "2026-07-30"),
    { current: 2, longest: 2 },
  );
});

test("interest preferences accept known categories and enforce the five-subject limit", () => {
  assert.deepEqual(
    normalizePreferenceCategories(["finance", "health", "finance"]),
    ["finance", "health"],
  );
  assert.throws(() => normalizePreferenceCategories(["unknown"]));
  assert.throws(() => normalizePreferenceCategories([
    "finance",
    "investment",
    "housing",
    "career",
    "health",
    "history",
  ]));
});

test("daily publishing policy prioritizes missing fields and enforces category caps", () => {
  const candidates = [
    { id: "housing", category: "housing" },
    { id: "career", category: "career" },
    { id: "finance", category: "finance" },
    { id: "health", category: "health" },
  ];
  const counts = { housing: 5, finance: 2, career: 0, health: 0 };

  assert.deepEqual(
    prioritizeByDailyPublishingTargets(candidates, counts).map(({ id }) => id),
    ["career", "health", "finance", "housing"],
  );
  assert.equal(hasDailyPublishingCapacity("housing", { ...counts, housing: 3 }), true);
  assert.equal(hasDailyPublishingCapacity("housing", { ...counts, housing: 4 }), false);
});

test("apartment brief alternates rent and sale once per six-hour run", () => {
  const firstRun = new Date("2026-06-26T15:00:00Z");
  assert.deepEqual(
    Array.from({ length: 4 }, (_, index) =>
      apartmentBriefKindForKstRun(new Date(firstRun.getTime() + index * 6 * 60 * 60 * 1_000)),
    ),
    ["rent", "sale", "rent", "sale"],
  );
});

test("district briefing compares four distinct districts per run", () => {
  const districts = seoulDistrictsForKstRun(new Date("2026-07-12T03:00:00Z"), 4);
  assert.equal(districts.length, 4);
  assert.equal(new Set(districts.map(({ name }) => name)).size, 4);
});

test("daily AI curriculum batch covers all core categories across four runs", () => {
  const firstRun = new Date("2026-06-26T15:00:00Z");
  const schedules = Array.from({ length: 4 }, (_, index) =>
    scheduledAiCurriculumBatchForKstRun(new Date(firstRun.getTime() + index * 6 * 60 * 60 * 1_000)),
  );

  assert.deepEqual(
    [...new Set(schedules.flatMap((schedule) => schedule.glossary.map((topic) => topic.category)))].sort(),
    ["finance", "housing", "investment"],
  );
  assert.deepEqual(
    [...new Set(schedules.flatMap((schedule) => schedule.trivia.map((topic) => topic.category)))].sort(),
    ["career", "daily_tips", "digital_safety", "health", "history", "humor", "rights", "social_skills"],
  );
  assert.deepEqual(schedules.map((schedule) => schedule.glossary.length), [3, 6, 9, 9]);
  assert.deepEqual(schedules.map((schedule) => schedule.trivia.length), [4, 8, 12, 16]);
  assert.deepEqual(
    schedules[3].trivia.map((topic) => topic.category),
    [
      "history", "history", "humor", "humor", "social_skills", "social_skills", "daily_tips", "daily_tips",
      "career", "career", "rights", "rights", "digital_safety", "digital_safety", "health", "health",
    ],
  );
  assert.ok(schedules.every((schedule) => schedule.officialGuides.length === 8));
});

test("only transient Gemini HTTP failures are retried", () => {
  assert.equal(isRetryableGeminiStatus(429), true);
  assert.equal(isRetryableGeminiStatus(503), true);
  assert.equal(isRetryableGeminiStatus(400), false);
  assert.equal(isRetryableGeminiStatus(404), false);
});

test("ingestion budget limits attempts even when earlier items fail", () => {
  assert.equal(hasIngestionAttemptBudget(11, 12), true);
  assert.equal(hasIngestionAttemptBudget(12, 12), false);
  assert.equal(hasIngestionAttemptBudget(20, 12), false);
});

test("AI general knowledge rotates through externally grounded topics", () => {
  const first = triviaSourceForKstDay("history", new Date("2026-06-28T15:00:00Z"));
  const second = triviaSourceForKstDay("history", new Date("2026-06-29T15:00:00Z"));

  assert.notEqual(first.wikipediaTitle, second.wikipediaTitle);
  assert.match(first.sourceUrl, /^https:\/\/ko\.wikipedia\.org\/wiki\//);
  assert.match(second.sourceUrl, /^https:\/\/ko\.wikipedia\.org\/wiki\//);
});

test("AI curriculum provides a second grounded candidate after a source failure", () => {
  const candidates = triviaSourceCandidatesForKstDay("rights", new Date("2026-08-11T03:00:00Z"), 2);
  assert.equal(candidates.length, 2);
  assert.notEqual(candidates[0].dedupeKey, candidates[1].dedupeKey);
  assert.ok(candidates.every(({ sourceUrl }) => sourceUrl.startsWith("https://ko.wikipedia.org/wiki/")));
});

test("official fallback guides cover Seoul life and practical risk categories", () => {
  for (const category of ["seoul_life", "rights", "digital_safety", "health"]) {
    const guides = officialGuideCandidatesForKstDay(category, new Date("2026-08-11T09:00:00Z"), 2);
    assert.equal(guides.length, 2);
    assert.ok(guides.every(({ sourceUrl }) => sourceUrl.startsWith("https://")));
    assert.equal(new Set(guides.map(({ dedupeKey }) => dedupeKey)).size, 2);
  }
});

test("AI general knowledge does not repeat a source during a 32-day curriculum", () => {
  const firstDay = new Date("2026-06-28T15:00:00Z");
  for (const category of ["history", "humor", "social_skills", "daily_tips"]) {
    const urls = new Set(
      Array.from({ length: 32 }, (_, index) =>
        triviaSourceForKstDay(category, new Date(firstDay.getTime() + index * 24 * 60 * 60 * 1_000)).sourceUrl,
      ),
    );
    assert.equal(urls.size, 32, `${category} repeated before 32 days`);
  }
});

test("new practical curricula cover four additional subjects without early repetition", () => {
  const firstDay = new Date("2026-07-12T00:00:00Z");
  for (const category of ["career", "rights", "digital_safety", "health"]) {
    const urls = new Set(
      Array.from({ length: 20 }, (_, index) =>
        triviaSourceForKstDay(category, new Date(firstDay.getTime() + index * 24 * 60 * 60 * 1_000)).sourceUrl,
      ),
    );
    assert.equal(urls.size, 20, `${category} repeated before 20 days`);
  }
});

test("repeated trivia sources get a new edition key and learning angle", () => {
  const firstDay = new Date("2026-06-28T15:00:00Z");
  const first = triviaSourceForKstDay("career", firstDay);
  const nextEdition = triviaSourceForKstDay("career", new Date(firstDay.getTime() + 20 * 24 * 60 * 60 * 1_000));

  assert.equal(first.sourceUrl, nextEdition.sourceUrl);
  assert.notEqual(first.dedupeKey, nextEdition.dedupeKey);
  assert.notEqual(first.editorialFocus, nextEdition.editorialFocus);
  assert.equal(first.edition, 0);
  assert.equal(nextEdition.edition, 1);
});

test("public-data snapshots deduplicate identical responses but allow changed data", async () => {
  assert.equal(await contentFingerprint("same rows"), await contentFingerprint("same rows"));
  assert.notEqual(await contentFingerprint("same rows"), await contentFingerprint("updated rows"));
});

test("manual ingestion requires the exact bearer token", async () => {
  const token = "test-admin-token";
  assert.equal(
    await isAuthorizedAdminRequest(new Request("https://example.com", { headers: { authorization: `Bearer ${token}` } }), token),
    true,
  );
  assert.equal(
    await isAuthorizedAdminRequest(new Request("https://example.com", { headers: { authorization: "Bearer wrong" } }), token),
    false,
  );
  assert.equal(await isAuthorizedAdminRequest(new Request("https://example.com"), token), false);
});

test("admin dashboard session is signed, expires, and rejects tampering", async () => {
  const token = "test-admin-token";
  const issuedAt = Date.parse("2026-07-17T00:00:00Z");
  const cookie = (await createAdminSessionCookie(token, true, issuedAt)).split(";")[0];
  const request = new Request("https://example.com/admin", { headers: { cookie } });

  assert.equal(await isAuthorizedAdminSession(request, token, issuedAt + 1_000), true);
  assert.equal(await isAuthorizedAdminSession(request, "different-token", issuedAt + 1_000), false);
  assert.equal(await isAuthorizedAdminSession(request, token, issuedAt + 13 * 60 * 60 * 1_000), false);

  const tampered = new Request("https://example.com/admin", { headers: { cookie: `${cookie}x` } });
  assert.equal(await isAuthorizedAdminSession(tampered, token, issuedAt + 1_000), false);

  const currentCookie = (await createAdminSessionCookie(token, true)).split(";")[0];
  assert.equal(
    await isAuthorizedAdminRequest(new Request("https://example.com/admin", { headers: { cookie: currentCookie } }), token),
    true,
  );
});

test("AI trivia requires four semantically distinct cards", () => {
  assert.equal(isUsableWikipediaExtract("가".repeat(70)), true);
  assert.equal(isUsableWikipediaExtract("가".repeat(69)), false);

  const cards = [
    { heading: "배경", body: "문어는 바다에 사는 영리한 무척추동물입니다." },
    { heading: "몸", body: "문어는 바다에서 여덟 팔을 활용하는 영리한 무척추동물입니다." },
    { heading: "행동", body: "문어는 바다에서 도구를 활용하는 영리한 무척추동물입니다." },
    { heading: "기억", body: "문어는 바다에서 다른 신경 구조를 가진 영리한 무척추동물입니다." },
  ];

  assert.throws(() => assertDistinctCards(cards));
});

test("Wikimedia source fallback keeps readable lead facts", () => {
  const source = "{{정보|이름=테스트}}\n'''독립신문'''은 [[1896년]]에 창간된 [[신문]]이다.<ref>근거</ref> 쉬운 한글을 사용했다.\n\n== 역사 ==\n뒷부분";
  assert.equal(normalizeWikitextLead(source), "독립신문은 1896년에 창간된 신문이다. 쉬운 한글을 사용했다.");
});

test("Gemini URL context fallback requires successful retrieval metadata", () => {
  assert.equal(
    hasSuccessfulUrlContext({
      urlContextMetadata: { urlMetadata: [{ urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS" }] },
    }),
    true,
  );
  assert.equal(
    hasSuccessfulUrlContext({
      url_context_metadata: { url_metadata: [{ url_retrieval_status: "URL_RETRIEVAL_STATUS_ERROR" }] },
    }),
    false,
  );
});

test("only verified legacy AI articles are restored with complete learning content", () => {
  const restoredIds = Array.from(
    verifiedAiRestorationSql.matchAll(/`moderation_status` = 'published',[\s\S]*?WHERE `id` = (\d+);--> statement-breakpoint/g),
    (match) => Number(match[1]),
  ).sort((a, b) => a - b);
  const cardSets = Array.from(
    verifiedAiRestorationSql.matchAll(/`cards` = json\('([^']+)'\)/g),
    (match) => JSON.parse(match[1]),
  );
  const choiceSets = Array.from(
    verifiedAiRestorationSql.matchAll(/`choices` = json\('([^']+)'\)/g),
    (match) => JSON.parse(match[1]),
  );

  assert.deepEqual(restoredIds, [21, 22, 24, 26, 28, 32, 35, 47, 51, 59, 61, 69, 70, 108]);
  assert.equal(cardSets.length, restoredIds.length);
  assert.equal(choiceSets.length, restoredIds.length);
  assert.ok(cardSets.every((cards) => cards.length === 4));
  assert.ok(choiceSets.every((choices) => choices.length === 4));
  assert.equal((verifiedAiRestorationSql.match(/`citation_url` = 'https:\/\//g) ?? []).length, restoredIds.length);

  for (const cards of cardSets) {
    for (const card of cards) {
      assert.ok(verifiedAiRestorationSql.split(card.body).length >= 3, `Deep Read is missing: ${card.body}`);
    }
  }
});

test("Gemini safeguards leave quota headroom and pace ingestion", () => {
  assert.equal(normalizeGeminiRpmBudget(Number.NaN), 12);
  assert.equal(normalizeGeminiRpmBudget(15), 14);
  assert.equal(normalizeGeminiDailyBudget(Number.NaN), 400);
  assert.equal(normalizeGeminiDailyBudget(1), 20);
  assert.equal(normalizeGeminiDailyBudget(10_000), 5_000);
  assert.equal(ingestionPacingDelayMs(1_000, 8_000, 4_000), 5_000);
  assert.equal(ingestionPacingDelayMs(1_000, 8_000, 10_000), 0);
});

test("Gemini daily budget resets at KST midnight and reports risk levels", () => {
  const beforeMidnight = kstDayWindowMs(new Date("2026-07-31T14:59:00Z"));
  const afterMidnight = kstDayWindowMs(new Date("2026-07-31T15:00:00Z"));

  assert.equal(new Date(beforeMidnight.start).toISOString(), "2026-07-30T15:00:00.000Z");
  assert.equal(new Date(beforeMidnight.end).toISOString(), "2026-07-31T15:00:00.000Z");
  assert.equal(new Date(afterMidnight.start).toISOString(), "2026-07-31T15:00:00.000Z");
  assert.equal(geminiBudgetStatus(260, 400).status, "pass");
  assert.equal(geminiBudgetStatus(300, 400).status, "warning");
  assert.equal(geminiBudgetStatus(360, 400).status, "fail");
  assert.equal(geminiBudgetStatus(420, 400).remaining, 0);
});

test("collector health groups seven-day diagnostics by source family", () => {
  const health = summarizeCollectorHealth([
    {
      collectorDiagnostics: [
        { source: "rss:policy", status: "success", candidateCount: 8 },
        { source: "rss:finance", status: "empty", candidateCount: 0 },
        { source: "youtube:career", status: "error", candidateCount: 0 },
        { source: "gov:apartment", status: "success", candidateCount: 12 },
        { source: "curriculum:finance", status: "success", candidateCount: 3 },
      ],
    },
    { collectorDiagnostics: [{ source: "youtube:housing", status: "success", candidateCount: 4 }] },
  ]);

  assert.deepEqual(health.find(({ family }) => family === "rss"), {
    family: "rss",
    checks: 2,
    candidates: 8,
    success: 1,
    empty: 1,
    error: 0,
    errorRate: 0,
    status: "warning",
  });
  assert.equal(health.find(({ family }) => family === "youtube")?.errorRate, 50);
  assert.equal(health.find(({ family }) => family === "youtube")?.status, "fail");
  assert.equal(health.find(({ family }) => family === "public_data")?.candidates, 12);
  assert.equal(health.length, 4);
});

test("product events accept only anonymous visitors and allowlisted metadata", () => {
  const normalized = normalizeProductEvent({
    visitorId: "anon:123e4567-e89b-42d3-a456-426614174000",
    eventName: "daily_start",
    path: "/daily?ignored=true",
    contentItemId: 42,
    category: "finance",
  });

  assert.equal(normalized.eventName, "daily_start");
  assert.equal(normalized.contentItemId, 42);
  assert.equal(normalized.category, "finance");
  assert.throws(() => normalizeProductEvent({ visitorId: "email@example.com", eventName: "site_visit" }));
  assert.throws(() => normalizeProductEvent({
    visitorId: "anon:123e4567-e89b-42d3-a456-426614174000",
    eventName: "unknown",
  }));
  assert.equal(normalizeProductEvent({
    visitorId: "anon:123e4567-e89b-42d3-a456-426614174000",
    eventName: "account_created",
  }).eventName, "account_created");
});

test("anonymous account linking keeps current-browser preferences first and removes duplicates", () => {
  assert.deepEqual(
    mergePreferenceCategories(
      ["finance", "health", "housing"],
      ["housing", "investment", "career", "rights"],
    ),
    ["finance", "health", "housing", "investment", "career"],
  );
});

test("editorial gate keeps beginner-relevant news and rejects lifestyle noise", () => {
  const finance = classifyNewsForBeginners(
    "예금 금리 하락기에 대출 이자 확인하는 법",
    "은행의 예금과 대출 금리가 달라지는 배경을 설명한다.",
  );
  const offTopic = classifyNewsForBeginners(
    "BMW 신형 SUV 디자인 공개",
    "새 자동차의 외관과 출시 색상을 소개한다.",
  );
  const social = classifyNewsForBeginners(
    "사회초년생이 알아야 할 직장 피드백 대화법",
    "신입과 동료가 조직문화 안에서 갈등을 줄이는 방법을 소개한다.",
  );

  assert.equal(finance?.category, "finance");
  assert.ok(finance?.matchedTerms.includes("예금"));
  assert.equal(offTopic, null);
  assert.equal(social?.category, "social_skills");
  assert.equal(youtubeEditorialPlanForKstSlot(new Date("2026-06-26T15:00:00Z")).category, "finance");
  assert.deepEqual(
    youtubeEditorialPlansForKstRun(new Date("2026-06-26T15:00:00Z")).map((plan) => plan.category),
    ["finance", "seoul_life"],
  );
  const firstRun = new Date("2026-06-26T15:00:00Z");
  const dailyCategories = Array.from({ length: 4 }, (_, index) =>
    youtubeEditorialPlansForKstRun(new Date(firstRun.getTime() + index * 6 * 60 * 60 * 1_000)),
  ).flatMap((plans) => plans.map((plan) => plan.category));
  assert.deepEqual(dailyCategories, [
    "finance",
    "seoul_life",
    "housing",
    "social_skills",
    "rights",
    "digital_safety",
    "health",
    "career",
  ]);
});

test("Notion release headings, dates, sections, and bullets are parsed", () => {
  const richText = (plain_text) => [{ plain_text }];
  const releases = parseNotionReleaseBlocks([
    { type: "paragraph", paragraph: { rich_text: richText("페이지 소개") } },
    { type: "heading_2", heading_2: { rich_text: richText("v0.4 — 2026.06.28 릴리즈 노트") } },
    { type: "heading_3", heading_3: { rich_text: richText("신규 기능") } },
    { type: "bulleted_list_item", bulleted_list_item: { rich_text: richText("공개 페이지 추가") } },
    { type: "heading_2", heading_2: { rich_text: richText("v0.3 — 2차 업데이트") } },
    { type: "paragraph", paragraph: { rich_text: richText("2026-06-27") } },
    { type: "callout", callout: { rich_text: richText("안정성 개선") } },
  ]);

  assert.deepEqual(releases, [
    {
      version: "v0.4",
      title: "릴리즈 노트",
      date: "2026-06-28",
      changes: [{ type: "bullet", text: "공개 페이지 추가", section: "신규 기능" }],
    },
    {
      version: "v0.3",
      title: "2차 업데이트",
      date: "2026-06-27",
      changes: [{ type: "callout", text: "안정성 개선" }],
    },
  ]);
});

test("checked-in release snapshot keeps the latest deployed version first", () => {
  assert.equal(FALLBACK_RELEASE_FEED.releases[0]?.version, "v0.21");
  assert.equal(FALLBACK_RELEASE_FEED.releases[0]?.date, "2026-08-11");
  assert.ok(FALLBACK_RELEASE_FEED.releases[0]?.changes.length >= 6);
});
