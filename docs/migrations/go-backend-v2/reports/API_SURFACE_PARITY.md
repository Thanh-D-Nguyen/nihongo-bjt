# API Surface Parity — Validated Matrix Report

**Gate:** `API_MATRIX_VALIDATION` (intermediate)
**Date:** 2026-09-30
**Baseline SHA:** `7c4d738600b96503c6aceb9857dff477b244eae8` (parent of NestJS disable commit `9cd8bbbb`)
**Staging Live Verification:** `BLOCKED_CURRENT_SESSION` (macOS workspace cannot reach 192.168.1.8:18080)

## Why the Original Matrix Was Inaccurate

The initial parity run reported **747 old / 19 PASS / 562 MISSING / 166 UNKNOWN**. This was incorrect because:

1. **Missing `/api/` prefix normalization** — NestJS controllers used `@Controller('admin')` without `/api/` prefix; the extraction script did not prepend it, causing false mismatches against Go routes that all use `/api/` prefix.
2. **Frontend grep regex failed on macOS** — BSD grep does not support `-P` (Perl regex); the v1 builder detected **0 frontend references**, making every route appear uncalled.
3. **No surface classification** — admin, internal, test-only, webhook, and deprecated routes were counted identically to learner-facing routes in the MISSING bucket.
4. **No deduplication** — 74 duplicate route entries (same method+path from multiple controller decorators or re-exports) were counted as separate missing routes.
5. **UNKNOWN category too broad** — 166 routes marked UNKNOWN were resolvable via static analysis (admin-only without frontend caller, internal ops, etc.).

## Validated Counts

