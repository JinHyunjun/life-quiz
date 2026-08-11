import { getAnonymousUserId } from "./anonymous-user";
import type { ProductEventName } from "../db/schema";

interface ProductEventMetadata {
  path?: string;
  contentItemId?: number;
  category?: string;
}

interface ProductEventOptions {
  oncePerSessionKey?: string;
}

export function trackProductEvent(
  eventName: ProductEventName,
  metadata: ProductEventMetadata = {},
  options: ProductEventOptions = {},
) {
  const storageKey = options.oncePerSessionKey
    ? `life-quiz-event:${options.oncePerSessionKey}`
    : null;

  if (storageKey) {
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "pending");
    } catch {
      // Event delivery still works when session storage is unavailable.
    }
  }

  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      visitorId: getAnonymousUserId(),
      eventName,
      path: metadata.path ?? window.location.pathname,
      contentItemId: metadata.contentItemId,
      category: metadata.category,
    }),
    keepalive: true,
  })
    .then((response) => {
      if (!response.ok) clearPendingEvent(storageKey);
    })
    .catch(() => clearPendingEvent(storageKey));
}

function clearPendingEvent(storageKey: string | null) {
  if (!storageKey) return;
  try {
    sessionStorage.removeItem(storageKey);
  } catch {}
}
