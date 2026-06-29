import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertDeepReadCoversCards, assertDistinctCards, sanitizeContentCards } from "../src/lib/card-quality.ts";
import { SEOUL_DISTRICTS, seoulDistrictForKstRun } from "../workers/ingest/src/districts.ts";
import { glossaryTopicsForKstDay } from "../workers/ingest/src/glossary.ts";
import { rowMatchesRegion } from "../workers/ingest/src/fetchers/gov.ts";
import { classifyNewsForBeginners, youtubeEditorialPlanForKstSlot } from "../workers/ingest/src/editorial.ts";
import { normalizeGeminiRpmBudget } from "../workers/ingest/src/rate-limit.ts";
import { triviaSourceForKstDay } from "../workers/ingest/src/trivia-sources.ts";
import {
  ingestionPacingDelayMs,
  scheduledAiCurriculumForKstRun,
} from "../workers/ingest/src/schedule.ts";
import { parseNotionReleaseBlocks } from "../src/lib/releases.ts";

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

test("AI general knowledge rotates through externally grounded topics", () => {
  const first = triviaSourceForKstDay("history", new Date("2026-06-28T15:00:00Z"));
  const second = triviaSourceForKstDay("history", new Date("2026-06-29T15:00:00Z"));

  assert.notEqual(first.wikipediaTitle, second.wikipediaTitle);
  assert.match(first.sourceUrl, /^https:\/\/ko\.wikipedia\.org\/wiki\//);
  assert.match(second.sourceUrl, /^https:\/\/ko\.wikipedia\.org\/wiki\//);
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
  assert.equal(ingestionPacingDelayMs(1_000, 8_000, 4_000), 5_000);
  assert.equal(ingestionPacingDelayMs(1_000, 8_000, 10_000), 0);
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

  assert.equal(finance?.category, "finance");
  assert.ok(finance?.matchedTerms.includes("예금"));
  assert.equal(offTopic, null);
  assert.equal(youtubeEditorialPlanForKstSlot(new Date("2026-06-26T15:00:00Z")).category, "finance");
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
