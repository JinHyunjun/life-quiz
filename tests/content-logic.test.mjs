import assert from "node:assert/strict";
import test from "node:test";
import { assertDistinctCards, sanitizeContentCards } from "../src/lib/card-quality.ts";
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

test("starter glossary begins with the most basic finance and housing terms", () => {
  const topics = glossaryTopicsForKstDay(new Date("2026-06-26T15:00:00Z"));
  assert.deepEqual(
    topics.map(({ category, term }) => ({ category, term })),
    [
      { category: "finance", term: "예금과 적금" },
      { category: "housing", term: "전세와 월세" },
    ],
  );
});

test("same-name districts from outside Seoul are rejected", () => {
  assert.equal(rowMatchesRegion({ CTPV_NM: "서울특별시", SGG_NM: "중구" }, "서울", "중구"), true);
  assert.equal(rowMatchesRegion({ CTPV_NM: "대구광역시", SGG_NM: "중구" }, "서울", "중구"), false);
});
