import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { contentItems, quizItems, sources, type ContentCard } from "../db/schema";
import { sanitizeContentCards } from "./card-quality";
import type { Category } from "./categories";
import { kstDayRange, todayKstRange } from "./dates";

export const ARCHIVE_PAGE_SIZE = 12;

export type OriginType = NonNullable<typeof sources.$inferSelect.originType>;

export interface ArchiveFilters {
  category?: Category;
  date?: string;
  originType?: OriginType;
  page?: number;
  pageSize?: number;
  now?: Date;
}

const summaryFields = {
  id: contentItems.id,
  title: contentItems.title,
  bodyMd: contentItems.bodyMd,
  cards: contentItems.cards,
  contentFormat: contentItems.contentFormat,
  category: contentItems.category,
  citationUrl: contentItems.citationUrl,
  citationLabel: contentItems.citationLabel,
  createdAt: contentItems.createdAt,
};

const countValue = sql<number>`count(*)`.mapWith(Number).as("count");

export async function listTodayContentItems(db: AppDb, category?: Category, now = new Date()) {
  const today = todayKstRange(now);
  const conditions: SQL[] = [gte(contentItems.createdAt, today.start), lt(contentItems.createdAt, today.end)];
  if (category) conditions.push(eq(contentItems.category, category));

  const items = await db
    .select(summaryFields)
    .from(contentItems)
    .where(and(...conditions))
    .orderBy(desc(contentItems.createdAt));
  return items.map(withQualityCards);
}

export async function listRecentVisualGuides(db: AppDb, category?: Category, limit = 2) {
  const conditions: SQL[] = [eq(contentItems.contentFormat, "visual_guide")];
  if (category) conditions.push(eq(contentItems.category, category));

  const items = await db
    .select(summaryFields)
    .from(contentItems)
    .where(and(...conditions))
    .orderBy(desc(contentItems.createdAt), desc(contentItems.id))
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 6));
  return items.map(withQualityCards);
}

export async function getContentStats(db: AppDb, now = new Date()) {
  const today = todayKstRange(now);
  const [[total], [todayCount], [archiveCount]] = await Promise.all([
    db.select({ count: countValue }).from(contentItems),
    db.select({ count: countValue }).from(contentItems).where(and(
      gte(contentItems.createdAt, today.start),
      lt(contentItems.createdAt, today.end),
    )),
    db.select({ count: countValue }).from(contentItems).where(lt(contentItems.createdAt, today.start)),
  ]);

  return {
    total: total?.count ?? 0,
    today: todayCount?.count ?? 0,
    archive: archiveCount?.count ?? 0,
    todayKey: today.key,
  };
}

export async function listArchivedContentItems(db: AppDb, filters: ArchiveFilters = {}) {
  const today = todayKstRange(filters.now ?? new Date());
  const conditions: SQL[] = [lt(contentItems.createdAt, today.start)];
  const selectedDay = filters.date ? kstDayRange(filters.date) : null;

  if (selectedDay && selectedDay.start < today.start) {
    conditions.push(gte(contentItems.createdAt, selectedDay.start), lt(contentItems.createdAt, selectedDay.end));
  }
  if (filters.category) conditions.push(eq(contentItems.category, filters.category));
  if (filters.originType) conditions.push(eq(sources.originType, filters.originType));

  const where = and(...conditions);
  const pageSize = normalizePageSize(filters.pageSize);
  const requestedPage = normalizePage(filters.page);
  const [countRow] = await db
    .select({ count: countValue })
    .from(contentItems)
    .leftJoin(sources, eq(contentItems.sourceId, sources.id))
    .where(where);
  const total = countRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const items = await db
    .select({ ...summaryFields, originType: sources.originType })
    .from(contentItems)
    .leftJoin(sources, eq(contentItems.sourceId, sources.id))
    .where(where)
    .orderBy(desc(contentItems.createdAt), desc(contentItems.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items: items.map(withQualityCards), total, page, totalPages, pageSize };
}

export async function listArchiveDays(db: AppDb, now = new Date(), limit = 90) {
  const today = todayKstRange(now);
  const dayExpression = sql<string>`date(${contentItems.createdAt}, 'unixepoch', '+9 hours')`;

  return db
    .select({ day: dayExpression, count: countValue })
    .from(contentItems)
    .where(lt(contentItems.createdAt, today.start))
    .groupBy(dayExpression)
    .orderBy(desc(dayExpression))
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 366));
}

export async function getArchiveFacets(db: AppDb, now = new Date()) {
  const today = todayKstRange(now);
  const archived = lt(contentItems.createdAt, today.start);

  const [categoryCounts, sourceCounts] = await Promise.all([
    db
      .select({ category: contentItems.category, count: countValue })
      .from(contentItems)
      .where(archived)
      .groupBy(contentItems.category)
      .orderBy(desc(countValue)),
    db
      .select({ originType: sources.originType, count: countValue })
      .from(contentItems)
      .innerJoin(sources, eq(contentItems.sourceId, sources.id))
      .where(archived)
      .groupBy(sources.originType)
      .orderBy(desc(countValue)),
  ]);

  return { categoryCounts, sourceCounts };
}

export async function getContentItemWithQuiz(db: AppDb, id: number) {
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  if (!item) return null;

  const quizzes = await db.select().from(quizItems).where(eq(quizItems.contentItemId, id));
  return { item: withQualityCards(item), quizzes };
}

export async function listChatTopics(db: AppDb, limit = 24) {
  return db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      category: contentItems.category,
      citationLabel: contentItems.citationLabel,
    })
    .from(contentItems)
    .orderBy(desc(contentItems.createdAt))
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 50));
}

function normalizePage(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value!)) : 1;
}

function normalizePageSize(value: number | undefined) {
  if (!Number.isFinite(value)) return ARCHIVE_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(value!), 6), 36);
}

function withQualityCards<T extends { cards: ContentCard[] | null }>(item: T): T {
  return {
    ...item,
    cards: item.cards ? sanitizeContentCards(item.cards) : null,
  };
}
