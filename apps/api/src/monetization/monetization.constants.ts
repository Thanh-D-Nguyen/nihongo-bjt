export const DEFAULT_PLAN_SLUG = "free" as const;

export const Quota = {
  flashcard_reviews_per_day: "flashcard_reviews_per_day",
  quiz_bjt_start: "quiz.bjt.start"
} as const;
export type QuotaKey = (typeof Quota)[keyof typeof Quota];

export const EntitlementKey = {
  learner_basic: "learner.basic",
  ads_reduced: "ads.reduced"
} as const;
