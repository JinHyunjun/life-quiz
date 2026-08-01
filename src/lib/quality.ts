import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  contentFeedback,
  contentItems,
  dailySessionItems,
  geminiRequestLog,
  ingestionRuns,
  quizItems,
  savedContentItems,
  sources,
  userPreferences,
  type IngestionCollectorDiagnostic,
} from "../db/schema";
import { kstDateKey, todayKstRange } from "./dates";
import { CATEGORY_LABELS } from "./categories";
import {
  DEFAULT_GEMINI_DAILY_BUDGET,
  geminiBudgetStatus,
  normalizeGeminiDailyBudget,
  summarizeCollectorHealth,
} from "./operations";
import { DAILY_PUBLISHING_TARGETS } from "./publishing-policy";

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

export async function getQualityDashboard(db: AppDb, now = new Date(), dailyGeminiBudgetValue = DEFAULT_GEMINI_DAILY_BUDGET) {
  const today = todayKstRange(now);
  const historyStart = new Date(today.start.getTime() - 13 * DAY_MS);
  const collectorHistoryStart = new Date(now.getTime() - 7 * DAY_MS);
  const dailyGeminiBudget = normalizeGeminiDailyBudget(dailyGeminiBudgetValue);

  const [
    contentRows,
    hiddenRows,
    todayCategories,
    dailyRows,
    sourceRows,
    runs,
    feedbackCounts,
    openFeedback,
    preferenceUserRows,
    savedItemRows,
    completedSessionRows,
    geminiPurposeRows,
    geminiDailyRows,
    collectorRuns,
  ] = await Promise.all([
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
    db
      .select({
        kind: contentFeedback.kind,
        status: contentFeedback.status,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(contentFeedback)
      .groupBy(contentFeedback.kind, contentFeedback.status),
    db
      .select({
        id: contentFeedback.id,
        kind: contentFeedback.kind,
        createdAt: contentFeedback.createdAt,
        contentItemId: contentItems.id,
        title: contentItems.title,
        category: contentItems.category,
        citationLabel: contentItems.citationLabel,
      })
      .from(contentFeedback)
      .innerJoin(contentItems, eq(contentItems.id, contentFeedback.contentItemId))
      .where(and(
        eq(contentFeedback.status, "open"),
        ne(contentFeedback.kind, "helpful"),
      ))
      .orderBy(desc(contentFeedback.createdAt))
      .limit(30),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(userPreferences),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(savedContentItems),
    db
      .select({
        userId: dailySessionItems.userId,
        date: dailySessionItems.kstDate,
      })
      .from(dailySessionItems)
      .groupBy(dailySessionItems.userId, dailySessionItems.kstDate)
      .having(sql`count(*) > 0 and sum(case when ${dailySessionItems.completedAt} is not null then 1 else 0 end) = count(*)`),
    db
      .select({
        purpose: geminiRequestLog.purpose,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(geminiRequestLog)
      .where(gte(geminiRequestLog.requestedAtMs, today.start.getTime()))
      .groupBy(geminiRequestLog.purpose),
    db
      .select({
        day: sql<string>`date(${geminiRequestLog.requestedAtMs} / 1000, 'unixepoch', '+9 hours')`,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(geminiRequestLog)
      .where(gte(geminiRequestLog.requestedAtMs, historyStart.getTime()))
      .groupBy(sql`date(${geminiRequestLog.requestedAtMs} / 1000, 'unixepoch', '+9 hours')`)
      .orderBy(sql`date(${geminiRequestLog.requestedAtMs} / 1000, 'unixepoch', '+9 hours')`),
    db
      .select({ collectorDiagnostics: ingestionRuns.collectorDiagnostics })
      .from(ingestionRuns)
      .where(gte(ingestionRuns.startedAt, collectorHistoryStart))
      .orderBy(desc(ingestionRuns.startedAt))
      .limit(40),
  ]);

  const content = contentRows[0] ?? { total: 0, cited: 0, fourCards: 0, detailed: 0, quizzed: 0 };
  const todayCount = todayCategories.reduce((sum, row) => sum + row.count, 0);
  const latestRun = runs[0];
  const failures24h = runs
    .filter((run) => run.startedAt.getTime() >= now.getTime() - DAY_MS)
    .reduce((sum, run) => sum + run.failedCount, 0);
  const latestRunAgeHours = latestRun ? (now.getTime() - latestRun.finishedAt.getTime()) / (60 * 60 * 1_000) : Infinity;
  const openFeedbackCount = feedbackCounts
    .filter(({ kind, status }) => kind !== "helpful" && status === "open")
    .reduce((sum, { count }) => sum + count, 0);
  const helpfulCount = feedbackCounts
    .filter(({ kind }) => kind === "helpful")
    .reduce((sum, { count }) => sum + count, 0);
  const geminiPurposeCounts = new Map(geminiPurposeRows.map(({ purpose, count }) => [purpose, count]));
  const geminiTodayCount = geminiPurposeRows.reduce((sum, { count }) => sum + count, 0);
  const geminiBudget = geminiBudgetStatus(geminiTodayCount, dailyGeminiBudget);
  const collectorHealth = summarizeCollectorHealth(collectorRuns);
  const collectorChecks = collectorHealth.reduce((sum, row) => sum + row.checks, 0);
  const collectorErrors = collectorHealth.reduce((sum, row) => sum + row.error, 0);
  const collectorEmpty = collectorHealth.reduce((sum, row) => sum + row.empty, 0);
  const collectorStatus: QualityStatus = collectorChecks === 0 || collectorHealth.some(({ status }) => status === "fail")
    ? "fail"
    : collectorHealth.some(({ status }) => status === "warning")
      ? "warning"
      : "pass";
  const publishedCategories = new Set(todayCategories.map(({ category }) => category));
  const missingCategories = (Object.keys(DAILY_PUBLISHING_TARGETS) as Array<keyof typeof DAILY_PUBLISHING_TARGETS>)
    .filter((category) => !publishedCategories.has(category))
    .map((category) => CATEGORY_LABELS[category]);

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
      detail: missingCategories.length > 0
        ? `미발행: ${missingCategories.join(" · ")}`
        : "12개 분야가 모두 발행되었습니다.",
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
    {
      key: "feedback",
      label: "열린 사용자 제보",
      value: `${openFeedbackCount}건`,
      detail: openFeedbackCount > 0 ? "아래 QA 큐에서 내용과 출처를 확인하세요." : "처리할 콘텐츠 문제가 없습니다.",
      status: maximumStatus(openFeedbackCount, 0, 5),
    },
    {
      key: "gemini-budget",
      label: "Gemini 일일 예산",
      value: `${geminiBudget.used}/${geminiBudget.budget}회`,
      detail: `KST 00시 초기화 · ${geminiBudget.remaining}회 남음`,
      status: geminiBudget.status,
    },
    {
      key: "collector-health",
      label: "수집원 7일 안정성",
      value: collectorChecks > 0 ? `오류 ${collectorErrors} · 빈 응답 ${collectorEmpty}` : "진단 기록 없음",
      detail: "RSS·YouTube·공공데이터·커리큘럼 진단 합계",
      status: collectorStatus,
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
  const geminiDayCounts = new Map(geminiDailyRows.map((row) => [row.day, row.count]));
  const geminiDaily = Array.from({ length: 14 }, (_, index) => {
    const day = kstDateKey(new Date(historyStart.getTime() + index * DAY_MS));
    return { day, count: geminiDayCounts.get(day) ?? 0 };
  });
  const todayCountMap = new Map(todayCategories.map(({ category, count }) => [category, count]));
  const publishingTargets = Object.entries(DAILY_PUBLISHING_TARGETS).map(([category, target]) => {
    const count = todayCountMap.get(category as keyof typeof DAILY_PUBLISHING_TARGETS) ?? 0;
    return {
      category: category as keyof typeof DAILY_PUBLISHING_TARGETS,
      count,
      minimum: target.minimum,
      maximum: target.maximum,
      status: count >= target.minimum ? "met" as const : "below" as const,
    };
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
    publishingTargets,
    feedback: {
      helpfulCount,
      openCount: openFeedbackCount,
      queue: openFeedback,
    },
    engagement: {
      preferenceUsers: preferenceUserRows[0]?.count ?? 0,
      savedItems: savedItemRows[0]?.count ?? 0,
      completedDailySessions: completedSessionRows.length,
    },
    operations: {
      gemini: {
        ...geminiBudget,
        ingestion: geminiPurposeCounts.get("ingestion") ?? 0,
        chat: geminiPurposeCounts.get("chat") ?? 0,
        daily: geminiDaily,
      },
      collectorHealth,
      collectorWindowDays: 7,
    },
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

function maximumStatus(value: number, passAt: number, warnAt: number): QualityStatus {
  if (value <= passAt) return "pass";
  if (value <= warnAt) return "warning";
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
