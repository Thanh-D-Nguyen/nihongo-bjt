# Latest release handoff — 2026-10-15

Audit paused for explicit user request: release final source to main and Oracle. Reading current required states PASS; further historical reload tracing waived by user, historical cause unproven. Screens 163 = 71 PASS + 2 FAIL + 90 REMAINING. APIs 633 = 630 PASS + 0 FAIL + 3 EXTERNAL_BLOCKED. Next audit route: `learner:/:locale/share/:token`. RELEASE-2 freshly verifies consolidated source; archived task attempts are historical only.

# Handoff — next local product audit

## Latest checkpoint — AUDIT-149 (2026-10-14)

**Code HEAD:** `d9e9cd25` (AUDIT-149). AUDIT-150 documents this checkpoint; its commit is recorded in Git history.

**AUDIT-149** (`d9e9cd25`) closed VERIFIED. The Admin Postcards preview called POST /api/admin/growth/share-template/preview, which had no Go route (404). The route now renders the postcard as SVG (`base64Svg`, `image/svg+xml`, 1200×630) behind admin.growth.read with trusted-origin CSRF. It validates headline/sub (1–200), kind, hex brand colors, badgeKey and the exact pattern options the form offers. Text is escaped and XML-illegal control characters are removed, so the SVG stays well-formed. Nothing is persisted and no audit row is written; the legacy NestJS audit row is an explicit parity decision. Decision recorded with the user: SVG output with no new dependency (PNG needs a rasterizer and font). Gates: Go 956/956 with zero skips; frontend 469/469 with zero new lint debt and production build; headed 390×844 browser POST 200 with SVG rendered and no errors; sensitivity check (removing the sakura pattern fails the pattern test with the declared text); independent fresh-session review approved after three rounds. Review found a real mismatch (sakura option rejected by the server), now fixed.

**Counts:** 377/628 APIs PASS, 0 FAIL, 251 remaining (the preview row was added to the inventory as an independently tested METHOD+PATH). 68/163 screens PASS, 2 FAIL, 93 remaining. Postcards is REMAINING: anonymous PASS (return path re-verified), authenticated partial (create, list and preview pass; edit, publish and archive pending), mobile PASS. Defects: 336 found, 332 fixed, 4 remain (ADMIN-BATTLE-ANALYTICS-TIMECOLUMN-001 FOUND; BATTLE-REALTIME-SOCKETIO-GO-PROTOCOL-001, MEDIA-LEGACY-ANNOUNCEMENT-URL-001, SEARCH-SAVED-ENTRY-001 OPEN).

**NEXT_ITEM:** GET /api/admin/growth/postcards/{id}, then PATCH /api/admin/growth/postcards/{id}, POST /api/admin/growth/postcards/{id}/archive and POST /api/admin/growth/postcards/{id}/publish. After that, complete the Postcards authenticated state (edit, publish, archive) in the headed browser, then re-evaluate the screen.

**Environment notes (unchanged from AUDIT-146):** verify needs `TEST_REDIS_URL` (disposable `redis:7`); `with-test-db.sh` does not provision Redis. CodeGraph writes can cause a transient `TOOL_FAILURE`; re-run verify. Do not edit owned files while verify or a browser gate runs. After any Go change, restart the local stack (SIGTERM the `scripts/local-audit-up.mjs` manager, then start it again) because the live API keeps the old binary. Harness decisions from an unrelated probe can appear as "external mutation" when a probe POSTs to a local route; avoid mutating probes outside the gates.

## Latest checkpoint — AUDIT-146 and AUDIT-147 (2026-10-14)

**Code HEAD:** `2b33ed3f` (AUDIT-147). AUDIT-148 documents this checkpoint; its commit is recorded in Git history.

**AUDIT-146** (`f6355eab`) closed VERIFIED. Ten Admin growth METHOD+PATH APIs now PASS individually: campaign audience-estimate, detail, PATCH, activate, archive, duplicate, end, schedule, postcard list and postcard create. Campaign writes require growth.manage and trusted-origin CSRF, run in locked transactions with actor audit, and roll back when the audit insert fails. Gates: Go 950/950 with race and ARM64 build and zero skips (run with TEST_REDIS_URL so the Redis-gated tests execute); frontend 467/467 with zero new lint debt and the production build; headed Chromium 390x844 Admin E2E with every campaign and postcard request at 200/201 and no console or page errors; independent fresh-session review APPROVE. Next 16.4.0 clears the three critical advisories (pnpm audit: 0 next and 0 critical advisories).

