import { desc, eq } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { contentItems, quizItems } from "../db/schema";

type Category = "finance" | "housing" | "seoul_life" | "daily_tips";

export async function listContentItems(db: AppDb, category?: Category) {
  const query = db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      category: contentItems.category,
      citationLabel: contentItems.citationLabel,
      createdAt: contentItems.createdAt,
    })
    .from(contentItems)
    .orderBy(desc(contentItems.createdAt));

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
