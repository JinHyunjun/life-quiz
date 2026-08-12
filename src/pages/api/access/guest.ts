import type { APIRoute } from "astro";
import { clearGuestAccessCookie, createGuestAccessCookie, safeReturnPath } from "../../../lib/guest-access";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const returnTo = safeReturnPath(form.get("returnTo"));
  const url = new URL(request.url);

  return new Response(null, {
    status: 303,
    headers: {
      location: returnTo,
      "set-cookie": createGuestAccessCookie(url.protocol === "https:"),
      "cache-control": "no-store",
    },
  });
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  return Response.json({ cleared: true }, {
    headers: {
      "set-cookie": clearGuestAccessCookie(url.protocol === "https:"),
      "cache-control": "no-store",
    },
  });
};

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
