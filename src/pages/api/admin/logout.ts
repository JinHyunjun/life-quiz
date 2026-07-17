import type { APIRoute } from "astro";
import { clearAdminSessionCookie } from "../../../lib/admin";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  }

  return new Response(null, {
    status: 303,
    headers: {
      location: "/admin/login",
      "set-cookie": clearAdminSessionCookie(url.protocol === "https:"),
      "cache-control": "no-store",
    },
  });
};
