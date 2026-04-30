# Monetization Entitlement and Quota Enforcement Matrix

Cycle: BJT-CYCLE-PROD-004 (BJT-103)
Date: 2026-04-29

## Scope

This matrix covers learner-facing backend routes with monetization impact (quota, entitlement, paid actions, ads).

## Route Matrix

| Route | Type | Enforcement Type | Backend Enforcement Point | Denial Behavior | Test Evidence | Status |
|---|---|---|---|---|---|---|
| POST /flashcards/reviews/:userFlashcardId | quota | quota key `flashcard_reviews_per_day` | `FlashcardsService.submitReview` -> `QuotaService.consumeFlashcardReviewInTransaction` | throws 403 `{ code: "QUOTA_EXCEEDED", quotaKey, used, limit }` | existing quota service tests + transactional path in service | enforced |
| POST /flashcards/reviews/batch | quota | quota key `flashcard_reviews_per_day` per item | `FlashcardsService.submitReviewBatch` -> `QuotaService.consumeFlashcardReviewInTransaction` | per-item failure result when quota exceeded | covered indirectly via service path; dedicated batch-negative test is gap | enforced (test gap documented) |
| POST /quiz/start | quota | quota key `quiz.bjt.start` | `QuizController.start` -> `QuizService.startSessionWithQuota` (transactional `QuizRepository.startSession` + `QuotaService.consumeQuizStartInTransaction`) | throws 403 and transaction rolls back session creation | `apps/api/src/quiz/quiz.controller.quota-enforcement.test.ts` | enforced in BJT-103 |
| POST /learner/monetization/checkout | paid action | runtime feature gate (`billing.stripe.enabled`) | `LearnerMonetizationController.checkout` -> `RuntimeFeatureGateService.requireEnabled` | throws 503 `feature_disabled` payload | `apps/api/src/monetization/learner-monetization.controller.feature-gate.test.ts` | enforced |
| POST /learner/monetization/paywall | paid surface | runtime feature gate (`billing.stripe.enabled`) | `LearnerMonetizationController.paywall` -> `RuntimeFeatureGateService.requireEnabled` | throws 503 `feature_disabled` payload | covered by controller flow; no dedicated paywall denial test yet | enforced (test gap documented) |
| GET /learner/monetization/ad | entitlement/ads | runtime feature gate (`ads.enabled`) and entitlement check (`ads.reduced`) in provider | `LearnerMonetizationController.ad` + `LocalAdProvider.decide` | throws 503 when ads disabled, or returns `eligible: false` when reduced/no-serve rules apply | existing ads runtime/service tests; learner ad-denied explicit test still limited | enforced (test gap documented) |
| POST /ads/decision | ads runtime | runtime feature gate (`ads.enabled`) | `AdsRuntimeController.decision` | throws 503 `feature_disabled` payload | existing feature-gate tests + runtime service tests | enforced |
| POST /ads/impression | ads runtime write | runtime feature gate (`ads.enabled`) | `AdsRuntimeController.impression` | throws 503 and blocks write | `apps/api/src/monetization/ads/ads-runtime.controller.feature-gate.test.ts` | enforced |
| POST /ads/click | ads runtime write | runtime feature gate (`ads.enabled`) | `AdsRuntimeController.click` | throws 503 and blocks write | `apps/api/src/monetization/ads/ads-runtime.controller.feature-gate.test.ts` | enforced |

## Residual Gaps

- Add explicit negative tests for `POST /flashcards/reviews/batch` quota exceeded branch.
- Add dedicated denial tests for learner `GET /learner/monetization/ad` and `POST /learner/monetization/paywall` when gates are disabled.
- Evaluate entitlement gating for deck/card creation routes if those become premium in plan policy.
