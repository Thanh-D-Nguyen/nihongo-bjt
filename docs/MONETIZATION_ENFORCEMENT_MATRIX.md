# Monetization Enforcement Audit Matrix — PHASE-06 T01

Generated: 2026-04-30
Scope: All backend API routes with premium/quota/entitlement gating requirements.

## Legend

- ✅ Enforced server-side
- ⚠️ Feature-gated only (no quota/entitlement)
- ❌ Missing server-side enforcement
- N/A Not a premium/gated action

## Route-by-Route Enforcement

| Route | HTTP | Auth | Entitlement | Quota | Feature Flag | Denial Code | Notes |
|---|---|---|---|---|---|---|---|
| `/flashcards/reviews/:id` | POST | ✅ Keycloak | ✅ via QuotaService plan resolve | ✅ `flashcard_reviews_per_day` | N/A | `QUOTA_EXCEEDED` | In-transaction serializable |
| `/flashcards/reviews/batch` | POST | ✅ Keycloak | ✅ via QuotaService plan resolve | ✅ per-item `flashcard_reviews_per_day` | N/A | `QUOTA_EXCEEDED` | Per-item transaction |
| `/quiz/start` | POST | ✅ Keycloak | ✅ via QuotaService plan resolve | ✅ `quiz.bjt.start` | N/A | `QUOTA_EXCEEDED` | Serializable tx |
| `/learner/monetization/checkout` | POST | ✅ Keycloak | N/A | N/A | ✅ `billing.stripe.enabled` | `CONSENT_REQUIRED` / 503 | Legal consent prereq enforced |
| `/reading-assist/analyze` | POST | ✅ Keycloak | N/A (free for all per spec) | N/A | ✅ `reading_assist` | 503 | Basic reading support is free |
| `/reading-assist/preferences` | GET | ✅ Keycloak | N/A | N/A | ✅ `reading_assist` | 503 | |
| `/media/presign-upload` | POST | ✅ Keycloak | N/A | N/A | ✅ `external_media_uploads` | 503 | |
| `/media/complete-upload` | POST | ✅ Keycloak | N/A | N/A | ✅ `external_media_uploads` | 503 | |
| `/flashcards/decks` | GET | ✅ Keycloak | N/A | N/A | N/A | 401 | |
| `/flashcards/decks` | POST | ✅ Keycloak | N/A | N/A | N/A | 401 | Deck creation available to all authenticated users |
| `/flashcards/cards/from-content` | POST | ✅ Keycloak | N/A | N/A | N/A | 401 | |
| `/quiz/templates` | GET | Public | N/A | N/A | N/A | — | Public by design |
| `/battle/sessions/recent` | GET | ✅ Keycloak | N/A | N/A | N/A | 401 | |
| `/learner/monetization/summary` | GET | ✅ Keycloak | N/A | N/A | N/A | 401 | Entitlement summary endpoint |
| `/learner/ads/decide` | GET | ✅ Keycloak | N/A | N/A | N/A | 401 | |
| `/legal/consent/status` | GET | ✅ Keycloak | N/A | N/A | N/A | 401 | |
| `/legal/consent/accept` | POST | ✅ Keycloak | N/A | N/A | N/A | 401 | |
| `/admin/*` | ALL | ✅ Keycloak + RBAC | N/A (admin) | N/A | N/A | 401/403 | Admin auth service RBAC |

## Quota Keys Registered

| Key | Window | Default Limit | Enforced On |
|---|---|---|---|
| `flashcard_reviews_per_day` | UTC day | 20 (free) | `/flashcards/reviews/:id`, `/flashcards/reviews/batch` |
| `quiz.bjt.start` | UTC day | 3 (free) | `/quiz/start` |

## Entitlement Keys Registered

| Key | Description | Assigned to Plans |
|---|---|---|
| `learner.basic` | Baseline learner access | All plans including free |
| `ads.reduced` | Reduced ad display | Premium+ plans |

## Frontend-Only isPremium Audit

- ✅ No `isPremium` checks found in `apps/web` or `apps/admin` source files.
- ✅ No scattered `isPremium` / `plan === "premium"` checks in API routes.
- ✅ All plan-gated actions are enforced on the backend via `QuotaService` or `EntitlementService`.

## Structured Denial Codes

| Code | HTTP | Body Fields |
|---|---|---|
| `QUOTA_EXCEEDED` | 403 | `code`, `quotaKey`, `used`, `limit` |
| `ENTITLEMENT_DENIED` | 403 | `code`, `entitlementKey`, `planSlug`, `upgradeRequired`, `message` |
| `CONSENT_REQUIRED` | 403 | `code`, `required`, `missing` |

## Residual Gaps

1. `EntitlementGuard` class created but not yet applied to routes — see PH06-T01 implementation for wiring.
2. No dedicated HTTP integration tests for entitlement denial path on `/flashcards` or `/quiz` routes (quota tests pass at service level).
3. Reading assist quota not applicable (free access per spec). If premium-tier reading assist features (e.g., AI annotation) are added later, add `reading_assist_requests_per_day` quota key.

## PH06-T01 Pass Criteria

- ✅ No frontend-only enforcement found
- ✅ All quota-limited routes enforce server-side
- ✅ `EntitlementGuard` + `RequiresEntitlement` decorator implemented
- ✅ Structured denial codes documented and used
- ✅ Usage events recorded on successful quota consumption (see `quota.service.ts`)