**AUDIT-147** (`2b33ed3f`) closed VERIFIED. The Admin session gate built returnTo without the /admin basePath, so an anonymous deep link returned after sign-in into the learner app. RED then GREEN in the gate unit test; headed browser run from an anonymous deep link returned to /admin/vi/growth/campaigns. Lint-only fix to the AUDIT-146 browser script in `0de447ed` (required to clear the frontend ratchet once that file was tracked).

**Counts:** 376/627 APIs PASS, 0 FAIL, 251 remaining. 68/163 screens PASS, 3 FAIL, 92 remaining. Defects: 336 found, 331 fixed, 5 remain (4 previous: ADMIN-BATTLE-ANALYTICS-TIMECOLUMN-001 FOUND, BATTLE-REALTIME-SOCKETIO-GO-PROTOCOL-001, MEDIA-LEGACY-ANNOUNCEMENT-URL-001, SEARCH-SAVED-ENTRY-001 OPEN; plus ADMIN-POSTCARD-SHARE-TEMPLATE-PREVIEW-ROUTE-001 OPEN). Note: the defects array in FULL_PRODUCT_AUDIT_STATE.json holds 327 records because earlier audits did not log every counted defect; the counters are the ledger.

**Postcards screen is FAIL:** the preview action POSTs to `/api/admin/growth/share-template/preview`, and no Go route registers it.

**NEXT_ITEM:** Add an inventory row for POST /api/admin/growth/share-template/preview (verified active caller), implement it with growth read RBAC and a privacy-safe preview contract, retest the Postcards screen headed at 390x844 and on desktop, then continue with GET /api/admin/growth/postcards/{id}, PATCH /api/admin/growth/postcards/{id}, POST /api/admin/growth/postcards/{id}/archive and POST /api/admin/growth/postcards/{id}/publish.

**Environment notes:**
- `pnpm quality verify` needs `TEST_REDIS_URL` for the Redis-gated Go tests. `with-test-db.sh` provisions only Postgres, so run a disposable `redis:7` container and export the URL, otherwise two tests skip and the suite fails.
- The CodeGraph MCP server rewrites `.codegraph/codegraph.db` continuously, which can make a verify run fail with a transient `TOOL_FAILURE` (git hash-object on `codegraph.lock`). Re-run the verify.
- Production builds and the running `next dev` rewrite `apps/*/next-env.d.ts` and `tsconfig.tsbuildinfo`. The fingerprint changes after a build, so run the browser gate after the verify.
- Login `returnTo` now carries the /admin prefix; keep it that way when adding Admin deep links.

**Open items outside this wave:** Learner battle realtime protocol (Socket.IO legacy vs Go WebSocket), legacy announcement media URL, and Search Saved deep link remain open (see the previous checkpoints below).

Latest checkpoint: AUDIT-145 code committed as d4185812. Five Admin METHOD+PATH APIs and the Growth Campaigns authenticated/mobile screen states passed individually. Go 939/939, frontend 467/467 (0 new lint debt), headed Chromium at 390x844, runtime 0/10/30/60 and independent review APPROVE.

Counts: 68/163 screens PASS, 2 FAIL, 93 remaining; 366/627 APIs PASS, 0 FAIL, 261 remaining; 327 defects found, 323 fixed, 4 remain.

**NEXT_ITEM:** GET /api/admin/growth/campaigns/audience-estimate. Continue with the next five METHOD+PATH entries in source inventory order. Gamification anonymous screen state remains pending; Growth Campaigns anonymous redirect, authenticated, and mobile states all PASS.

Runtime startup: node scripts/local-audit-up.mjs; last stability run passed 0/10/30/60 seconds.

## Latest checkpoint — AUDIT-136

Admin login screen and `POST /api/admin/login` individually PASS. Visible 390×844 real form verified empty validation, wrong-password 401, valid Argon2id login 200, HttpOnly session and refresh persistence. Disposable actor/session removed; Go 847/847; browser E2E and independent review APPROVE. Commit `d4ea2e93`. Counts: 67/163 screens PASS (2 FAIL, 94 remaining), 327/627 APIs PASS (0 FAIL, 300 remaining), 291 defects found, 287 fixed, 4 remain.