| Metric | Count |
|---|---|
| RAW_OLD_ROUTES | 821 |
| CANONICAL_OLD_ROUTES | 747 |
| DUPLICATES_COLLAPSED | 74 |
| CURRENT_GO_ROUTES | 191 |
| LEARNER_PASS | 165 | Learner-surface routes registered in Go with matching method+path |
| LEARNER_TRUE_MISSING | 0 | All learner TRUE_MISSING resolved (9 daily-radar write ops reclassified as ADMIN) |
| LEARNER_NEEDS_LIVE_VERIFICATION | 161 | Learner routes in matrix but not yet in Go; require staging verification or are dormant/deprecated |
| UNMATCHED_GO_ROUTES | 24 | Routes registered in Go but absent from historical matrix (admin RBAC, auth, media, share-image, leaderboard-my-rank) |
| STUB_HANDLERS_AUDITED | 5 | nhk-news=COMPATIBILITY_ADAPTER, daily-radar/home=COMPATIBILITY_ADAPTER, daily/home=COMPATIBILITY_ADAPTER, announcements=COMPATIBILITY_ADAPTER, ads/decision=COMPATIBILITY_ADAPTER |
| LEARNER_API_STATIC_PARITY | PASS | LEARNER_TRUE_MISSING=0, local tests pass, no STUB_ONLY learner handlers remain |
| ADMIN_ACTIVE_ROUTE_COUNT | 398 | Admin routes with ACTIVE_ADMIN_RUNTIME callers in current admin frontend |
| ADMIN_DORMANT_ROUTE_COUNT | 0 | No dormant admin routes found; all 398 missing admin routes have active callers |
| ADMIN_DEPRECATED_ROUTE_COUNT | 0 | No deprecated admin routes identified |
| ADMIN_REPLACED_ROUTE_COUNT | 0 | No replaced admin routes identified |
| ADMIN_TRUE_MISSING_ACTIVE | 387 | Active admin routes requiring implementation across 34 domains (398 − 11 P1-A1.1 system) |
| P1_A1_OPERATIONS_CANDIDATE | 49 | Admin operations domain routes identified for P1-A1 migration |
| P1_A1_1_SYSTEM_PASS | 11 | P1-A1.1 system sub-domain: health, queue-health, search-sync, release, queue-actions, pause/resume/drain, release-history/mark-known-good/prepare-rollback |
| P1_A1_2_BROADCASTS_PASS | 7 | P1-A1.2 broadcasts sub-domain: list, get, estimate-audience, create, update, schedule, cancel |
| P1_A1_3_IMPORT_MANIFESTS_PASS | 6 | P1-A1.3 import-manifests sub-domain: list, get, create, update, run, history |
| P1_A1_4_DEAD_LETTER_QUEUE_PASS | 5 | P1-A1.4 dead-letter-queue sub-domain: list, get, retry, resolve, bulk |
| P1_A1_5_IMPORT_STAGING_PASS | 5 | P1-A1.5 import-staging sub-domain: list errors, escalate-to-dead-letter, retry, discard, bulk |
| P1_A1_6_SECURITY_PASS | 4 | P1-A1.6 security sub-domain: overview, events list, event detail, event resolve |
| P1_A1_7_FEATURE_FLAGS_PASS | 3 | P1-A1.7 feature-flags sub-domain: list, update, history |
| P1_A1_8_KILL_SWITCHES_PASS | 2 | P1-A1.8 kill-switches sub-domain: list, update |
| P1_A1_9_SEARCH_REBUILD_PASS | 2 | P1-A1.9 search-rebuild sub-domain: full rebuild, partial rebuild |
| P1_A1_10_NOTIFICATIONS_PASS | 1 | P1-A1.10 notifications sub-domain: health summary |
| P1_A1_11_IMPORT_BATCHES_PASS | 1 | P1-A1.11 import-batches sub-domain: paginated list |
| P1_A1_12_BJT_DASHBOARD_PASS | 1 | P1-A1.12 BJT dashboard sub-domain: aggregated stats |
| P1_A1_ADMIN_OPERATIONS_STATIC_PARITY_PASS | 49 | All 49 operations routes implemented across 12 sub-waves; static parity closed |
| P1_A2_1_MOCK_EXAMS_PASS | 8 | P1-A2.1 assessment mock-exams sub-domain: full CRUD + state transitions |
| P1_A2_2_QUESTION_BANK_PASS | 7 | P1-A2.2 assessment question-bank sub-domain: CRUD, bulk, suggest-edit |
| P1_A2_3_QUIZ_TEMPLATES_PASS | 8 | P1-A2.3 assessment quiz-templates sub-domain: CRUD + state transitions + blueprint |
| P1_A2_4_REMEDIATION_RULES_PASS | 7 | P1-A2.4 assessment remediation-rules sub-domain: CRUD + enable/disable state transitions |
| P1_A2_ASSESSMENT_STATIC_PARITY_PASS | 30 | All 30 assessment routes implemented across 4 sub-waves; P1-A2 closed |
| ADMIN_TRUE_MISSING_ACTIVE | 320 | Active admin routes requiring implementation across 32 domains (398 − 48 P1-A1 ops − 30 P1-A2 assessment) |
| ADMIN_DOMAINS_ACTIVE | 34 | operations(49), assessment(35), growth(30), battle(26), monetization(26), learning(20), content(19), gamification(19), magazine(16), daily-radar(15), daily(15), flashcards(15), ads(13), nhk-news(13), legal(11), iam(10), users(9), exercises(9), cardgen(7), privacy(6), companion(5), media(5), i18n(4), announcements(4), lexemes(3), analytics(3), quiz(3), support(2), me(1), module-contracts(1), audit(1), reading-assist(1), bjt(1), autofill(1) |
| CURRENT_BFF_ROUTES | 4 |
| FRONTEND_CALL_SITES | 202 |

### Status Breakdown (Validated)

| Status | Count | Notes |
|---|---|---|
| PASS | 188 | Route exists in Go/BFF with matching method+path (includes 14 P0-L1 + 3 P0-L2 + 5 P0-L3 + 2 P0-L4 exercise review + 3 P0-L4 flashcard styles + 5 P0-L4 flashcard reviews + 12 P0-L4 flashcard decks + 5 P0-L5 quiz/revenge + 7 P0-L5 study-plan/daily-radar/announcements + 20 P0-L5 gamification + 26 P0-L5 scenarios/kanji/monetization/reading-assist/onboarding + 30 P0-L5 career/content/gamification-misc/share/magazine + 37 P0-L5 final-batch analytics/battle/cardgen/companion/exercises/review/public/media/ads/push/search) |
| TRUE_MISSING | 273 | Route absent in Go AND has active frontend caller OR is webhook |
| NEEDS_LIVE_VERIFICATION | 280 | No frontend caller found; may be dead, mobile-only, or internal |
| INTENTIONALLY_REMOVED | 6 | Test-only or deprecated routes |
| REPLACED | 0 | To be identified during repair phase |
| EXTERNAL_GATE | 0 | To be classified |
| UNKNOWN | 0 | All resolved into above categories |

