import { normalizeReviewUserId, ReviewRequestError } from "./reviews";
import { mergePreferenceCategories } from "./account-linking-logic";
import { CATEGORY_LABELS, type Category } from "./categories";

interface LinkAccountInput {
  anonymousUserId: string;
  authUserId: string;
  authUserName: string;
  now?: Date;
}

interface AnonymousDataCountRow {
  learning: number;
  reviews: number;
  daily: number;
  saved: number;
  feedback: number;
  preferences: number;
}

export async function linkAnonymousLearningData(database: D1Database, input: LinkAccountInput) {
  const anonymousUserId = normalizeReviewUserId(input.anonymousUserId);
  if (!anonymousUserId.startsWith("anon:")) {
    throw new ReviewRequestError("연결할 익명 브라우저 기록이 없습니다.");
  }

  const authUserId = input.authUserId.trim();
  if (!authUserId) throw new ReviewRequestError("로그인 계정 정보가 필요합니다.");

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000);
  const [counts, anonymousPreference, accountPreference] = await Promise.all([
    database.prepare(`
      SELECT
        (SELECT count(*) FROM learning_items WHERE user_id = ?) AS learning,
        (SELECT count(*) FROM review_logs WHERE user_id = ?) AS reviews,
        (SELECT count(*) FROM daily_session_items WHERE user_id = ?) AS daily,
        (SELECT count(*) FROM saved_content_items WHERE user_id = ?) AS saved,
        (SELECT count(*) FROM content_feedback WHERE user_id = ?) AS feedback,
        (SELECT count(*) FROM user_preferences WHERE user_id = ?) AS preferences
    `).bind(anonymousUserId, anonymousUserId, anonymousUserId, anonymousUserId, anonymousUserId, anonymousUserId).first<AnonymousDataCountRow>(),
    loadPreferenceCategories(database, anonymousUserId),
    loadPreferenceCategories(database, authUserId),
  ]);

  const mergedCategories = mergePreferenceCategories(anonymousPreference, accountPreference);
  const statements = [
    database.prepare(`
      INSERT INTO users (id, email, name, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = COALESCE(excluded.name, users.name)
    `).bind(authUserId, `account-${authUserId}@local.life-quiz.invalid`, cleanName(input.authUserName), nowSeconds),
    database.prepare(`
      INSERT OR IGNORE INTO learning_items (user_id, content_item_id, enrolled_at)
      SELECT ?, content_item_id, enrolled_at FROM learning_items WHERE user_id = ?
    `).bind(authUserId, anonymousUserId),
    database.prepare("DELETE FROM learning_items WHERE user_id = ?").bind(anonymousUserId),
    database.prepare("UPDATE review_logs SET user_id = ? WHERE user_id = ?").bind(authUserId, anonymousUserId),
    database.prepare(`
      INSERT OR IGNORE INTO daily_session_items
        (user_id, kst_date, quiz_item_id, position, item_type, completed_at, created_at)
      SELECT ?, kst_date, quiz_item_id, position, item_type, completed_at, created_at
      FROM daily_session_items WHERE user_id = ?
    `).bind(authUserId, anonymousUserId),
    database.prepare(`
      UPDATE daily_session_items AS target
      SET completed_at = COALESCE(
        target.completed_at,
        (SELECT source.completed_at FROM daily_session_items AS source
         WHERE source.user_id = ? AND source.kst_date = target.kst_date
           AND source.quiz_item_id = target.quiz_item_id LIMIT 1)
      )
      WHERE target.user_id = ? AND EXISTS (
        SELECT 1 FROM daily_session_items AS source
        WHERE source.user_id = ? AND source.kst_date = target.kst_date
          AND source.quiz_item_id = target.quiz_item_id
      )
    `).bind(anonymousUserId, authUserId, anonymousUserId),
    database.prepare("DELETE FROM daily_session_items WHERE user_id = ?").bind(anonymousUserId),
    database.prepare(`
      INSERT OR IGNORE INTO saved_content_items (user_id, content_item_id, saved_at)
      SELECT ?, content_item_id, saved_at FROM saved_content_items WHERE user_id = ?
    `).bind(authUserId, anonymousUserId),
    database.prepare("DELETE FROM saved_content_items WHERE user_id = ?").bind(anonymousUserId),
    database.prepare(`
      INSERT OR IGNORE INTO content_feedback
        (content_item_id, user_id, kind, status, created_at, resolved_at)
      SELECT content_item_id, ?, kind, status, created_at, resolved_at
      FROM content_feedback WHERE user_id = ?
    `).bind(authUserId, anonymousUserId),
    database.prepare("DELETE FROM content_feedback WHERE user_id = ?").bind(anonymousUserId),
  ];

  if (mergedCategories.length > 0) {
    statements.push(database.prepare(`
      INSERT INTO user_preferences (user_id, categories, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET categories = excluded.categories, updated_at = excluded.updated_at
    `).bind(authUserId, JSON.stringify(mergedCategories), nowSeconds));
  }
  statements.push(
    database.prepare("DELETE FROM user_preferences WHERE user_id = ?").bind(anonymousUserId),
    database.prepare("DELETE FROM users WHERE id = ?").bind(anonymousUserId),
  );

  await database.batch(statements);
  const movedRecords = counts
    ? counts.learning + counts.reviews + counts.daily + counts.saved + counts.feedback + counts.preferences
    : 0;

  return {
    linked: movedRecords > 0,
    movedRecords,
    categories: mergedCategories,
  };
}

async function loadPreferenceCategories(database: D1Database, userId: string): Promise<Category[]> {
  const row = await database
    .prepare("SELECT categories FROM user_preferences WHERE user_id = ?")
    .bind(userId)
    .first<{ categories: string }>();
  if (!row) return [];

  try {
    const value = JSON.parse(row.categories);
    if (!Array.isArray(value)) return [];
    return value.filter((category): category is Category => typeof category === "string" && category in CATEGORY_LABELS);
  } catch {
    return [];
  }
}

function cleanName(value: string) {
  const name = value.trim().slice(0, 80);
  return name || "라이프퀴즈 사용자";
}