## Previous checkpoint — AUDIT-134

Admin Legal Retention page and GET API pass anonymous/roleless/authorized coverage; the route now enforces legal read/write/admin or iam.manage, and OpenAPI matches. Visible 390x844 browser rendered seven rows with no page overflow or window errors; table has internal horizontal scrolling. Temporary actors, role, sessions and credentials were removed. Go 846/846, frontend 466/466, browser E2E PASS, fresh AUTH_SECURITY review APPROVE. Code commit `52dd6076`. Counts: 66/163 screens PASS (2 FAIL, 95 remaining), 326/627 APIs PASS (0 FAIL, 301 remaining), 291 defects found, 287 fixed, 4 remain.

## Previous checkpoint — AUDIT-132

The Admin Cookie & Tracker screen and `GET /api/admin/legal/cookie-categories` passed as separate screen/API records. The Go route now requires any of `admin.legal.read`, `admin.legal.write`, `legal.admin`, or `iam.manage`, matching OpenAPI and the current menu permission. Visible headed Chrome at 390×844 verified anonymous redirect/401, roleless Admin 403 with localized error, and authorized Admin 200 with all four category items. The HttpOnly session was used; no overflow or window errors. Disposable actor/role/credential fixtures were removed. Go 845/845 incl. race/vet/ARM64; runtime stable 0/10/30/60; independent review APPROVE. Code commit `a6580e19`.

## Latest checkpoint — AUDIT-128 / AUDIT-129

The learner flashcard-style picker now reads Admin-managed `learning.flashcard_style` rows and receives its expected `{activeSlug, styles}` contract. Visible headed 390x844 browser used real learner registration/login forms; the picker loaded two disposable styles, selected each through UI PUT requests, and retained the latest choice after refresh. The exact learner/style fixtures were removed; the separate disposable AUDIT-131 user was deleted and cleanup asserted. Go 844/844, frontend 466/466, harness 263/263; independent review APPROVE. Commits: 8949a238 (API/store/picker contract) and 228ec7f3 (lint debt). All three learner style method+path APIs are PASS; GET `/api/flashcards/styles/active` returned 200 `{slug:null,config:{}}` and matched list activeSlug in the authenticated headed browser.

## Latest checkpoint — AUDIT-126

The Admin flashcard styles screen and all six active method+path APIs passed individually. Visible headed 390x844 UI exercised create (201), list (200), update (200), activate/archive (200); authenticated same-origin detail and adoption GETs returned correct contracts. Anonymous navigation redirected and same-origin GET/POST returned 401. Go RBAC denied roleless Admin on all six routes; mutation CSRF and audit rollback covered by PostgreSQL tests. Fixed the profile-based adoption query, style tier/status and theme validation, RBAC/CSRF, atomic audit writes, mixed-case gradient parity, and mobile table overflow. Runtime stable 0/10/30/60; Go 833/833, frontend 460/460, independent review APPROVE. Temporary styles and read permission removed. Commit: e3b2f23f.

Open follow-up found during review: learner style APIs query content.flashcard_style while Admin manages learning.flashcard_style. Next task aligns learner reads/selection with canonical data, then tests learner style GET/active GET/PUT.

## Where things stand

- APIs: 323 PASS, 0 FAIL, 304 remaining of 627 (frontend-only callers still need explicit inventory coverage).
- Screens: 64 PASS, 2 FAIL, 97 remaining of 163.
- Defects: 289 found, 285 fixed, 4 remain open/found.
- Closed tasks this session: AUDIT-107 (scenario list), AUDIT-108 (in-app notification feed), AUDIT-109 (quiz study-plan test date), AUDIT-110 (preferences save), AUDIT-111 (subscription plan summary), AUDIT-112 (subscription page guard), AUDIT-113 (cancel at period end), AUDIT-114 (privacy-filtered public profile API/screen), AUDIT-115 (subscription expiry eligibility), AUDIT-116 (notification preference timestamps), AUDIT-119 (presence WebSocket audit), AUDIT-120 (presence wiring/reconnect-race fix), AUDIT-121 (Daily Radar card duplication endpoint), AUDIT-122 (Daily Radar publish, module detail and archive APIs).
- Screens now PASS: `learner:/:locale/settings/notifications`, `learner:/:locale/settings/subscription`.