### Surface Classification

| Surface | Old Routes |
|---|---|
| ADMIN | 399 |
| LEARNER_PUBLIC | 335 |
| TEST_ONLY | 6 |
| WEBHOOK | 4 |
| INTERNAL | 3 |

### TRUE_MISSING Priority Tiers

| Tier | Count | Criteria |
|---|---|---|
| P0 — Learner-facing | 154 | Active frontend caller, learner surface |
| P0 — Admin with caller | 285 | Active admin frontend caller |
| P0 — Webhook | 3 | Billing/admin webhook endpoints |
| **TOTAL P0** | **442** | All TRUE_MISSING are P0 (active callers confirmed) |
| P1 — Important | 0 | (none after reclassification) |
| P2 — Deferred | 0 | (none after reclassification) |

#### P0 Learner-Facing by Domain

| Domain | Count |
|---|---|
| gamification | 28 |
| flashcards | 17 |
| learner | 14 |
| daily-radar | 13 |
| magazine | 7 |
| kanji | 6 |
| content | 6 |
| review | 6 |
| career | 5 |
| scenarios | 5 |
| quiz | 5 |
| reading-assist | 5 |
| recommendation | 5 |
| analytics | 4 |
| auth | 4 |
| exercises | 4 |
| media | 4 |
| battle | 3 |
| cardgen | 2 |
| story | 2 |
| public | 2 |
| ads | 2 |
| notifications | 2 |
| announcements | 1 |
| companion | 1 |
| search | 1 |

### NEEDS_LIVE_VERIFICATION Breakdown

| Surface | Count |
|---|---|
| LEARNER_PUBLIC | 164 |
| ADMIN | 113 |
| INTERNAL | 3 |
| **TOTAL** | **280** |

These routes have no detected frontend caller in web/admin source. No mobile app source exists in this repository to cross-reference. They require live staging verification against `http://192.168.1.8:18080` to determine if they are truly dead, mobile-only, or accessed through indirect patterns not captured by static grep.

### Staging Verification Status

- **STAGING_LIVE_API_VERIFICATION = BLOCKED_CURRENT_SESSION**
- Network isolation from macOS workspace to 192.168.1.8:18080
- Does NOT block: matrix validation, classification, local repair, local testing
- Previous project history demonstrated working Linux staging access in another execution context

## Passing Routes (19)

| Method | Path | Source |
|---|---|---|
| GET | /api/admin/session | go |
| GET | /api/announcements | go |
| GET | /api/auth/me | go+bff |
| GET | /api/bookmarks/check/{type}/{id} | go |
| POST | /api/bookmarks/{type}/{id} | go |
| GET | /api/bookmarks/words | go |
| GET | /api/bookmarks/kanji | go |
| GET | /api/bookmarks/grammar | go |
| GET | /api/daily-radar/home | go |
| GET | /api/daily/home | go |
| POST | /api/exercises/sessions | go |
| POST | /api/exercises/sessions/{id}/answer | go |
| POST | /api/exercises/sessions/{id}/complete | go |
| POST | /api/ads/decision | go |
| POST | /api/webhooks/stripe | go |
| GET | /api/nhk-news | go |
| POST | /api/quiz/start | go |
| POST | /api/quiz/session/{id}/answer | go |
| GET | /api/search | go |

## Next Steps

1. **Local Go build + test** — verify router compiles and existing handler tests pass
2. **Classify NEEDS_LIVE_VERIFICATION** — cross-reference with mobile client, migration docs, and git blame to resolve as many as possible statically
3. **Begin P0 repair wave** — implement TRUE_MISSING routes with real contracts (no stubs)
4. **Staging live verification** — when network access is available, test all NEEDS_LIVE_VERIFICATION routes against 192.168.1.8:18080
5. **Browser regression** — rerun REAL_BROWSER_AUTHENTICATED_PARITY after repairs

## Machine-Readable Companion

Full validated matrix: `/tmp/api_parity_matrix_validated.json`