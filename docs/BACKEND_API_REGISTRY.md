# Backend API Registry

## Shared Snapshot (BJT-101)

- Snapshot date: 2026-04-29 JST
- Scope: docs-only convergence against current backend artifacts and route evidence.
- Evidence basis: `docs/openapi.json`, `apps/api/src/openapi/openapi-generation.test.ts`, `docs/CURSOR_BACKEND_API_HANDOFF.md`, `docs/BACKEND_API_PRODUCTION_CHECKLIST.md`
- Confidence: partial (evidence-backed docs reconciliation; no new runtime verification in this task)

Canonical source: v15 Section 10 and 10.1 plus routes currently implemented in `apps/api/src`.  
Rule: add or update this registry before adding controllers.

Legend:

- Status: `complete`, `partial`, `missing`, `legacy`, `internal`, `should-document`, `should-remove`.
- Rate limit: `public-default`, `auth-default`, `admin-default`, `upload`, `webhook`, or `not-wired`.
- Audit: `none`, `admin-write`, `security`, `billing`, `analytics`, `required-missing`.
- Entitlement/quota: `none`, a key, or `required-missing`.
- Feature flag: `none`, a key, or `required-missing`.

## Shared Status Legend

- `complete`: canonical v15 family exists on current backend routes and is usable.
- `partial`: family exists but is incomplete (missing sub-endpoints, DTO/schema depth, tests, or full enforcement).
- `missing`: family is not production-ready in the current backend snapshot.

## Endpoint Family Status (Converged)

| Family | Status | Notes |
|---|---|---|
| `/api/auth/profile` | complete | Canonical profile sync/read/update is implemented. |
| `/api/dictionary/*`, `/api/kanji/*`, `/api/grammar/*`, `/api/examples/*`, `/api/vija/search` | partial | Canonical aliases exist; response/test maturity still incomplete. |
| `/api/bookmarks/*` | partial | Implemented with persistence; list hydration/contract depth still pending. |
| `/api/decks/*`, `/api/review/*` | partial | Canonical aliases implemented; deck CRUD/presets and stronger contracts still pending. |
| `/api/flashcards/cards/:id/images/*` | partial | Upload/link exists; external search/select and hardened media pipeline incomplete. |
| `/api/admin/operations/feature-flags/*` | partial | List/update exists with RBAC + audit; rollout/runtime enforcement still maturing. |
| `/api/admin/operations/kill-switches/*` | partial | List/update exists with RBAC + audit; propagation/runtime enforcement still pending. |
| `/api/admin/operations/dead-letter-queue/*` | partial | List/resolve/discard exists; retry worker integration still pending. |
| `/api/admin/operations/import-staging/errors*` | partial | Real import-error triage exists with DLQ escalation and admin audit; worker replay/import re-drive still pending. |
| `/api/admin/operations/search-rebuild` | partial | Admin-triggered rebuild now repopulates the Meilisearch projection from canonical PostgreSQL content; automated sync/replay evidence still pending. |
| `/api/legal/*`, `/api/consent/*` | partial | Baseline consent status/accept APIs are implemented; broader legal/privacy family is still incomplete. |
| `/api/privacy/*` | partial | Privacy requests exist via learner routes; canonical prefix alignment still pending. |
| `/api/auth/oauth/*`, `/api/referrals/*`, `/api/share/*` | partial | Real flows exist mostly under legacy/adjacent prefixes. |
| `/api/admin/imports/*`, `/api/admin/notifications/*` | missing | Admin APIs not production-ready in current snapshot. |

## Explicit Gate Evidence Links

- OpenAPI snapshot: `docs/openapi.json`
- OpenAPI generation test: `apps/api/src/openapi/openapi-generation.test.ts`
- Backend handoff evidence: `docs/CURSOR_BACKEND_API_HANDOFF.md`
- Production checklist evidence: `docs/BACKEND_API_PRODUCTION_CHECKLIST.md`

Current-truth note: family-level `complete|partial|missing` in the converged table above is authoritative for this snapshot.

Release-decision rule:
- Use only the converged family table in this document for current status decisions.
- Do not use row-level `Status` cells below as current release truth.

Historical tracker note:
- Row-level entries below are archived granular trackers and may contain pre-convergence/intermediate statuses.
- A later dedicated cleanup cycle should normalize row-level entries to the converged family table.