## Latest checkpoint — AUDIT-122

Three APIs passed separately. Card publish was triggered by clicking the actual headed Admin button; same-origin Network observed POST and PostgreSQL confirmed published status plus one audit. Module detail returned the persisted response and 404 for missing id. Module archive returned 200 and persisted one audit; an injected audit failure returned 500 and left the module draft with no audit. Roleless and untrusted-origin writes were denied. Fixed missing publish RBAC/CSRF, nonexistent `published_at` SQL and both non-atomic audit writes. Runtime stable 0/10/30/60 after canonical manager rebuild. Go 801/801; harness 263/263; no skips; independent review APPROVE; commit 1bd80504. Counts: 306/627 APIs PASS; 62/163 screens PASS (2 existing fails); 274 defects found, 270 fixed, 4 remain. Next: `GET /api/admin/exercises`.

## Latest checkpoint — AUDIT-121

`POST /api/admin/daily-radar/cards/{id}/duplicate` passed a headed same-origin Admin browser request (201), PostgreSQL clone/audit persistence check, roleless/Origin integration tests, Go 793/793, harness 263/263, and independent review APPROVE. Fixed schema drift, missing module relation, missing content-write RBAC/CSRF and ignored audit errors using one transaction. Commit: 87949da8. Counts: 303/627 APIs PASS; 62/163 screens PASS (2 existing fails); 272 defects found, 268 fixed, 4 remain. Next wave: audit each of card publish, module get and module archive.

## Latest checkpoint — AUDIT-119 / AUDIT-120

`GET /ws/presence` passed through a visible authenticated learner browser: real registration POST 201, session GET 200, WebSocket upgrade 101, and Redis online/last_seen timestamps refreshed after heartbeat. Anonymous/malformed sessions and untrusted origins are rejected by integration tests. AUDIT-120 fixed missing `PresenceService` wiring and a same-user final-disconnect/reconnect race with a per-user lifecycle lock; another user's connection remains independent. Go 790/790, no skips, race/vet/ARM64 passed; independent review APPROVE. Runtime stable 0/10/30/60 after canonical restart; `pnpm clean:next` repaired a corrupt generated Next prerender manifest. Commit: 0161f396. Counts at that checkpoint: 302/627 APIs PASS; 62/163 screens PASS (2 existing fails); 271 defects found, 267 fixed, 4 remain.

## Previous checkpoint — AUDIT-116

A missing notification-preference row now returns the defaults with the same non-zero UTC `createdAt` and `updatedAt`, without writing on GET. PostgreSQL integration tests verify read-only GET, first partial PUT defaults and persisted timestamps. The screen PASS is carried from AUDIT-110’s recorded headed browser gate at 390×844; AUDIT-116’s two browser gate attempts exited 1, so no new AUDIT-116 browser PASS is claimed. Go 788/788 including race, vet and ARM64; independent review APPROVE. Commit: `a8a23bcf`. Counts remain 301/627 APIs PASS and 62/163 screens PASS (2 existing fails).

## Previous checkpoint — AUDIT-115

Subscription current-object and plan-summary queries now share quiz eligibility conditions. The authenticated visible subscription screen showed Free for a verified expired-Plus fixture; fixture cleanup was verified. Commit: `a2aa1b4b`. Counts: 301/627 APIs PASS, 62/163 screens PASS (2 existing fails), 269 defect records / 265 FIXED / 1 FOUND / 3 OPEN at the AUDIT-115 checkpoint.

## Known open items (ordered by user impact)

The canonical ledger has four non-FIXED records: one FOUND item and three OPEN items.

