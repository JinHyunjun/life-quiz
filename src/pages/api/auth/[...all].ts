import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createLifeQuizAuth } from "../../../lib/auth";

export const prerender = false;

export const ALL: APIRoute = async ({ request }) => {
  return createLifeQuizAuth(env.DB, env.BETTER_AUTH_SECRET, request).handler(request);
};