## V15 MVP/API Registry (Archived Pre-Convergence Tracker)

| Method | Path | Module | Controller class | Handler | Request DTO | Response DTO | Auth | Permission | Rate limit | Audit | Entitlement/quota | Feature flag | Swagger tag | Test file | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/auth/register` | Auth | missing | missing | missing | missing | public | n/a | public-default | security | none | legal_consent | Auth | missing | missing |
| POST | `/auth/profile` | Auth | missing | missing | missing | missing | JWT | n/a | auth-default | security | none | none | Auth/Users | missing | missing |
| GET | `/auth/profile` | Auth | missing | missing | n/a | missing | JWT | n/a | auth-default | none | none | none | Auth/Users | missing | missing |
| PUT | `/auth/profile` | Auth | missing | missing | missing | missing | JWT | n/a | auth-default | security | none | none | Auth/Users | missing | missing |
| GET | `/dictionary/search` | Content/Search | missing alias | missing | searchQuerySchema | SearchResult[] | public | n/a | public-default | analytics | none | none | Dictionary | missing | missing |
| GET | `/dictionary/words/:id` | Content | missing | missing | UUID param | LexemeDetailDto | public | n/a | public-default | none | none | none | Dictionary | missing | missing |
| GET | `/kanji` | Content | ContentController legacy | kanji | paginationQuerySchema | Kanji[] | public | n/a | public-default | none | none | none | Kanji | missing | partial |
| GET | `/kanji/search` | Content | ContentController legacy | kanji | paginationQuerySchema | Kanji[] | public | n/a | public-default | none | none | none | Kanji | missing | partial |
| GET | `/kanji/:id` | Content | missing | missing | UUID param | KanjiDetailDto | public | n/a | public-default | none | none | none | Kanji | missing | missing |
| GET | `/grammar` | Content | ContentController legacy | grammar | paginationQuerySchema | GrammarPoint[] | public | n/a | public-default | none | none | none | Grammar | missing | partial |
| GET | `/grammar/:id` | Content | missing | missing | UUID param | GrammarDetailDto | public | n/a | public-default | none | none | none | Grammar | missing | missing |
| GET | `/examples` | Content | ContentController legacy | examples | paginationQuerySchema | ExampleSentence[] | public | n/a | public-default | none | none | none | Content | missing | partial |
| GET | `/examples/by-word/:wordId` | Content | missing | missing | UUID param | ExampleSentence[] | public | n/a | public-default | none | none | none | Content | missing | missing |
| GET | `/examples/search` | Content | ContentController legacy | examples | keyword query | ExampleSentence[] | public | n/a | public-default | none | none | none | Content | missing | partial |
| GET | `/vija/search` | Content | missing | missing | searchQuerySchema | ReverseCandidate[] | public | n/a | public-default | none | none | none | Dictionary | missing | missing |
| GET | `/search` | Search | SearchController | search | searchQuerySchema | SearchResult[] | public | n/a | public-default | none | none | none | Search | missing | partial |
| GET | `/levels/:level` | Levels | missing | missing | level param | missing | public | n/a | public-default | none | none | none | BJT Levels | missing | missing |
| GET | `/levels/:level/vocabulary` | Levels | missing | missing | pagination | missing | public | n/a | public-default | none | none | none | BJT Levels | missing | missing |
| GET | `/levels/:level/kanji` | Levels | missing | missing | pagination | missing | public | n/a | public-default | none | none | none | BJT Levels | missing | missing |
| GET | `/levels/:level/grammar` | Levels | missing | missing | pagination | missing | public | n/a | public-default | none | none | none | BJT Levels | missing | missing |
| GET | `/bookmarks/check/:type/:id` | Bookmarks | missing | missing | params | missing | JWT | n/a | auth-default | none | none | none | Bookmarks | missing | missing |
| POST | `/bookmarks/:type/:id` | Bookmarks | missing | missing | params | missing | JWT | n/a | auth-default | none | none | none | Bookmarks | missing | missing |
| GET | `/bookmarks/words` | Bookmarks | missing | missing | pagination | missing | JWT | n/a | auth-default | none | none | none | Bookmarks | missing | missing |
| GET | `/bookmarks/kanji` | Bookmarks | missing | missing | pagination | missing | JWT | n/a | auth-default | none | none | none | Bookmarks | missing | missing |
| GET | `/bookmarks/grammar` | Bookmarks | missing | missing | pagination | missing | JWT | n/a | auth-default | none | none | none | Bookmarks | missing | missing |
| GET | `/decks` | Flashcards | FlashcardsController legacy | decks | userScopedQuerySchema | Deck[] | JWT | n/a | auth-default | none | none | none | Flashcards | missing | partial |
| POST | `/decks` | Flashcards | FlashcardsController legacy | createDeck | createDeckSchema | Deck | JWT | n/a | auth-default | none | flashcard.deck.create / deck quota required-missing | none | Flashcards | missing | partial |
| GET | `/decks/presets` | Flashcards | missing | missing | pagination | missing | public | n/a | public-default | none | none | none | Flashcards | missing | missing |
| POST | `/decks/presets/:id/clone` | Flashcards | missing | missing | id param | missing | JWT | n/a | auth-default | none | flashcard.deck.create | none | Flashcards | missing | missing |
| GET | `/decks/:id` | Flashcards | missing | missing | id param | missing | JWT | n/a | auth-default | none | none | none | Flashcards | missing | missing |
| PUT | `/decks/:id` | Flashcards | missing | missing | missing | missing | JWT | n/a | auth-default | none | none | none | Flashcards | missing | missing |
| DELETE | `/decks/:id` | Flashcards | missing | missing | id param | missing | JWT | n/a | auth-default | none | none | none | Flashcards | missing | missing |
| GET | `/decks/:deckId/cards` | Flashcards | missing | missing | pagination | missing | JWT | n/a | auth-default | none | none | none | Flashcards | missing | missing |
| POST | `/decks/:deckId/cards` | Flashcards | FlashcardsController legacy | createCardFromContent | createCardFromContentSchema | FlashcardVariant | JWT | n/a | auth-default | none | flashcard.card.create required-missing | none | Flashcards | missing | partial |
| DELETE | `/decks/:deckId/cards/:id` | Flashcards | missing | missing | params | missing | JWT | n/a | auth-default | none | none | none | Flashcards | missing | missing |
| GET | `/review/next` | Flashcards | FlashcardsController legacy | dueReviews | userScopedQuerySchema | DueReview[] | JWT | n/a | auth-default | none | none | none | SRS | missing | partial |
| POST | `/review` | Flashcards | FlashcardsController legacy | submitReview | submitReviewSchema | UserFlashcard | JWT | n/a | auth-default | none | srs.review.daily | none | SRS | packages/shared/src/srs.test.ts | partial |
| GET | `/review/summary` | Flashcards | missing | missing | query | missing | JWT | n/a | auth-default | none | none | none | SRS | missing | missing |
| POST | `/flashcards/cards/:id/images/search` | Media/Flashcards | missing | missing | missing | missing | JWT | n/a | auth-default | none | flashcard.image.auto_search | external_image_search.enabled | Media | missing | missing |
| GET | `/flashcards/cards/:id/images/candidates` | Media/Flashcards | missing | missing | id param | missing | JWT | n/a | auth-default | none | none | external_image_search.enabled | Media | missing | missing |
| POST | `/flashcards/cards/:id/images/select` | Media/Flashcards | missing | missing | missing | missing | JWT | n/a | auth-default | none | none | external_image_search.enabled | Media | missing | missing |
| POST | `/flashcards/cards/:id/images/upload` | Media | MediaController/FlashcardsController | presignUpload/linkCardMedia | presignMediaUploadSchema/linkCardMediaSchema | MediaAsset/Link | JWT | n/a | upload | security | flashcard.image.upload required-missing | external_media_uploads | Media | packages/shared/src/index.test.ts | partial |
| POST | `/media/assets/:assetId/rights-metadata` | Media | MediaController | updateRightsMetadata | updateMediaRightsMetadataSchema | MediaAsset | JWT | n/a | auth-default | none | none | external_media_uploads | Media | apps/api/src/media/media.controller.rights-metadata.test.ts | partial |
| DELETE | `/flashcards/cards/:id/images/:assetId` | Media/Flashcards | missing | missing | params | missing | JWT | n/a | auth-default | none | none | none | Media | missing | missing |
| POST | `/study/sessions` | Study | missing | missing | missing | missing | JWT | n/a | auth-default | analytics | none | none | Study | missing | missing |
| PUT | `/study/sessions/:id` | Study | missing | missing | missing | missing | JWT | n/a | auth-default | analytics | none | none | Study | missing | missing |
| GET | `/study/stats` | Analytics | AnalyticsController | learner | analyticsRangeQuerySchema | metrics | JWT | n/a | auth-default | none | none | none | Study | missing | partial |
| GET | `/study/stats/daily` | Analytics | missing alias | missing | days query | metrics | JWT | n/a | auth-default | none | none | none | Study | missing | missing |
| GET | `/study/streak` | Study | missing | missing | none | missing | JWT | n/a | auth-default | none | none | none | Study | missing | missing |
| GET | `/study/heatmap` | Study | missing | missing | year query | missing | JWT | n/a | auth-default | none | none | none | Study | missing | missing |
| GET | `/progress/dashboard` | Study | missing | missing | none | missing | JWT | n/a | auth-default | none | analytics.advanced.view? | none | Progress | missing | missing |
| GET | `/achievements` | Achievements | missing | missing | none | missing | JWT | n/a | auth-default | none | none | none | Achievements | missing | missing |
| GET | `/achievements/recent` | Achievements | missing | missing | none | missing | JWT | n/a | auth-default | none | none | none | Achievements | missing | missing |
| GET | `/nhk-news` | NHK | missing | missing | pagination | missing | public | n/a | public-default | none | none | nhk_sync.enabled | NHK News | missing | missing |
| GET | `/nhk-news/:articleId/analyze` | NHK | missing | missing | id param | missing | public | n/a | public-default | none | none | nhk_sync.enabled | NHK News | missing | missing |
| POST | `/nhk-news/:articleId/generate-deck` | NHK/Flashcards | missing | missing | id param | missing | JWT | n/a | auth-default | analytics | news.generate_flashcards | nhk_sync.enabled | NHK News | missing | missing |
| GET | `/quiz/templates` | Quiz | QuizController | templates | type query | BjtMockTest[] | JWT currently | n/a | auth-default | none | none | none | BJT Questions | missing | partial |
| GET | `/quiz/templates/:id` | Quiz | QuizController | template | id param | BjtMockTest | JWT currently | n/a | auth-default | none | none | none | BJT Questions | missing | partial |
| POST | `/quiz/start` | Quiz | QuizController | start | startQuizSchema | QuizSession | JWT | n/a | auth-default | analytics | quiz.bjt.start required-missing | none | BJT Questions | packages/shared/src/quiz.test.ts | partial |
| GET | `/quiz/session/:id/question` | Quiz | QuizController | question | id param | BjtQuestion | JWT | n/a | auth-default | none | none | none | BJT Questions | missing | partial |
| POST | `/quiz/session/:id/answer` | Quiz | QuizController | answer | submitQuizAnswerSchema | QuizAnswer | JWT | n/a | auth-default | analytics | none | none | BJT Questions | packages/shared/src/quiz.test.ts | partial |
| GET | `/quiz/session/:id/results` | Quiz | QuizController | results | id param | estimated result | JWT | n/a | auth-default | none | none | none | BJT Questions | packages/shared/src/quiz.test.ts | partial |
| POST | `/quiz/session/:id/abandon` | Quiz | missing | missing | id param | missing | JWT | n/a | auth-default | analytics | none | none | BJT Questions | missing | missing |
| GET | `/quiz/history` | Quiz | missing | missing | pagination | missing | JWT | n/a | auth-default | none | none | none | BJT Questions | missing | missing |
| GET | `/battle/configs` | Battle | missing | missing | none | missing | JWT | n/a | auth-default | none | battle.* | battle.pvp.enabled | Battle | missing | missing |
| GET | `/battle/leaderboard` | Battle | missing | missing | limit query | missing | JWT | n/a | auth-default | none | none | battle.pvp.enabled | Battle | missing | missing |
| GET | `/battle/leaderboard/me` | Battle | missing | missing | none | missing | JWT | n/a | auth-default | none | none | battle.pvp.enabled | Battle | missing | missing |
| GET | `/battle/history` | Battle | BattleController legacy | recent | battleRecentQuerySchema | BattleSession[] | JWT | n/a | auth-default | none | none | battle.pvp.enabled | Battle | missing | partial |
| GET | `/battle/history/:roomCode` | Battle | missing | missing | roomCode | missing | JWT | n/a | auth-default | none | none | battle.pvp.enabled | Battle | missing | missing |
| GET | `/battle/stats` | Battle | missing | missing | none | missing | JWT | n/a | auth-default | none | none | battle.pvp.enabled | Battle | missing | missing |
| GET | `/battle/ranks` | Battle | missing | missing | none | missing | JWT | n/a | auth-default | none | none | battle.pvp.enabled | Battle | missing | missing |

## Admin and Section 10.1 Registry

| Method | Path/Prefix | Module | Controller class | Handler | Request DTO | Response DTO | Auth | Permission | Rate limit | Audit | Entitlement/quota | Feature flag | Swagger tag | Test file | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/admin/dashboard` | Admin | missing exact | missing | query | missing | admin | admin.content.read/viewer.analytics | admin-default | none | none | none | Admin | missing | missing |
| GET | `/admin/users` | Admin | AdminController | users | adminUserListQuerySchema | user list | admin | support.user.read/write | admin-default | none | none | none | Admin Users | missing | partial |
| POST | `/admin/users/invite` | Admin | AdminController | inviteUser | adminUserInviteSchema | invite response DTO | admin | admin.users.create/user.create/support.user.write | admin-default | admin-write | none | none | Admin Users | missing | partial |
| PATCH | `/admin/users/:id/status` | Admin | AdminController | patchUserStatus | adminPatchUserStatusBodySchema | user | admin | support.user.write | admin-default | admin-write | none | none | Admin Users | missing | partial |
| PATCH | `/admin/users/:id/plan` | Admin/Monetization | AdminController | assignUserPlan | adminAssignUserPlanBodySchema | user/subscription | admin | admin.monetization.write | admin-default | admin-write/billing | none | none | Admin Users/Monetization | missing | partial |
| GET/POST/PATCH | `/admin/content*` | Admin Content | AdminController | content/create/patch/status | admin content schemas | content rows | admin | admin.content.read/write | admin-default | admin-write for mutations | none | none | Content | missing | partial |
| GET/POST/PATCH | `/admin/content/words*` | Admin Content | missing alias | missing | same | same | admin | editor.lexeme/admin.content | admin-default | admin-write | none | none | Content | missing | missing |
| GET | `/admin/content/kanji` | Admin Content | generic only | content | adminContentQuerySchema | list | admin | editor.kanji/admin.content | admin-default | none | none | none | Content | missing | partial |
| GET | `/admin/content/grammar` | Admin Content | generic only | content | adminContentQuerySchema | list | admin | editor.grammar/admin.content | admin-default | none | none | none | Content | missing | partial |
| GET/POST | `/admin/presets*` | Presets | missing | missing | missing | missing | admin | admin.content | admin-default | admin-write | none | none | Flashcards | missing | missing |
| GET/POST | `/admin/quiz/templates*` | Quiz Admin | missing | missing | missing | missing | admin | editor.exam | admin-default | admin-write | none | none | BJT Questions | missing | missing |
| GET/POST | `/admin/quiz/questions*` | Quiz Admin | missing | missing | missing | missing | admin | editor.exam | admin-default | admin-write | none | none | BJT Questions | missing | missing |
| GET | `/admin/battle/*` | Battle Admin | missing | missing | missing | missing | admin | admin.content | admin-default | admin-write for mutations | none | battle.pvp.enabled | Battle | missing | missing |
| GET/POST | `/admin/imports*` | Import | missing | missing | missing | missing | admin | operator.import | admin-default | admin-write | none | import.enabled required-missing | Import | missing | missing |
| GET/POST | `/admin/enrichment*` | Enrichment | missing | missing | missing | missing | admin | editor.enrichment | admin-default | admin-write | none | ai.enrichment.enabled | Enrichment | missing | missing |
| GET | `/admin/audit` | Admin | AdminController | audit | limit query | AdminAuditLog[] | admin | viewer.audit | admin-default | none | none | none | Audit | missing | partial |
| GET | `/admin/analytics` | Analytics | AdminAnalyticsController | executive | adminAnalyticsExecutiveQuerySchema | analytics payload | admin | viewer.analytics/admin.analytics.view | admin-default | none | none | none | Analytics | missing | partial |
| GET | `/admin/iam/roles` | IAM | missing | missing | none | missing | admin | iam.manage | admin-default | none | none | none | RBAC | missing | missing |
| `/learning-paths/*` | Learning Paths learner | LearningPath | missing | missing | missing | missing | JWT | n/a | auth-default | none | none | learning_path_engine | Learning Paths | missing | missing |
| `/admin/learning-paths/*` | Learning Paths admin | LearningPath | missing | missing | missing | missing | admin | admin.content/editor.enrichment | admin-default | admin-write | none | learning_path_engine | Learning Paths | missing | missing |
| `/reading-assist/*` | Reading Assist | ReadingAssistController | analyze/preferences/addCard/report/analytics | shared Zod schemas | token/preference/report payloads | JWT | n/a | auth-default | analytics/security | none | reading_assist | Reading Assist | apps/api/src/reading-assist/reading-exam.guard.test.ts | partial |
| `/admin/operations/feature-flags/*` | Operations | missing | missing | missing | missing | admin | iam.manage | admin-default | admin-write | none | none | Operations | missing | missing |
| `/admin/operations/kill-switches/*` | Operations | missing | missing | missing | missing | admin | iam.manage | admin-default | admin-write | none | none | Operations | missing | missing |
| `/admin/operations/dead-letter-queue/*` | Operations | missing | missing | missing | missing | admin | viewer.audit/iam.manage | admin-default | admin-write for retry/discard | none | none | Operations | missing | missing |
| `/admin/operations/import-staging/errors*` | Operations Import | missing | missing | missing | missing | admin | viewer.audit/iam.manage | admin-default | admin-write for dead-letter escalation | none | none | Import Center | missing | missing |
| `/admin/operations/search-rebuild` | Operations Search | missing | missing | missing | missing | admin | iam.manage | admin-default | admin-write | none | none | Search | missing | missing |
| `/admin/content-versions/*` | Operations Content | missing | missing | missing | missing | admin | viewer.audit/admin.content.write | admin-default | admin-write for restore | none | none | Content Versions | missing | missing |
| `/monetization/*` | Monetization learner | LearnerMonetizationController legacy | summary/checkout/ad/paywall | shared Zod schemas | monetization payloads | JWT | n/a | auth-default | billing/analytics | central service | ads.enabled/billing.* | Monetization | apps/api/src/monetization/quota-window.util.test.ts | partial |
| `/billing/*` | Billing | missing | missing | missing | missing | JWT/webhook | n/a | webhook | billing | signature/idempotency required | billing.stripe.enabled | Billing | missing | missing |
| `/admin/monetization/*` | Monetization admin | MonetizationAdminController | many | inline Zod | many | admin | billing.manage perms | admin-default | admin-write/billing | n/a | none | Monetization | partial util tests | partial |
| `/auth/oauth/*` | OAuth | GoogleOAuthController legacy | start/callback | query | redirect/link result | public | n/a | public-default | security | none | social_growth | Auth | apps/api/src/auth/oauth-state.util.test.ts | partial |
| `/referrals/*` | Growth | Learner/PublicGrowth legacy | referral/public ref | shared Zod | referral payloads | JWT/public | n/a | auth/public | analytics | none | social_growth | Social Sharing | missing | partial |
| `/share/*` | Growth | Learner/PublicGrowth legacy | share/public shares | shareCreateSchema | share payload | JWT/public | n/a | auth/public | analytics | none | social_growth | Social Sharing | missing | partial |
| `/legal/*` | Legal | missing | missing | missing | missing | public/JWT | n/a | public/auth | required-missing | none | legal_consent | Legal | missing | missing |
| `/consent/*` | Legal | missing | missing | missing | missing | public/JWT | n/a | public/auth | required-missing | none | legal_consent | Consent | missing | missing |
| `/privacy/*` | Privacy | LearnerController legacy | privacyRequests | privacyRequest schemas | privacy request rows | JWT | n/a | auth-default | security | export.personal_data? | legal_consent | Privacy | missing | partial |
| `/admin/notifications/*` | Notifications | missing | missing | missing | missing | admin | operator.support | admin-default | admin-write | none | notification_delivery | Notifications | missing | missing |