1. **Admin battle analytics browser retest — FOUND.** `ADMIN-BATTLE-ANALYTICS-TIMECOLUMN-001`: Go/PostgreSQL coverage fixes the nonexistent `created_at` source and error masking; the visible Admin screen retest remains pending.
2. **Battle realtime protocol — OPEN.** `BATTLE-REALTIME-SOCKETIO-GO-PROTOCOL-001`: learner battle still speaks legacy Socket.IO while Go serves plain WebSocket; `learner:/:locale/battle` and `learner:/:locale/battle/match` remain FAIL.
3. **Legacy announcement media URL — OPEN.** `MEDIA-LEGACY-ANNOUNCEMENT-URL-001`: active promotion references retired `localhost:19000`.
4. **Search Saved deep link — OPEN.** `SEARCH-SAVED-ENTRY-001`: hydration does not automatically select the exact saved item.
5. **Next API item:** `GET /api/flashcards/styles/active` from the visible authenticated browser; then `GET /api/admin/legal/cookie-categories`.
6. **Frontend-called routes not registered in Go.** Validate each method+path against active callers before fixing; router 404 probes include false positives for templated paths.
   - Learner: `/api/learner/profile`, `/api/learner/shares/streak` (POST), `/api/learner/monetization/summary`, `/api/battle/player-stats`, `/api/flashcards/add-from-remediation`, `/api/flashcards/cards/{id}/media`, `/api/reading-assist/flashcard`, `/api/sharing/achievement`, `/api/media/assets/{id}/read-url`.
   - Admin: `/api/admin/announcements` (+ `{id}`), `/api/admin/assessment/remediation/triggers`, `/api/admin/autofill/generate`, `/api/admin/billing/webhook` (+ `{id}/raw`), `/api/admin/bjt/summary`, `/api/admin/content/enrichment` (+ `{id}`, `/cancel`, `/retry`, `/bulk-retry`), `/api/admin/content/versions` (+ `/diff`, `/{id}`, `/{id}/revert`), `/api/admin/daily/items` (+ `{id}`, `{id}/{action}`), `/api/admin/daily/widgets` (+ `{id}`), `/api/admin/growth/share-templates`, `/api/admin/growth/share-template/preview`, `/api/admin/i18n/keys` (+ `{id}`), `/api/admin/i18n/pending`, `/api/admin/operations/import/overview`, `/api/admin/operations/import-staging/errors/{a}/{b}`, `/api/admin/operations/broadcasts/{a}/{b}`, `/api/admin/operations/system/queue-health/{id}`, `/api/admin/daily-radar/cards/{a}/{b}`, `/api/admin/gamification/{a}/{b}`, `/api/admin/growth/campaigns/{a}/{b}`, `/api/admin/growth/postcards/{a}/{b}`, `/api/admin/growth/social/templates/{a}/{b}`, `/api/admin/learning/competencies/{a}/{b}`, `/api/admin/learning/paths/{a}/{b}`, `/api/admin/assessment/quiz-templates/{a}/{b}`, `/api/admin/assessment/mock-exams/{a}/{b}`, `/api/admin/assessment/remediation/rules/{a}/{b}`, `/api/admin/analytics/{domain}` (an earlier probe used a UUID; verify real domain values).
7. **Inventory blind spot.** `FULL_API_INVENTORY.json` is router-generated and omits frontend-called paths with no Go registration. Add explicit rows for verified active missing calls.
8. **Screens remaining: 99.** Two known FAIL screens are the battle routes above; the remaining set is primarily Admin, with learner settings/privacy/reading, terms, story, share and profile routes also pending.
9. **Admin API audit.** Most Admin method+path entries remain untested one by one.

Probable false positives still to verify: `/api/levels/{level}/{slug}` (templated route) and `/api/admin/analytics/{domain}` (valid domain values not yet probed).

## Working loop (what worked)

