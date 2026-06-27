import assert from "node:assert/strict";
import test from "node:test";
import { assertDeepReadCoversCards, assertDistinctCards, sanitizeContentCards } from "../src/lib/card-quality.ts";
import { SEOUL_DISTRICTS, seoulDistrictForKstRun } from "../workers/ingest/src/districts.ts";
import { glossaryTopicsForKstDay } from "../workers/ingest/src/glossary.ts";
import { rowMatchesRegion } from "../workers/ingest/src/fetchers/gov.ts";

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
