export const DEFAULT_PLAN_SLUG = "free" as const;

export const Quota = {
  flashcard_reviews_per_day: "flashcard_reviews_per_day",
  flashcard_gen_per_day: "flashcard_gen_per_day",
  image_search_daily: "image_search_daily",
  quiz_bjt_start: "quiz.bjt.start",
  deck_clones_per_month: "deck_clones_per_month",
  deck_public_shares: "deck_public_shares"
} as const;
export type QuotaKey = (typeof Quota)[keyof typeof Quota];

export const EntitlementKey = {
  learner_basic: "learner.basic",
  ads_reduced: "ads.reduced",
  flashcard_adaptive_gen: "flashcard.adaptive_gen",
  flashcard_suggest_cards: "flashcard.suggest_cards",
  flashcard_premium_styles: "flashcard.premium_styles",
  quiz_official_simulation: "quiz.official_simulation"
} as const;

export const FeatureFlagKey = {
  billing_stripe: "billing.stripe.enabled",
  monetization_enforcement: "monetization.enforcement",
  quiz_official_simulation: "quiz.official_simulation.enabled"
} as const;