1. Pick the next item from `NEXT_ITEM` (state JSON).
2. Reproduce in the visible browser (headed) and capture the API status.
3. `pnpm quality begin AUDIT-NNN "title"` (add `--switch` only when another task is open and you have committed or closed it). `pnpm quality spec --observed ... --expected ... --acceptance ...`, then `pnpm quality classify ... --kind bugfix`.
4. RED: write a test against existing symbols so it compiles on the base. Record with `bash scripts/quality/with-test-db.sh pnpm quality red --go ./internal/httpserver:TestX --expect "<text from the failure>"`. Vitest: `pnpm quality red --vitest "<path>::<test title>" --expect "<text>"`.
5. GREEN: fix, then `bash scripts/quality/with-test-db.sh pnpm quality green --task AUDIT-NNN`.
6. Sensitivity for characterization-style tests: `pnpm quality sensitivity --file <prod file> --find <s> --replace <r> --go ./internal/httpserver:TestX --expect "<assertion text>"`. The expect text must appear in the failure output exactly.
7. `bash scripts/quality/with-test-db.sh pnpm quality verify --task AUDIT-NNN` (suite_go about 5 minutes; suite_frontend if web or shared changed).
8. Browser: put a script in `e2e/audit/auditNNN-browser-check.sh` (outside `docs/`, so it is in the fingerprint), then `pnpm quality evidence browser_e2e --task AUDIT-NNN -- bash e2e/audit/auditNNN-browser-check.sh`.
9. `pnpm quality review prepare --task AUDIT-NNN`, then a fresh reviewer, then `pnpm quality review record --task AUDIT-NNN --reviewer <id> --mode fresh_session --verdict APPROVE --output <file with the JSON line>`, then `pnpm quality close --task AUDIT-NNN`. Review is required for AUTH_SECURITY and CI_QUALITY_SYSTEM. It may not be required for other classes.
10. Commit only the task's files (not `apps/*/next-env.d.ts` or `tsconfig.tsbuildinfo`, which are generated) with the task record `tasks/AUDIT-NNN.json`.

## Pitfalls seen this session

- **Stack restart:** `node scripts/local-audit-up.mjs` runs Next dev. A restart can leave `apps/web/.next` corrupt (`JSON.parse` error on every page). Fix: stop the stack, run the repository script `pnpm clean:next`, then start again. The canonical manager rebuilds the API binary before launching services.
- **Logs:** the quality guard blocks shell redirection into `tmp/local-audit/`. Write logs to the session scratchpad.
- **Headed browser:** `AGENT_BROWSER_HEADED=1` and close old sessions first. A stale session gives `Could not configure browser: Failed to connect`. Closing the sessions and retrying usually works.
- **psql booleans** concatenated in SQL print `true`/`false`, not `t`/`f`.
- **Review:** `claude -p` in the shell is not logged in, and the user config maps `opus` to `gpt-6-sol`, which this Claude Code build does not recognise. Use a fresh subagent as the reviewer and record it with `--mode fresh_session`.
- **Active task:** `tasks/.active` holds the active task id. `begin` refuses when another task is open unless you pass `--switch`.
- **Baselines** (`sql_conformance_baseline.json`) are `quality_system`. Changing them needs `CI_QUALITY_SYSTEM` in the classification. Shrinking is allowed; raising the floor is allowed only to the actual count.

## Commits from this session

- `222502cf` docs: checkpoint scenario list audit
- `1f8966e3` fix: implement learner in-app notification feed endpoints (AUDIT-108)
- `8d8b2412` test: pin in-app notification limit and write-access contracts (AUDIT-108)
- `d4d049c3` test: align quiz study-plan date with production plan date (AUDIT-109)
- `24030f8a` fix: save notification preferences for learners without a row (AUDIT-110)
- `8732fe54` fix: add learner subscription plan summary for the settings page (AUDIT-111)
- `1efbd6f4` fix: guard the learner subscription settings page with RequireAuth (AUDIT-112)
- `40f96213` fix: cancel learner subscription at period end instead of cutting access (AUDIT-113)
- `997591e2` fix: restore privacy-filtered public profiles (AUDIT-114)
- `a2aa1b4b` fix: hide expired subscriptions from learner summary (AUDIT-115)
- `0f6b1409` docs: checkpoint subscription inventory and runtime stability
- `a2aa1b4b` fix: hide expired subscriptions from learner summary (AUDIT-115)

- `87949da8` fix: secure and repair daily radar card duplication (AUDIT-121)

- `1bd80504` fix: secure Daily Radar publish and archive APIs (AUDIT-122)

- e3b2f23f — secure Admin flashcard styles screen and six API contracts (AUDIT-126).


## AUDIT-128 / AUDIT-129 code commits

- `8949a238` — restore learner flashcard style selection from the canonical Admin-managed schema; real UI selection persisted after refresh.
- `228ec7f3` — remove newly introduced lint debt from the Admin flashcard-style component test.
- AUDIT-130 documents this checkpoint; its commit is recorded in Git history.


