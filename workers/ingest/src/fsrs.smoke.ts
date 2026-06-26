import { createEmptyCard, fsrs, Rating, type Grade } from "ts-fsrs";

// Run with: npx tsx workers/ingest/src/fsrs.smoke.ts
const scheduler = fsrs();
let card = createEmptyCard();

const reviewRatings: Grade[] = [Rating.Good, Rating.Hard, Rating.Easy];

for (const rating of reviewRatings) {
  const { card: nextCard } = scheduler.next(card, new Date(), rating);
  console.log({ rating, due: nextCard.due, stability: nextCard.stability, difficulty: nextCard.difficulty });
  card = nextCard;
}