## Existing Routes Not In V15 Section 10

| Method | Path | Module | Controller class | Handler | Classification | Required action |
|---|---|---|---|---|---|---|
| GET | `/health/live` | Health | HealthController | live | should-document | Keep; infrastructure endpoint. |
| GET | `/health/ready` | Health | HealthController | ready | should-document | Keep; add dependency detail if needed. |
| GET | `/health/version` | Health | HealthController | version | should-document | Keep. |
| GET | `/content/*` | Content | ContentController | summary/lexemes/kanji/grammar/examples | legacy | Keep temporarily; add canonical aliases. |
| GET/DELETE/POST | `/auth/me`, `/auth/identities*`, `/auth/link/exchange` | Auth | AuthController | multiple | legacy/should-document | Keep; alias `/auth/profile`. |
| GET | `/auth/google/*` | Auth | GoogleOAuthController | start/callback | legacy | Keep; future alias under `/auth/oauth/google/*`. |
| GET/POST | `/learner/*` | Learner | LearnerController/LearnerMonetizationController/Growth | multiple | should-document | Keep; alias privacy/monetization/referral/share to v15 prefixes over time. |
| GET/POST | `/daily/*` and `/admin/daily/*` | Daily | DailyController/AdminDailyController | multiple | should-document | Keep; product feature outside core Section 10. |
| GET/POST | `/ads/*` and `/admin/ads/*` | Ads | AdsRuntime/AdminController | multiple | should-document | Keep under monetization section. |
| GET | `/public/shares/*`, `/public/referral/*` | Growth | PublicGrowthController | multiple | legacy | Keep; alias to `/share/*`, `/referrals/*`. |

