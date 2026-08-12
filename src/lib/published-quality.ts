import { sanitizeContentCards, type CardText } from "./card-quality.ts";

export interface PublishedContentQualityInput {
  citationUrl: string | null;
  cards: readonly CardText[] | null;
  quiz: {
    question: string;
    choices: readonly string[];
    answer: string;
    explanation: string;
  } | null;
}

export function publishedContentQualityFailures(item: PublishedContentQualityInput) {
  const failures: string[] = [];

  if (!isHttpUrl(item.citationUrl)) failures.push("확인 가능한 외부 출처 없음");

  const cards = Array.isArray(item.cards) ? item.cards : [];
  const distinctCards = sanitizeContentCards(cards);
  if (cards.length !== 4 || distinctCards.length !== 4) failures.push("서로 다른 카드 4장 미충족");

  const quiz = item.quiz;
  const choices = Array.isArray(quiz?.choices) ? quiz.choices.map((choice) => choice.trim()).filter(Boolean) : [];
  if (
    !quiz?.question.trim()
    || choices.length < 2
    || new Set(choices).size !== choices.length
    || !quiz.answer.trim()
    || !choices.includes(quiz.answer.trim())
    || !quiz.explanation.trim()
  ) {
    failures.push("완전한 퀴즈 미충족");
  }

  return failures;
}

function isHttpUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
