export interface CardText {
  heading: string;
  body: string;
}

const STOP_WORDS = new Set([
  "그리고",
  "하지만",
  "그래서",
  "때문에",
  "사회초년생",
  "있습니다",
  "있어요",
  "합니다",
  "하세요",
  "됩니다",
  "하는",
  "위해",
  "대한",
]);

export function sanitizeContentCards<T extends CardText>(cards: readonly T[] | null | undefined): T[] {
  const unique: T[] = [];

  for (const card of cards ?? []) {
    const cleaned = { ...card, heading: card.heading.trim(), body: card.body.trim() };
    if (!cleaned.heading || !cleaned.body) continue;
    if (unique.some((existing) => cardsOverlap(existing, cleaned))) continue;
    unique.push(cleaned);
  }

  return unique;
}

export function assertDistinctCards<T extends CardText>(cards: readonly T[], expectedCount = 4): T[] {
  const sanitized = sanitizeContentCards(cards);
  if (sanitized.length !== expectedCount || sanitized.length !== cards.length) {
    throw new Error(`Card quality check failed: expected ${expectedCount} distinct cards, received ${sanitized.length}`);
  }
  return sanitized;
}

function cardsOverlap(left: CardText, right: CardText) {
  const leftHeading = normalize(left.heading);
  const rightHeading = normalize(right.heading);
  const leftBody = normalize(left.body);
  const rightBody = normalize(right.body);

  if (leftHeading === rightHeading || leftBody === rightBody) return true;

  const leftSentences = sentenceKeys(left.body);
  const rightSentences = sentenceKeys(right.body);
  if (leftSentences.some((sentence) => sentence.length >= 12 && rightSentences.includes(sentence))) return true;

  const leftTokens = tokens(left.body);
  const rightTokens = tokens(right.body);
  if (leftTokens.size < 3 || rightTokens.size < 3) return false;

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const containment = intersection / Math.min(leftTokens.size, rightTokens.size);
  const jaccard = intersection / union;
  return containment >= 0.72 || jaccard >= 0.58;
}

function sentenceKeys(value: string) {
  return value
    .split(/[.!?。]+/)
    .map(normalize)
    .filter(Boolean);
}

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^0-9a-z가-힣]+/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]+/g, "");
}
