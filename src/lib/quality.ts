import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { contentItems, ingestionRuns, quizItems, sources, type IngestionCollectorDiagnostic } from "../db/schema";
import { kstDateKey, todayKstRange } from "./dates";

export type QualityStatus = "pass" | "warning" | "fail";

export interface QualityCheck {
  key: string;
  label: string;
  value: string;
  detail: string;
  status: QualityStatus;
}

const DAY_MS = 24 * 60 * 60 * 1_000;
const publishedContent = eq(contentItems.moderationStatus, "published");

export async function getQualityDashboard(db: AppDb, now = new Date()) {
  const today = todayKstRange(now);
  const historyStart = new Date(today.start.getTime() - 13 * DAY_MS);

  const [contentRows, hiddenRows, todayCategories, dailyRows, sourceRows, runs] = await Promise.all([
    db
      .select({
        total: sql<number>`count(distinct ${contentItems.id})`.mapWith(Number),
        cited: sql<number>`count(distinct case when ${contentItems.citationUrl} like 'http%' then ${contentItems.id} end)`.mapWith(Number),
        fourCards: sql<number>`count(distinct case when json_valid(${contentItems.cards}) = 1 and json_array_length(${contentItems.cards}) = 4 then ${contentItems.id} end)`.mapWith(Number),
        detailed: sql<number>`count(distinct case when length(trim(${contentItems.bodyMd})) >= 350 then ${contentItems.id} end)`.mapWith(Number),
        quizzed: sql<number>`count(distinct case when ${quizItems.id} is not null then ${contentItems.id} end)`.mapWith(Number),
      })
      .from(contentItems)
      .leftJoin(quizItems, eq(quizItems.contentItemId, contentItems.id))
      .where(publishedContent),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(contentItems)
      .where(eq(contentItems.moderationStatus, "hidden")),
    db
      .select({
        category: contentItems.category,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(contentItems)
      .where(and(publishedContent, gte(contentItems.createdAt, today.start)))
      .groupBy(contentItems.category)
      .orderBy(desc(sql<number>`count(*)`)),
    db
      .select({
        day: sql<string>`date(${contentItems.createdAt}, 'unixepoch', '+9 hours')`,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(contentItems)
      .where(and(publishedContent, gte(contentItems.createdAt, historyStart)))
      .groupBy(sql`date(${contentItems.createdAt}, 'unixepoch', '+9 hours')`)
      .orderBy(sql`date(${contentItems.createdAt}, 'unixepoch', '+9 hours')`),
    db
      .select({
        originType: sources.originType,
        count: sql<number>`count(distinct ${contentItems.id})`.mapWith(Number),
      })
      .from(contentItems)
      .leftJoin(sources, eq(contentItems.sourceId, sources.id))
      .where(publishedContent)
      .groupBy(sources.originType)
      .orderBy(desc(sql<number>`count(distinct ${contentItems.id})`)),
    db
      .select()
      .from(ingestionRuns)
      .orderBy(desc(ingestionRuns.startedAt))
      .limit(12),
  ]);

  const content = contentRows[0] ?? { total: 0, cited: 0, fourCards: 0, detailed: 0, quizzed: 0 };
  const todayCount = todayCategories.reduce((sum, row) => sum + row.count, 0);
  const latestRun = runs[0];
  const failures24h = runs
    .filter((run) => run.startedAt.getTime() >= now.getTime() - DAY_MS)
    .reduce((sum, run) => sum + run.failedCount, 0);
  const latestRunAgeHours = latestRun ? (now.getTime() - latestRun.finishedAt.getTime()) / (60 * 60 * 1_000) : Infinity;

  const checks: QualityCheck[] = [
    {
      key: "today-volume",
      label: "오늘 발행량",
      value: `${todayCount}개`,
      detail: "하루 12개 이상을 안정 구간으로 판단",
      status: minimumStatus(todayCount, 12, 6),
    },
    {
      key: "topic-breadth",
      label: "오늘 주제 다양성",
      value: `${todayCategories.length}/12개 분야`,
      detail: "8개 이상 분야가 있으면 정상",
      status: minimumStatus(todayCategories.length, 8, 5),
    },
    ratioCheck("citation", "원문 출처 연결", content.cited, content.total, 90, 80),
    ratioCheck("cards", "4컷 카드 구조", content.fourCards, content.total, 95, 85),
    ratioCheck("detail", "본문 충실도", content.detailed, content.total, 90, 75),
    ratioCheck("quiz", "퀴즈 연결", content.quizzed, content.total, 95, 85),
    {
      key: "pipeline",
      label: "수집 파이프라인",
      value: latestRun ? `${latestRun.createdCount}개 생성 · ${failures24h}건 실패` : "실행 기록 없음",
      detail: latestRun ? `마지막 실행 ${formatKstDateTime(latestRun.finishedAt)}` : "수집 Worker 실행 이력이 필요합니다.",
      status: !latestRun || latestRun.status === "error" || latestRunAgeHours > 8
        ? "fail"
        : failures24h > 0
          ? "warning"
          : "pass",
    },
  ];

  const overallStatus: QualityStatus = checks.some((check) => check.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "warning")
      ? "warning"
      : "pass";

  const dayCounts = new Map(dailyRows.map((row) => [row.day, row.count]));
  const daily = Array.from({ length: 14 }, (_, index) => {
    const day = kstDateKey(new Date(historyStart.getTime() + index * DAY_MS));
    return { day, count: dayCounts.get(day) ?? 0 };
  });

  return {
    overallStatus,
    checks,
    content,
    hiddenCount: hiddenRows[0]?.count ?? 0,
    todayCount,
    todayCategories,
    daily,
    sourceRows,
    runs,
    latestDiagnostics: (latestRun?.collectorDiagnostics ?? []) as IngestionCollectorDiagnostic[],
    checkedAt: now,
  };
}

function ratioCheck(key: string, label: string, numerator: number, denominator: number, passAt: number, warnAt: number): QualityCheck {
  const percentage = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
  return {
    key,
    label,
    value: `${percentage}%`,
    detail: `${numerator}/${denominator}개 콘텐츠 충족`,
    status: minimumStatus(percentage, passAt, warnAt),
  };
}

function minimumStatus(value: number, passAt: number, warnAt: number): QualityStatus {
  if (value >= passAt) return "pass";
  if (value >= warnAt) return "warning";
  return "fail";
}

function formatKstDateTime(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}
