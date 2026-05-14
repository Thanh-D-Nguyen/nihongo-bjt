export const DEFAULT_PLAN_SLUG = "free" as const;

export const Quota = {
  flashcard_reviews_per_day: "flashcard_reviews_per_day",
  quiz_bjt_start: "quiz.bjt.start"
} as const;
export type QuotaKey = (typeof Quota)[keyof typeof Quota];

export const EntitlementKey = {
  learner_basic: "learner.basic",
  ads_reduced: "ads.reduced",
  quiz_official_simulation: "quiz.official_simulation"
} as const;

export const FeatureFlagKey = {
  billing_stripe: "billing.stripe.enabled",
  quiz_official_simulation: "quiz.official_simulation.enabled"
} as const;
