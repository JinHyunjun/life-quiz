import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createDb } from "../../../db/client";
import { getDueReviewCards, LOCAL_DEV_USER_ID, ReviewRequestError } from "../../../lib/reviews";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const db = createDb(env.DB);
    const userId = url.searchParams.get("userId") ?? LOCAL_DEV_USER_ID;
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const cards = await getDueReviewCards(db, userId, limit);

    return Response.json({
      userId,
      count: cards.length,
      cards,
    });
  } catch (error) {
    return jsonError(error);
  }
};

function jsonError(error: unknown) {
  if (error instanceof ReviewRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return Response.json({ error: "Failed to load due review cards." }, { status: 500 });
}
