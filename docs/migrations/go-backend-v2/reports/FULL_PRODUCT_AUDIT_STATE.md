# Full Product Audit State

JSON is canonical.

- Phase: SCREEN_AUDIT
- Last completed: Wave 12 — four targeted API contracts PASS; expired privacy export cleanup and XP-only gamification rewards verified.
- Next item: learner:/:locale/share/:token (audit paused for requested Oracle release).
- Current release worktree: fresh verification from origin/main; original audit reading fix 4c061281. Historical reload attribution waived by user; current required states PASS.
- Screens: 71 PASS, 2 FAIL, 90 remaining of 163
- APIs: 630 PASS, 0 FAIL, 3 external blockers of 633
- Defects: 414 found, 407 fixed, 7 remaining
- Runtime stability: PASS at 0/10/30/60 after rebuilding the Go API and applying three additive pending migrations; API, Learner, Admin, Caddy, PostgreSQL, Redis and Meilisearch remained healthy.
- AUDIT-100/101 lifecycle frontend suite evidence remains unresolved: tests/typecheck/build/debt-ratchet passed, but AUDIT-100 harness recorded fingerprint drift and AUDIT-101 suite accounting is still missing.

AUDIT-102 closed VERIFIED: linked-account settings now renders session-scoped empty/connected/error states. Visible 390x844 unlink returned 204 and removed only the disposable fixture; a fresh anonymous browser was redirected to localized login. Go 757/757 including race, frontend 436/436, typecheck, debt ratchet, production build and independent review passed.

AUDIT-103 closed VERIFIED: Appearance persists authenticated choices through the session/Origin-aware BFF, preserves local choices during auth restoration, and serializes saves. Visible mobile browser confirmed PUT 200 and refresh persistence, anonymous local-only behavior, and no browser errors. Commit: bcbafc63.

AUDIT-104 closed VERIFIED: linked-account management removed the retired OAuth CTA/exchange path and restored the 48px mobile unlink target. Browser checks: anonymous redirect, authenticated UI, visible unlink persistence, localized copy, and 390x844; harness 263/263 and frontend 448/448; commit bf2a8829.
AUDIT-105 opened: sibling /settings/accounts still exposes retired OAuth start/link-code handling; visible click returned 404.

AUDIT-105 closed VERIFIED: /settings/accounts no longer links to retired OAuth start/exchange. Visible VI/EN/JA 390x844 checks, anonymous redirect, authenticated session refresh, 48px unlink, fixture DELETE 204 then GET 200. Harness 263/263, frontend 451/451, typecheck/build, independent review passed; commit e5a98655.

AUDIT-106 closed VERIFIED: learner Scenario detail now uses canonical active data, hides answer keys until submission, validates and persists server-scored attempts, and redirects anonymous users. Visible Chrome completed 3/3 (30/30), confirmed attempts after refresh, tested anonymous 401 behavior and 390x844 layout. Four API method+paths passed individually. Go 760, frontend 455, harness 263; commit 9b010ceb. Next: learner:/:locale/scenarios.


Wave 2 checkpoint: 20 monetization API method+paths individually covered by three exact targeted Go/PostgreSQL contract tests; all PASS. Full Go suite is intentionally deferred to after remaining APIs and its earlier seven-test failure record is retained. Wave 3 is active; see tasks/AUDIT-159.json.

Wave 3 partial: three NHK endpoints currently FAIL based on focused PostgreSQL router evidence; middleware/schema/caller fixes are underway. Monetization and Operations API work remains in progress.

Wave 3 checkpoint: all 20 route tests passed through targeted PostgreSQL real-router suites. Also fixed /summary RBAC and Admin broadcast collection create method, with one focused Vitest passing. The NHK Easy upstream returned HTTP 401 live; local refresh success/failure contract is verified. Full suite remains deferred.

Wave 4 partial checkpoint: import manifest run and import-staging bulk/retry/discard are currently FAIL because the handlers audit the request but do not persist a domain action or dispatch a worker. Repairs are in progress.

Wave 4 progress: 16/20 PASS by focused PostgreSQL tests. Four import operations remain FAIL pending durable side effects and fresh-database retest.

Wave 4 final checkpoint: 17/20 APIs PASS and 3 remain FAIL because no safe import executor exists. Requests are durable and exposed as queued with processorAvailable=false; no import completion is claimed.

Wave 10 checkpoint: all 20 METHOD+PATH APIs passed focused PostgreSQL router tests. API totals 615 PASS, 9 FAIL, 8 remaining of 632; next item GET /api/search/suggest. Full suite deferred until all API items and known failures have been addressed.

Wave 10 checkpoint: all 20 METHOD+PATH APIs passed targeted PostgreSQL router tests. API totals 615 PASS, 9 FAIL, 8 remaining of 632; next item GET /api/search/suggest. Full suite deferred until all API entries and known failures are addressed.

Wave 12 complete: all four focused PostgreSQL API tests PASS, full `go test ./...` PASS, Prisma validation PASS, web/Admin typechecks PASS. Three APIs remain external-blocked; the local screen audit continues.
