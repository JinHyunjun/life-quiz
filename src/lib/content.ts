import { desc, eq } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { contentItems, quizItems } from "../db/schema";
import type { Category } from "../lib/categories";

export async function listContentItems(db: AppDb, category?: Category) {
  const query = db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      bodyMd: contentItems.bodyMd,
      cards: contentItems.cards,
      category: contentItems.category,
      citationUrl: contentItems.citationUrl,
      citationLabel: contentItems.citationLabel,
      createdAt: contentItems.createdAt,
    })
    .from(contentItems)
    .orderBy(desc(contentItems.createdAt))
    .limit(60);

  return category ? await query.where(eq(contentItems.category, category)) : await query;
}

export async function getContentItemWithQuiz(db: AppDb, id: number) {
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  if (!item) {
    return null;
  }

  const quizzes = await db.select().from(quizItems).where(eq(quizItems.contentItemId, id));
  return { item, quizzes };
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
