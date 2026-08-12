import { SUPPORT_REQUEST_CATEGORIES, type SupportRequestCategory } from "../db/schema.ts";

export interface SupportFormInput {
  name: string;
  email: string;
  category: SupportRequestCategory;
  subject: string;
  message: string;
}

export class SupportRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function parseSupportForm(value: unknown): SupportFormInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SupportRequestError("문의 내용을 확인해주세요.");
  }
  const input = value as Record<string, unknown>;
  if (cleanText(input.website, 0, 200)) throw new SupportRequestError("문의 내용을 확인해주세요.");
  if (input.consent !== true) throw new SupportRequestError("문의 처리와 답변을 위한 정보 이용에 동의해주세요.");

  const name = cleanText(input.name, 1, 80, "이름을 80자 이내로 입력해주세요.");
  const email = cleanText(input.email, 3, 254, "답변받을 이메일을 확인해주세요.").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SupportRequestError("답변받을 이메일을 확인해주세요.");
  }

  const category = typeof input.category === "string" && SUPPORT_REQUEST_CATEGORIES.includes(input.category as SupportRequestCategory)
    ? input.category as SupportRequestCategory
    : null;
  if (!category) throw new SupportRequestError("문의 유형을 선택해주세요.");

  return {
    name,
    email,
    category,
    subject: cleanText(input.subject, 5, 100, "문의 제목은 5자 이상 100자 이내로 입력해주세요."),
    message: cleanText(input.message, 20, 2_000, "문의 내용은 20자 이상 2,000자 이내로 입력해주세요."),
  };
}

function cleanText(value: unknown, minimum: number, maximum: number, message = "입력 내용을 확인해주세요.") {
  const text = typeof value === "string"
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()
    : "";
  if (text.length < minimum || text.length > maximum) throw new SupportRequestError(message);
  return text;
}
