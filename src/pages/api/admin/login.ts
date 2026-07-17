import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createAdminSessionCookie, verifyAdminSecret } from "../../../lib/admin";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const requestedReturnTo = String(form.get("returnTo") ?? "/admin");
  const returnTo = safeAdminPath(requestedReturnTo);

  if (!(await verifyAdminSecret(password, env.INGEST_ADMIN_TOKEN))) {
    const location = `/admin/login?error=1&returnTo=${encodeURIComponent(returnTo)}`;
    return new Response(null, {
      status: 303,
      headers: { location, "cache-control": "no-store" },
    });
  }

  return new Response(null, {
    status: 303,
    headers: {
      location: returnTo,
      "set-cookie": await createAdminSessionCookie(env.INGEST_ADMIN_TOKEN, url.protocol === "https:"),
      "cache-control": "no-store",
    },
  });
};

function safeAdminPath(value: string) {
  return value.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}
