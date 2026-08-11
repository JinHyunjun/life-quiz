import type { AppDb } from "../db/client.ts";
import {
  PRODUCT_EVENT_NAMES,
  productEvents,
  type ProductEventName,
} from "../db/schema.ts";
import { CATEGORY_LABELS } from "./categories.ts";

const EVENT_NAMES = new Set<string>(PRODUCT_EVENT_NAMES);
const VISITOR_ID_PATTERN = /^anon:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProductEventRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface ProductEventInput {
  visitorId?: unknown;
  eventName?: unknown;
  path?: unknown;
  contentItemId?: unknown;
  category?: unknown;
}

export function normalizeProductEvent(input: ProductEventInput) {
  const visitorId = typeof input.visitorId === "string" ? input.visitorId.trim() : "";
  if (!VISITOR_ID_PATTERN.test(visitorId)) {
    throw new ProductEventRequestError("올바른 브라우저 식별자가 필요합니다.");
  }

  const eventName = typeof input.eventName === "string" ? input.eventName : "";
  if (!EVENT_NAMES.has(eventName)) {
    throw new ProductEventRequestError("지원하지 않는 행동 이벤트입니다.");
  }

  const path = typeof input.path === "string" && input.path.startsWith("/")
    ? input.path.slice(0, 120)
    : null;
  const parsedContentItemId = input.contentItemId === undefined || input.contentItemId === null
    ? null
    : Number(input.contentItemId);
  if (parsedContentItemId !== null && (!Number.isInteger(parsedContentItemId) || parsedContentItemId < 1)) {
    throw new ProductEventRequestError("contentItemId는 양의 정수여야 합니다.");
  }

  const category = typeof input.category === "string" && input.category in CATEGORY_LABELS
    ? input.category
    : null;

  return {
    visitorId,
    eventName: eventName as ProductEventName,
    path,
    contentItemId: parsedContentItemId,
    category,
  };
}

export async function recordProductEvent(db: AppDb, input: ProductEventInput, now = new Date()) {
  const event = normalizeProductEvent(input);
  await db.insert(productEvents).values({ ...event, createdAt: now });
  return { recorded: true as const };
}