## Latest checkpoint — AUDIT-142

Nine Admin achievement/tier endpoints PASS individually. Permission/CSRF enforcement, shared-schema validation, transactional audit, DB/not-found handling and valid gamification table markup were fixed. Headed Admin session at 390×844, no page/console errors or overflow; Go 912/912, frontend 467/467, E2E PASS, independent review APPROVE. Commit `e641ef88`. Counts: 351/627 APIs PASS, 0 FAIL, 276 remaining; 67/163 screens PASS (2 FAIL, 94 remaining); defects 311 found, 307 fixed, 4 remain. Next: `GET /api/admin/gamification/leaderboards`.


## Latest completed API wave — AUDIT-143 (2026-10-14)

Five Admin gamification APIs passed one-by-one: leaderboard list/create/update/delete and companion-pet list. Reads require `admin.content.read`; mutations require `admin.content.write` plus trusted-origin CSRF. Leaderboard writes validate bounded fields and persist audit rows in the same transaction; deleting a leaderboard with history returns 409 and locks the parent row to protect concurrent FK inserts. Pet listing validates stage filters and returns query/scan failures rather than partial data.

Headed Chromium at 390×844 used the real Admin login form and HttpOnly session. It observed GET/POST/PUT/DELETE leaderboard responses 200/201/200/200 and pets GET 200, verified persisted audit history and disposable data cleanup, and recorded no page/console errors or viewport overflow. Go 919/919, race/vet/ARM64 build, frontend 467/467, 390×844 browser E2E, and independent fresh-session review APPROVE. Code commit: `e377839c`.

The Gamification screen authenticated and mobile states are PASS; the anonymous state remains REMAINING, so the screen is still REMAINING. Checkpoint: screens 67/163 PASS, 2 FAIL, 94 remaining; APIs 356/627 PASS, 0 FAIL, 271 remaining; defects 316 found, 312 fixed, 4 remaining. Next API: `GET /api/admin/gamification/pets/stats`.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-GAMIFICATION-LEADERBOARD-RBAC-001 | Leaderboard routes lacked complete permission and trusted-origin checks. | Require content read/write RBAC and CSRF on writes. | e377839c | Go anonymous/roleless/read-only/CSRF tests; real Admin UI. |
| ADMIN-GAMIFICATION-LEADERBOARD-CONTRACT-001 | Leaderboard handlers accepted incomplete bounds, masked scan errors, and lacked accurate missing-record/audit transaction behavior. | Validate input; propagate query/scan/iteration errors; transact mutation and audit; return 404 accurately. | e377839c | 919 Go tests and visible CRUD with persistence/audit verification. |
| ADMIN-GAMIFICATION-LEADERBOARD-HISTORY-001 | Cascade delete could erase an entry inserted concurrently after the history check. | Lock the parent row before checking history; preserve entries with 409. | e377839c | PostgreSQL concurrent FK-insert regression. |
| ADMIN-GAMIFICATION-PETS-CONTRACT-001 | Invalid pet stage filters were silently ignored and row scan/iteration errors could be hidden. | Reject invalid stages and surface database read failures. | e377839c | Integration filters/errors plus visible pet list. |
| ADMIN-GAMIFICATION-MOBILE-TABLE-001 | Leaderboard actions extended past the 390px viewport. | Keep the table in a keyboard-focusable internal scroll region. | e377839c | Headed 390×844 create/edit/delete, no viewport overflow. |


## Latest checkpoint — AUDIT-145

Streak create/update/delete and Growth campaign list/create passed each METHOD+PATH separately. Real Admin form login and HttpOnly session exercised the APIs from headed Chromium at 390x844; database persistence, actor audit, rollback, validation, role/CSRF behavior and campaign response contracts passed. The populated Growth Campaigns table overflow was fixed using a keyboard-focusable internal scroll region. Go 939/939, frontend 467/467, runtime stable at 0/10/30/60, review APPROVE. Code commit `d4185812`.

Next item: `GET /api/admin/growth/campaigns/audience-estimate`. Screens: 68 PASS / 2 FAIL / 93 remaining. APIs: 366 PASS / 0 FAIL / 261 remaining. Defects: 327 found / 323 fixed / 4 remaining.