## Implementation Update From Backend Production Pass

| Method | Path | Module | Controller class | Handler | Status after pass | Remaining work |
|---|---|---|---|---|---|---|
| POST | `/auth/profile` | Auth | AuthController | syncProfile | complete | Add richer response DTO examples if contract expands. |
| GET | `/auth/profile` | Auth | AuthController | profile | complete | Add controller auth tests. |
| PUT | `/auth/profile` | Auth | AuthController | updateProfile | complete | Add controller validation tests. |
| GET | `/dictionary/search` | Content | DictionaryController | search | partial | Hydrate exact v15 response DTO and add contract tests. |
| GET | `/dictionary/words/:id` | Content | DictionaryController | detail | partial | Add full detail response DTO. |
| GET | `/kanji`, `/kanji/search`, `/kanji/:id` | Content | KanjiController | list/search/detail | partial | Add response DTOs and level taxonomy. |
| GET | `/grammar`, `/grammar/:id` | Content | GrammarController | list/detail | partial | Add response DTOs. |
| GET | `/examples*` | Content | ExamplesController | list/search/byWord | partial | Add response DTOs. |
| GET | `/vija/search` | Content | VijaController | search | partial | Add response DTO and projection freshness metadata. |
| GET/POST | `/bookmarks/*` | Bookmarks | BookmarksController | check/toggle/list | partial | Hydrate target details in list responses; add integration tests. |
| GET/POST | `/decks*` | Flashcards | DecksController | list/create/detail/cards/addCard | partial | Add update/delete/presets/clone/remove-card. |
| GET/POST | `/review*` | Flashcards | ReviewController | next/submit/summary | partial | Submit now returns persisted review outcome + exam-safe remediation metadata (`reviewEventId`, `remediation.sourceId`, `remediation.sourceType`, `remediation.sourceIdKind`, `remediationPolicy.availability=after_answer`); add idempotency key and richer summary response. |
| GET/PATCH | `/admin/operations/feature-flags*` | Operations | OperationsController | listFlags/updateFlag | partial | Add rollout targeting fields and UI parity. |
| GET/PATCH | `/admin/operations/kill-switches*` | Operations | OperationsController | killSwitches/updateKillSwitch | partial | Add propagation/cache service. |
| GET/PATCH | `/admin/operations/dead-letter-queue*` | Operations | OperationsController | deadLetters/resolveDeadLetter | partial | Add retry API and worker integration. |
| GET/PATCH | `/admin/operations/import-staging/errors*` | Operations | OperationsController | importStagingErrors/escalateImportErrorToDeadLetter | partial | Add worker replay/re-drive path and richer import error DTO coverage. |
| PATCH | `/admin/operations/search-rebuild` | Operations/Search | OperationsController | rebuildSearchProjection | partial | Add scheduled sync/job evidence and deeper integration coverage against live Meilisearch. |
