## TOMORROW_MORNING_SUMMARY — AUDIT-159

STARTING_GIT_HEAD: 6e11cf076110fe7fbc8135754446747013db5ec0
FINAL_GIT_HEAD: pending commit
LOCAL_RUNTIME_STATUS: READY; source-rebuilt and stable at 0/10/30/60 after additive migrations 20261015100000, 20261015110000, and 20261015120000 seconds
LOCAL_RUNTIME_START_COMMAND: node scripts/local-audit-up.mjs
LEARNER_LOGIN_STATUS: PASS (prior real UI evidence)
ADMIN_LOGIN_STATUS: PASS; real Admin session used for headed audit
SCREENS_TOTAL: 163 | SCREENS_PASS: 70 | SCREENS_FAIL: 2 | SCREENS_REMAINING: 91
APIS_TOTAL: 633 | APIS_PASS: 630 | APIS_FAIL: 0 | APIS_REMAINING: 3
DEFECTS_FOUND: 414 | DEFECTS_FIXED: 407 | DEFECTS_REMAINING: 7
COMMITS_CREATED: 9a9db770 (documentation checkpoint; code changes remain pending screen gate)
LEARNER_STATUS: prior real registration/login evidence PASS
ADMIN_STATUS: real login PASS; visible UI and API permission states checked
MOBILE_STATUS: AUDIT-159 Admin Media 390x844 PASS; media table no longer widens document
API_STATUS: 630 PASS / 0 FAIL / 3 external blockers across 633 APIs; targeted Wave 12 4/4 PASS and full Go suite `go test ./...` PASS after SQL conformance baseline refresh.
REALTIME_STATUS: prior audit status retained; exhaustive audit remains pending
MEDIA_STATUS: media list/detail metadata contract and UI PASS
PERSISTENCE_STATUS: Loto publish/approval, magazine actions, media metadata and Ads mutations covered by PostgreSQL persistence/audit tests
CURRENT_PHASE: SCREEN_AUDIT
NEXT_ITEM: learner:/:locale/settings/reading — identify the headed reload initiator; finish anonymous guard and refresh/persistence retest. Do not count as PASS until stable.
EXTERNAL_BLOCKERS: Official Loto source returned HTTP 403; image search has no configured Unsplash/Pixabay key; legacy share-image renderer is absent and has no current frontend caller.
FINAL_VERDICT: IN PROGRESS — Go API suite PASS; 0 local API failures, 3 external API blockers, and 91 screens remain; 2 screen failures remain.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-READING-PREFERENCES-SAVE-001 | Running Go API binary still referenced removed study.reading_assist_preference; reading settings PUT omitted required showRomaji. | Rebuilt current Go API from source and include/preserve showRomaji in the learner settings payload. | pending | RED/GREEN frontend contract test; frontend typecheck; focused Go PostgreSQL GET/PUT suite PASS; headed UI PUT 200 and local row persisted, fixture preference restored. Anonymous guard and visible refresh retest remain. |
| LEARNER-READING-RELOAD-001 | Headed browser repeatedly reloads the unchanged route; source not identified because CDP navigation attribution became unavailable. | Open; no code change until the initiating layer is known. | pending | 17 document loads / 2s; route HTTP 200; service-worker bypass did not stop it. Screen remains REMAINING. |
| STRIPE-TIED-EVENT-AUDIT-159 | A same-second Stripe event was correctly skipped for subscription mutation but its subscription_event payload incorrectly recorded applied=true. | Use the same strict eventCreated > latestCreated predicate for mutation and event audit payload. | pending | Focused PostgreSQL Stripe suite PASS; tied event is persisted with applied=false. |
| MEDIA-AMBIGUOUS-COMMIT-159 | Deleting a stored blob after a DB commit error with unknown transaction outcome could leave a committed media row without its object. | Retain the blob after commit failure; database reconciliation can determine whether a cleanup is safe. | pending | Removed unsafe unconditional blob deletion on commit error; focused media and upload regressions remain green. |
| STRIPE-SAME-SECOND-ORDERING-159 | Distinct Stripe subscription events sharing the same event.created second could overwrite the state applied first. | Apply a subscription event only when its event.created is strictly later than the latest recorded timestamp; record tied events without mutating subscription state. | pending | Focused PostgreSQL Stripe tests pass and assert equal-second events cannot overwrite the first-applied state. |
| MEDIA-EXTERNAL-RIGHTS-REVIEW-159 | Proxied external image was marked rights-pending but publicly active. | Store proxy assets as pending_review until rights are cleared; verify public store denies access. | pending | Focused PostgreSQL-backed regression: red before fix, green after; SSRF and persistence checks pass. |
| LEARNER-PROFILE-AVATAR-PERSISTENCE-159 | PUT /api/auth/profile accepted avatarAssetId but silently discarded it. | Validate the UUID and persist/set or clear avatar_asset_id in the existing profile store. | pending | RED reproduced unchanged DB value; targeted PostgreSQL Wave 7 suite PASS. |
| LEARNER-DAILY-HOME-DUE-COUNT-159 | Optional-auth daily home always reported dueReviews=0. | Apply optional learner session middleware and count due cards from active visible decks for that learner. | pending | RED reproduced zero with a persisted due card; targeted PostgreSQL Wave 7 suite PASS. |
| LEARNER-FLASHCARD-DISTRACTORS-SCHEMA-159 | Distractor query referenced removed/nonexistent content.flashcard_variant. | Query canonical learning.flashcard_variant and scope custom cards to the owner/public deck. | pending | RED reproduced HTTP 500 on fresh schema; targeted PostgreSQL Wave 7 suite PASS. |
| LEARNER-REGISTER-USERNAME-CONTRACT-159 | Register rejected the form’s username field. | Map the frontend field and create the real learner/session contract. | pending | Focused PostgreSQL invalid/duplicate/session checks PASS. |
| LEARNER-CAREER-CLOCK-IN-IDEMPOTENCY-159 | Missing career state and duplicate same-day XP awards broke clock-in. | Initialize canonical state and make the Tokyo-day update idempotent. | pending | PostgreSQL persistence, CSRF, streak and repeated-call regression PASS. |
| LEARNER-COMPANION-HINT-INPUT-ERROR-159 | Unbounded days and suppressed database failures caused unreliable hints. | Validate date window and propagate logged query failures. | pending | Focused PostgreSQL authenticated user-scope regression PASS. |
| LEARNER-KANJI-QUERY-CONTRACT-159 | Kanji search ignored paging and readings and hid malformed/missing/query-error distinctions. | Add bounded paging, On/Kun search, ID validation and explicit DB errors. | pending | Focused PostgreSQL list/detail contract tests PASS. |
| LEARNER-EXERCISE-HISTORY-ERRORS-159 | History query/scan failures were returned as empty success. | Propagate query, scan and iteration errors. | pending | Focused PostgreSQL history route test PASS. |
| LEARNER-DAILY-RADAR-MODULE-CONTRACT-159 | Learner module listing returned the Admin DTO shape. | Return the learner contract fields and check row iteration errors. | pending | Focused PostgreSQL module contract test PASS. |
| LEARNER-FLASHCARD-DISTRACTOR-UI-CONTRACT-159 | Distractor response shape and query parameter did not match the active review UI. | Return {items:string[]} and honor n while retaining limit compatibility. | pending | Focused PostgreSQL review route test PASS. |
| ADMIN-LOTO-REPUBLISH-SELECTION-159 | Republishing left prior generated sets selected. | Clear the run’s old selections transactionally before selecting the new requested set IDs. | pending | RED replay reproduced two selected sets; PostgreSQL regression verifies one selected set and two audit records after republish. |
| ADMIN-ADS-CAMPAIGN-DATE-PATCH-159 | Partial date PATCH ignored the other persisted date bound. | Lock/read current bounds and validate the merged interval before update. | pending | PostgreSQL regression rejects endAt before stored startAt and verifies no persisted change. |
| ADMIN-ADS-CAMPAIGN-NULL-CLEAR-159 | PATCH decoded explicit JSON null like an omitted field, so Admin could not clear nullable campaign values. | Track JSON key presence separately and bind SQL NULL for explicit null; omission still preserves stored data. | pending | RED reproduced HTTP 400; PostgreSQL GREEN verifies six nullable columns clear and actor-attributed audit persists. |
| ADMIN-ADS-POLICY-STATUS-159 | Arbitrary policy values were accepted although ad delivery requires policy_status=ok. | Validate policyStatus against pending/ok/warning/rejected in create and PATCH. | pending | PostgreSQL regressions reject unsupported policy values on both methods. |
| ADMIN-LOTO-PUBLISH-PERSISTENCE-159 | Loto publish wrote the wrong persistence contract and did not atomically bind selected sets and audit. | Persist selected sets into canonical daily schema with selection validation and transactional audit. | pending | AUDIT-159 Go PostgreSQL contracts / headed 390x844 as applicable; final suites PASS. |
| ADMIN-LOTO-APPROVAL-VALIDATION-159 | Prediction transitions accepted invalid article types or lacked reliable audit atomicity. | Validate prediction type and commit state/audit in one transaction. | pending | AUDIT-159 Go PostgreSQL contracts / headed 390x844 as applicable; final suites PASS. |
| ADMIN-MAGAZINE-DELETE-ERROR-CONTRACT-159 | Magazine deletion did not consistently validate identifiers or report missing rows. | Validate UUID, return 404 for missing content, and write audit atomically. | pending | AUDIT-159 Go PostgreSQL contracts / headed 390x844 as applicable; final suites PASS. |
| ADMIN-MAGAZINE-REGENERATE-CONTENT-SAFETY-159 | Regeneration could replace content instead of safely restarting its workflow. | Resolve slug/UUID and reset workflow while preserving original content. | pending | AUDIT-159 Go PostgreSQL contracts / headed 390x844 as applicable; final suites PASS. |
| ADMIN-MEDIA-SQL-NULL-SCAN-159 | Media list/detail selected source_url twice and scanned nullable values into a string, returning 500 on real rows. | Select metadata once and encode nullable sourceUrl/byteSize using client field names. | pending | AUDIT-159 Go PostgreSQL contracts / headed 390x844 as applicable; final suites PASS. |
| ADMIN-MONETIZATION-ADS-RBAC-CSRF-159 | Ads endpoints did not consistently enforce granular permissions and mutation CSRF. | Apply route-level read/write permissions and trusted-Origin CSRF to mutations. | pending | AUDIT-159 Go PostgreSQL contracts / headed 390x844 as applicable; final suites PASS. |
| ADMIN-MEDIA-MOBILE-OVERFLOW-159 | Populated media table widened the document beyond a 390px viewport. | Place the table in a bounded horizontal scroller. | pending | AUDIT-159 Go PostgreSQL contracts / headed 390x844 as applicable; final suites PASS. |
| ADMIN-LOTO-SYNC-UPSTREAM-EXTERNAL-159 | Sync remains a request-recording stub; official upstream denied download/import with HTTP 403. | Blocked pending an accessible official upstream contract; no false PASS recorded. | pending | AUDIT-159 Go PostgreSQL contracts / headed 390x844 as applicable; final suites PASS. |

## Previous completed API wave — AUDIT-140 (2026-10-13)
# Latest completed API wave — AUDIT-140 (2026-10-13)

All five Admin Loto APIs passed individually through real Admin login and the visible headed Loto Lab UI at 390×844. The fixes align queries and writes with canonical `daily` tables and PostgreSQL integer arrays, validate dates/CSV rows before mutation, keep import atomic, report query failures, and persist actor-attributed audit events with each write. Targeted PostgreSQL tests cover persistence, invalid input, authorization and CSRF; a fresh independent review caught and drove a concurrency-safe E2E cleanup correction. Final Go 889/889 (race, vet, ARM64), harness 263/263, fresh independent review APPROVE, and runtime 0/10/30/60 PASS. Commit: `8a2ca941`.

Counts: 337/627 APIs PASS (290 remaining); 67/163 screens PASS, 2 FAIL, 94 remaining; defects 304 found, 300 fixed, 4 remaining.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-LOTO-SCHEMA-001 | Handlers queried `content.loto_*`, while canonical tables live in `daily`; number arrays were handled as JSON. | Use `daily` tables and native integer arrays across generation/import/results/analytics. | 8a2ca941 | Go PostgreSQL API contract suite; final headed 390×844 Loto flow. |
| ADMIN-LOTO-CSV-002 | CSV import silently skipped invalid rows, swallowed failures, miscounted upserts and could partially persist. | Validate the complete file first, return precise created/updated counts, and upsert atomically with an actor audit event tied to a draw ID. | 8a2ca941 | Invalid mixed file leaves no partial draw; create/update persistence and audit asserted. |
| ADMIN-LOTO-ANALYTICS-003 | Analytics decoded PostgreSQL arrays as JSON and suppressed query/scan errors. | Scan native arrays and propagate database and row errors. | 8a2ca941 | Persisted draw included in exact 6/6 aggregate; visible analytics request 200. |
| ADMIN-LOTO-VALIDATION-004 | Short dates could panic and malformed date suffixes were accepted. | Parse only exact dates or valid complete RFC3339 timestamps; validate values before writes. | 8a2ca941 | Short/suffixed date and bad row return 400 without 5xx or partial write. |
| ADMIN-LOTO-AUDIT-005 | Loto mutations lacked atomic actor-attributed audit coverage; broad E2E cleanup could remove another run's history. | Commit mutations and audit together; scope test cleanup to unique run/draw target IDs. | 8a2ca941 | PostgreSQL audit assertions and independent review; headed UI cleanup. |
| ADMIN-LOTO-GENERATION-NUMBERS-006 | Bonus numbers could duplicate main values; Loto7 main values used the Loto6 range. | Generate within the selected game's range and select bonus values only from numbers not already in the main set. | 8a2ca941 | PostgreSQL regression checks every returned loto6/loto7 set has unique, in-range main and bonus values. |

## Previous completed screen fix — AUDIT-139 (2026-10-13)

The Magazine table now scrolls inside a keyboard-accessible region. A visible headed Chromium run at 390×844 completed real Admin form login, loaded the list and generated content; document clientWidth and scrollWidth were both 390px, all observed requests returned below 500, and there were no unexpected console/page errors. The screen remains REMAINING overall until anonymous and authenticated screen-state checks are recorded.

AUDIT-138's five API verdicts remain PASS. Current totals: 332/627 APIs PASS (295 remaining); 67/163 screens PASS, 2 FAIL, 94 remaining; defects 298 found, 294 fixed, 4 remaining.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-MAGAZINE-LOTO-RBAC-CSRF-001 | All 16 Magazine/Loto routes relied on AdminGuard without content permissions or mutation CSRF. | Route-specific read/write permissions and trusted-Origin CSRF. | f4ffbbfb | Go real-router role/Origin tests; 883/883 suite; headed API wave. |
| ADMIN-MAGAZINE-GENERATION-001 | Generation could panic on short dates and did not atomically audit the created draft. | Validate before slicing and transactionally persist draft plus audit event. | f4ffbbfb | Invalid-input tests; persisted row and one audit event; visible generate flow. |
| ADMIN-MAGAZINE-GENERATION-IDEMPOTENCY-001 | Concurrent duplicate requests raced between SELECT and INSERT. | Unique-key INSERT ON CONFLICT returns the duplicate contract. | f4ffbbfb | 12 concurrent requests all 200 and exactly one generated row. |
| ADMIN-MAGAZINE-WIDGET-KIND-001 | API accepted unknown magazine widget kinds. | Validate against six supported Admin options. | f4ffbbfb | Unknown kind returns 400. |
| ADMIN-MAGAZINE-LOCALE-SLUG-001 | Generated slugs collided across locales even though each locale/date is a valid distinct article. | Include locale in canonical date-kind-locale slug. | f4ffbbfb | PostgreSQL creates vi and en variants for one widget/date with separate slugs. |
| ADMIN-MAGAZINE-MOBILE-OVERFLOW-001 | Admin Magazine table/action columns had no local horizontal scroller. | Bound the table in an accessible horizontal scroll region. | Pending AUDIT-139 commit | Headed 390×844 real Admin login/list/generate; document width 390px; no unexpected console/page errors. |

# Latest completed Admin screen and API — Admin login (AUDIT-136, 2026-10-13)

Visible headed Chrome exercised the real Admin login UI at 390×844. Empty validation sent no request; wrong password returned 401; valid Argon2id credentials returned 200, redirected to `/admin/vi`, and the HttpOnly session survived refresh. The response and browser-readable storage exposed no token; no horizontal overflow or page errors. Disposable actor and session were removed. Go 847/847, browser E2E PASS, independent fresh-session review APPROVE. Commit: `d4ea2e93`.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| None found | Admin login behavior matched its contract. | Added headed browser and rate-limit regression coverage; recorded screen/API verdicts. | d4ea2e93 | Real UI empty/wrong/valid login and refresh; Go 847/847; independent review APPROVE. |

# Latest completed screen and API — Admin Legal Retention (AUDIT-134, 2026-10-13)

The Admin retention screen and `GET /api/admin/legal/retention` now enforce permission checks: anonymous requests receive 401, authenticated roleless Admins receive 403, and either legal read permission or `iam.manage` can read the seven-domain contract. The OpenAPI permission list matches the Go router. Visible headed browser used the real Admin login form at 390x844; the authorized screen rendered all seven rows, with an HttpOnly session and no page overflow or window errors. The wide table scrolls inside its section on mobile. Two disposable Admin actors and their role, sessions, credentials, and local files were removed. Go 846/846 (race, vet and ARM64); frontend 466/466; browser E2E PASS; independent fresh-session AUTH_SECURITY review APPROVE. Code commit: `52dd6076`.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-LEGAL-RETENTION-RBAC-001 | The route used AdminGuard without the OpenAPI/nav permission check. | RequireAnyPermission for legal read/write/admin or `iam.manage`; align OpenAPI. | 52dd6076 | Go 846/846; visible anonymous/roleless/authorized; independent review APPROVE. |
| ADMIN-LEGAL-RETENTION-MOBILE-OVERFLOW-001 | Six-column table widened the document past 390px. | Wrap the table in local horizontal scrolling. | 52dd6076 | Headed 390px browser: seven rows, no document overflow/errors. |

# Latest completed screen — Admin Cookie & Tracker (AUDIT-132, 2026-10-13)

The Cookie & Tracker screen now enforces the permissions documented for its category API. Visible headed Chrome at 390×844 verified the anonymous redirect and 401 response, a real roleless Admin login followed by API 403 and a localized page error, and a real Argon2id-authenticated authorized Admin loading all four categories with HTTP 200. The admin session cookie is HttpOnly; no horizontal overflow or window errors. Go integration tests verify anonymous 401, roleless 403, `admin.legal.read` 200 with every response field, and `iam.manage`-only 200. The test actors, role, and credential files were removed. Runtime stable at 0/10/30/60; Go suite 845/845 including race, vet, and ARM64; independent AUTH_SECURITY review APPROVE. Code commit: `a6580e19`.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-LEGAL-COOKIE-CATEGORIES-RBAC-001 | Cookie category API used AdminGuard only despite documented legal permissions. | Enforce any documented legal read/write/admin grant or `iam.manage`, and align OpenAPI. | a6580e19 | Visible anonymous 401 / roleless 403 / authorized 200; 390×844 no overflow; Go 845/845; independent review APPROVE. |

# Latest completed learner audit — Flashcard style picker and API list/select (AUDIT-128, 2026-10-13)

The learner picker now reads the canonical `learning.flashcard_style` table used by Admin and receives the `{activeSlug, styles}` response it expects. Through visible headed Chrome at 390×844, a disposable learner was registered and logged in through the real forms; the picker loaded two temporary Admin-managed styles, selected each through the UI, and retained the second selection after refresh. Anonymous/session, CSRF, invalid style and persistence behavior are covered by Go PostgreSQL tests. The exact account and style fixtures were removed. Go 844/844 (race, vet, ARM64), frontend 466/466, harness 263/263, and independent review APPROVE. The separate GET `/api/flashcards/styles/active` was invoked from the visible authenticated learner page; it returned HTTP 200 `{slug:null, config:{}}`, matching the list contract. Code commit: `8949a238`.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-ADMIN-FLASHCARD-STYLE-SCHEMA-PARITY-001 | Learner store queried `content.flashcard_style`; Admin and migrations use `learning.flashcard_style`, and the learner endpoint returned a raw list rather than the picker envelope. | Query the canonical table and return `{activeSlug, styles}`; add PostgreSQL contract/security regressions. | 8949a238 | Visible real-UI selection persisted after refresh at 390×844; Go 844, frontend 466, harness 263; independent review APPROVE. |
| ADMIN-FLASHCARD-STYLES-TEST-LINT-001 | Dynamic React import used only for type namespaces triggered the unused-assignment lint rule. | Replace it with top-level type-only imports. | 228ec7f3 | Targeted ESLint/Vitest 5/5; frontend 466/466, typecheck/build and debt gate pass. |

# Latest completed screen — Admin Flashcard Styles (AUDIT-126)

The Admin flashcard-style screen now validates and persists style definitions safely. Visible headed browser coverage at 390x844 exercised create, list refresh, edit, activate/archive, detail and adoption; anonymous access redirected to Admin login and same-origin API reads/writes returned 401. The table stays inside a keyboard-focusable horizontal scroller with no page overflow. Go 833/833 (race, vet and ARM64 build), frontend 460/460 with zero skips and no new lint debt, runtime 0/10/30/60 PASS, and independent review APPROVE. Code commit: e3b2f23f.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-FLASHCARD-STYLE-ADOPTION-001: Admin adoption analytics joined a nonexistent preference field and returned no valid counts. | Admin adoption analytics joined a nonexistent preference field and returned no valid counts. | Count profile.user_profile.flashcard_style_slug selections by style slug. | e3b2f23f | Go 833/833; headed browser/API and responsive checks; review APPROVE. |
| ADMIN-FLASHCARD-STYLE-VALIDATION-001: Create accepted unsupported tier/status values. | Create accepted unsupported tier/status values. | Reject invalid tier/status before persistence. | e3b2f23f | Go 833/833; headed browser/API and responsive checks; review APPROVE. |
| ADMIN-FLASHCARD-STYLE-RBAC-001: Admin style routes lacked explicit read/write permission guards. | Admin style routes lacked explicit read/write permission guards. | Require admin.content.read for reads and admin.content.write for mutations. | e3b2f23f | Go 833/833; headed browser/API and responsive checks; review APPROVE. |
| ADMIN-FLASHCARD-STYLE-CSRF-001: Admin style mutations did not enforce trusted-origin CSRF protection. | Admin style mutations did not enforce trusted-origin CSRF protection. | Apply the canonical CSRF guard to create, patch and transition routes. | e3b2f23f | Go 833/833; headed browser/API and responsive checks; review APPROVE. |
| ADMIN-FLASHCARD-STYLE-CONFIG-001: Theme config validation was absent or incomplete at the API boundary. | Theme config validation was absent or incomplete at the API boundary. | Validate required/safe theme config on create and patch. | e3b2f23f | Go 833/833; headed browser/API and responsive checks; review APPROVE. |
| ADMIN-FLASHCARD-STYLE-AUDIT-ATOMICITY-001: Style mutations and audit writes could commit independently. | Style mutations and audit writes could commit independently. | Use one transaction for each mutation and its audit row; verify rollback on audit failure. | e3b2f23f | Go 833/833; headed browser/API and responsive checks; review APPROVE. |
| ADMIN-FLASHCARD-STYLE-GRADIENT-CASE-001: Go rejected valid mixed-case linear-gradient backgrounds accepted by the shared schema. | Go rejected valid mixed-case linear-gradient backgrounds accepted by the shared schema. | Make safe background validation case-insensitive and pin parity with a mixed-case integration test. | e3b2f23f | Go 833/833; headed browser/API and responsive checks; review APPROVE. |
| ADMIN-FLASHCARD-STYLE-MOBILE-OVERFLOW-001: The wide styles table expanded the page beyond mobile viewport width. | The wide styles table expanded the page beyond mobile viewport width. | Bound the table in an accessible horizontal scroll region. | e3b2f23f | Go 833/833; headed browser/API and responsive checks; review APPROVE. |
| LEARNER-ADMIN-FLASHCARD-STYLE-SCHEMA-PARITY-001 | Learner store queries content.flashcard_style while Admin owns learning.flashcard_style. | Open follow-up: align learner reads and selection validation to the canonical table. | pending | Discovered by independent review; next item. |

# Latest completed screen — Learner notification preferences (AUDIT-116)

Missing notification-preference rows now return the normal boolean defaults with one non-zero UTC instant in both timestamp fields. PostgreSQL integration tests verify GET leaves the row absent and a first partial PUT preserves omitted defaults and persists matching timestamps. The screen’s visible headed-browser PASS at 390×844 is carried forward from AUDIT-110, recorded in tasks/AUDIT-110.json (browser_e2e exit 0, real learner form login and Save). AUDIT-116’s two browser_e2e gate attempts exited 1 during agent-browser configuration, so no new browser PASS is attributed to AUDIT-116. Go suite: 788/788, including race, vet and ARM64 build. Independent review: APPROVE. Commit: a8a23bcf.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| NOTIF-PREFS-DEFAULT-TIMESTAMP-001 | Missing-row defaults left both Go timestamps at zero time. | Return both fields from one UTC instant; preserve read-only GET behavior. | a8a23bcf | PostgreSQL GET/partial-PUT integration; screen browser PASS remains recorded by AUDIT-110 at 390×844; AUDIT-116 browser gate attempts exited 1; Go 788/788 incl race; review APPROVE. |

# Latest completed screen — Learner Scenario detail (AUDIT-106)

# Latest completed screen — Learner notifications feed (AUDIT-108)

The settings notifications page previously showed "Không tải hoặc lưu được" and hid the working preferences form, because the Go router never registered the in-app feed endpoints (404). GET /api/learner/in-app-notifications now returns the owner's newest rows, and POST /api/learner/in-app-notifications/{id}/read marks one read idempotently with owner scope, learner guard and CSRF. Visible local checks: anonymous redirect and 401s; feed renders; mark-read persists after reload; 390px has no horizontal overflow; no console errors. Go suite 771/771 with race. Review gate is still pending, so the task is not closed.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| IN-APP-NOTIFICATIONS-FEED-MISSING-001 | Feed and read endpoints were not registered in Go (404), so the page reported a load error. | Owner-scoped feed and idempotent mark-read handlers. | pending (AUDIT-108) | Visible browser check and Go owner/idempotency/CSRF tests. |


# Latest completed screen — Learner Scenario list (AUDIT-107)

The learner scenario list now awaits locale params, redirects anonymous users to localized login, shows a retryable localized error state instead of masking failures as an empty catalog, uses vi/en/ja copy, and returns explicit database errors. Visible Chrome at localhost:18081 confirmed the anonymous redirect with 401 from GET /api/scenarios, the authenticated list (localized cards, 200 array), and no horizontal overflow at 390px. AUDIT-107 closed VERIFIED at e70d90a6; Go 760/760, frontend 455/455, harness 263/263, independent review APPROVE. Commit: 2449d05a.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| SCENARIO-LIST-PARAMS-001 | List route read Next params synchronously. | Await locale params before render/redirect. | 2449d05a | Visible list rendered; vitest page regression passed. |
| SCENARIO-LIST-AUTH-GUARD-001 | Anonymous list users were not redirected and the page kept loading. | Enforce learner guard and redirect to localized login. | 2449d05a | Isolated anonymous browser redirected; GET 401. |
| SCENARIO-LIST-ERROR-MASK-001 | Non-2xx and network failures were presented as an empty catalog (client regression of SCENARIO-LIST-EMPTY-FAILURE-001). | Retryable localized error state; truthful empty state. | 2449d05a | Client regression tests pass; frontend 455/455. |
| SCENARIO-LIST-LOCALE-COPY-001 | Vietnamese interface copy appeared on every locale. | Localized vi/en/ja messages. | 2449d05a | Message regression tests; visible vi check. |
| SCENARIO-LIST-ROWS-DB-ERROR-001 | Row iteration omitted terminal database error handling. | Return explicit error on row failure instead of a truncated list. | 2449d05a | Go suite 760/760 incl. race. |


The protected scenario detail now loads canonical active scenario rows after awaiting route params, hides answer keys until submission, accepts the established choiceKey request contract, validates completion server-side, and stores a score based on optimal choices. A guarded migration enforces unique choice keys. On visible headed Chrome, the real learner UI answered all three steps, completed with HTTP 200, showed 30/30 and 3/3, and retrieved the persisted attempt after refresh. Anonymous detail redirected to localized login; all four protected API method+paths returned 401 without a session. The 390×844 view had no horizontal overflow and the browser console had no errors. AUDIT-106 is CLOSED/VERIFIED; Go 760/760 including race, frontend 455/455, harness 263/263, typecheck/build, and fresh independent review APPROVE. Commit: 9b010ceb.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| SCENARIO-PARAMS-PROMISE-001 | Async route params reached the API as undefined. | Await locale/scenarioId params before lookup. | 9b010ceb | Visible scenario detail loaded its canonical id; Go and frontend gates passed. |
| SCENARIO-CANONICAL-SCHEMA-001 | List SQL queried legacy title/status columns absent from PostgreSQL. | Read canonical localized columns and active flag. | 9b010ceb | Local Postgres integration passed and GET list returned its active-content contract. |
| SCENARIO-LIST-CONTRACT-001 | List response omitted the fields and _count shape consumed by the learner list. | Return slug, localized title/description, icon, duration, step/attempt counts. | 9b010ceb | Go contract integration and type/build gates passed. |
| SCENARIO-LIST-EMPTY-FAILURE-001 | Unplayable rows could be offered and list failures appeared as an empty catalog. | Filter scenarios without playable steps/choices; render a retryable localized error state. | 9b010ceb | Canonical seed list and frontend retry regression passed. |
| SCENARIO-DETAIL-SCHEMA-001 | Detail lookup used the nonexistent legacy publication column and omitted current metadata. | Load active canonical scenario columns and reject inactive/missing records. | 9b010ceb | Visible detail PASS; missing id returned truthful 404; DB integration passed. |
| SCENARIO-ANSWER-KEY-LEAK-001 | Initial detail JSON exposed optimal-answer flags, points and feedback. | Return only public choice text/key before submission. | 9b010ceb | Contract integration asserts answer-key fields are absent. |
| SCENARIO-ANON-GUARD-001 | Anonymous detail route rendered instead of preserving a login return path. | Enforce learner session and redirect to localized login with returnTo. | 9b010ceb | Isolated visible anonymous browser redirected; all four APIs returned 401. |
| SCENARIO-ANSWER-CHOICEKEY-001 | Frontend choiceKey payload differed from the Go handler’s choiceId-only request. | Accept canonical choiceKey and additive legacy choiceId. | 9b010ceb | Visible answer POST x3 returned 200; API contract tests passed. |
| SCENARIO-ANSWER-RETRY-001 | A failed answer request could leave choices disabled and prevent retry. | Keep the question actionable after request failure and show localized feedback. | 9b010ceb | Frontend contract regression passed; frontend suite 455/455. |
| SCENARIO-COMPLETION-CONTRACT-001 | Completion records and response differed from the Flutter-compatible contract. | Accept stepOrder/choiceKey and legacy identifiers; return persisted attempt id and scores. | 9b010ceb | Visible completion returned 200 and rendered result; Go/FE contract gates passed. |
| SCENARIO-COMPLETION-VALIDATION-001 | Completion trusted incomplete, duplicate or client-supplied answers. | Validate one answer per step and derive selected choices/points from PostgreSQL. | 9b010ceb | Go integration tests cover complete answer sets and persisted contract. |
| SCENARIO-RESULT-PERSISTENCE-001 | Completion did not reliably persist/display a server-authoritative attempt result. | Persist the DB-derived score and reveal results only after success; allow retry on failure. | 9b010ceb | Visible result 30/30 and GET attempts still showed the saved attempt after refresh. |
| SCENARIO-MAX-SCORE-001 | Maximum score could be inflated by summing all optimal choices or non-optimal point values. | Compute the sum of each step’s highest optimal award. | 9b010ceb | Regression fixture asserts total=10/max=15; local content score-bound query found no violations. |
| SCENARIO-CHOICEKEY-UNIQUE-001 | Database allowed duplicate choice keys within a step. | Add guarded unique index on (step_id, choice_key). | 9b010ceb | Migration duplicate preflight found no local duplicates; duplicate-key integration test passed. |

# FULL PRODUCT BROWSER AUDIT REPORT

## Latest completed screen — Learner Account Settings (2026-10-11)

The legacy /settings/accounts screen now matches the OAuth retirement decision. It retains session-scoped identity list/unlink while removing the Google start link and link-code exchange handler, and reuses the localized linked-account title, explanation, and empty state. Visible browser checks covered the anonymous login gate, authenticated refresh, VI/EN/JA copy, no OAuth requests, and 390×844 layout without overflow. A disposable identity was removed through the visible unlink action (DELETE 204, followed by GET 200). The unlink target is 48px. AUDIT-105 is CLOSED/VERIFIED; harness 263/263, frontend 451/451, typecheck, production build, and independent review passed. Commit: e5a98655.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ACCOUNT-SCREEN-RETIRED-OAUTH-CTA-001 | /settings/accounts still linked to retired Google OAuth routes. | Removed CTA and link-code exchange; retained session identity list/unlink and truthful localized copy. | e5a98655 | Visible anonymous/authenticated, vi/en/ja, 390×844, unlink 204→GET 200; all quality gates pass. |

## Latest completed screen — Learner Linked Accounts (2026-10-11)

The localized linked-account management screen now reflects the retired Google OAuth decision: it keeps existing identity read/unlink behavior and no longer offers the dead Google start or link-code exchange flow. Visible browser checks covered anonymous redirect, authenticated empty state, vi/en/ja copy, and a 390×844 viewport without horizontal overflow. The disposable linked identity was previously rendered in the UI, unlinked through the visible control (DELETE 204), and verified removed from PostgreSQL. AUDIT-104 CLOSED/VERIFIED; harness 263/263, frontend 448/448, typecheck/build passed, and independent review APPROVE (0 findings). Commit: bf2a8829.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LINKED-ACCOUNTS-RETIRED-OAUTH-CTA-001 | Screen linked to OAuth routes explicitly retired by the migration decision. | Remove Google CTA and link-code exchange; explain legacy linked-account management in localized copy. | bf2a8829 | Visible vi/en/ja, no stale CTA/exchange, frontend regression suite. |
| LINKED-ACCOUNTS-MOBILE-UNLINK-TARGET-001 | Unlink control was shorter than the 48px mobile baseline. | Set a 48px minimum target and add a regression assertion. | bf2a8829 | 390×844 and component test. |

## Completed screen — Learner Account Settings (AUDIT-105)

The earlier visible 404 from /api/auth/google/start was fixed in AUDIT-105 commit e5a98655. The screen is now PASS; identity list/unlink remains session-scoped and no retired OAuth route is requested.

## TOMORROW_MORNING_SUMMARY

| Field | Value |
|-------|-------|
| STARTING_GIT_HEAD | c1ac21af48df5de85994ca8e8612a394b8c1a081 |
| FINAL_GIT_HEAD | d4185812 — AUDIT-145 Admin streak and growth campaign APIs. |
| LOCAL_RUNTIME_STATUS | PASS — canonical manager rebuilt AUDIT-145 binary; stable at 0/10/30/60. |
| LOCAL_RUNTIME_START_COMMAND | node scripts/local-audit-up.mjs |
| LEARNER_LOGIN_STATUS | PASS — real learner registration/login through visible forms; session survives refresh. |
| ADMIN_LOGIN_STATUS | PASS — real Admin form, Argon2id verification, HttpOnly session and refresh persistence. |
| LEARNER_REAL_REGISTRATION_PASS | TRUE |
| LEARNER_REAL_LOGIN_UI_PASS | TRUE |
| LEARNER_SESSION_LIFECYCLE_PASS | TRUE |
| ADMIN_REAL_LOGIN_UI_PASS | TRUE |
| ADMIN_SESSION_LIFECYCLE_PASS | TRUE |
| SCREENS_TOTAL | 163 |
| SCREENS_PASS | 68 |
| SCREENS_FAIL | 2 |
| SCREENS_REMAINING | 93 |
| APIS_TOTAL | 627 |
| APIS_PASS | 366 |
| APIS_FAIL | 0 |
| APIS_REMAINING | 261 |
| DEFECTS_FOUND | 327 |
| DEFECTS_FIXED | 323 |
| DEFECTS_REMAINING | 4 |
| COMMITS_CREATED | d4185812 — AUDIT-145 Admin streak and growth campaign APIs; earlier audit commits remain in Git history. |
| LEARNER_STATUS | Login, registration and previously audited learner features PASS; broader learner audit remains open. |
| ADMIN_STATUS | Gamification and Growth Campaigns anonymous/authenticated/mobile states PASS; Gamification anonymous state and broader Admin audit remain open. |
| MOBILE_STATUS | Headed Admin Growth Campaigns at 390×844 PASS without page overflow; learner critical mobile journey remains open. |
| API_STATUS | IN_PROGRESS (366 PASS, 0 FAIL, 261 remaining of 627); next: GET /api/admin/growth/campaigns/audience-estimate. |
| REALTIME_STATUS | Presence WebSocket PASS; battle protocol parity remains open. |
| MEDIA_STATUS | Partial; broader asset/access audit remains pending. |
| PERSISTENCE_STATUS | AUDIT-145 streak and campaign persistence, actor audit, rollback and disposable-fixture cleanup verified. |
| CURRENT_PHASE | API_AUDIT |
| NEXT_ITEM | GET /api/admin/growth/campaigns/audience-estimate |
| EXTERNAL_BLOCKERS | None currently identified; remaining work is locally solvable. |
| FINAL_VERDICT | IN PROGRESS — 93 screens and 261 APIs remain, including 2 known screen failures. |


## Latest completed API wave — AUDIT-122 (2026-10-12)

Three Daily Radar APIs were tested individually. `POST /api/admin/daily-radar/cards/{id}/publish` passed by clicking the real Publish control in the headed Admin UI; Network observed the request and PostgreSQL confirmed published status plus one audit event. `GET /api/admin/daily-radar/modules/{id}` passed with a persisted module, anonymous 401 and missing-ID 404. `POST /api/admin/daily-radar/modules/{id}/archive` passed in the visible same-origin Admin session; PostgreSQL confirmed archived status and audit. Roleless/untrusted-origin writes are denied, and an injected archive audit failure returns 500 with no partial mutation. Fixed publish RBAC/CSRF, schema drift (the daily card has no `published_at`), and both mutations’ audit atomicity. Go 801/801, harness 263/263, no skips, headed browser PASS; runtime stable at 0/10/30/60. Commit: 1bd80504.

## Latest completed API — POST /api/admin/daily-radar/cards/{id}/duplicate (AUDIT-121, 2026-10-12)

The visible authenticated Admin browser sent a same-origin request against a disposable source card and received HTTP 201 with a new draft ID and `duplicatedFrom`. PostgreSQL confirmed all source content was copied, spotlight/pin flags reset, and one audit event committed with the clone; temporary rows were cleaned. Roleless Admin and untrusted Origin are rejected by Go integration tests. The endpoint previously used nonexistent Daily Radar columns and omitted the module relation; its route also lacked content-write RBAC/CSRF and ignored audit-write errors. Go suite 793/793, harness 263/263, headed browser/persistence PASS, independent review APPROVE. Commit: 87949da8.

## Latest completed API — GET /ws/presence (AUDIT-119, 2026-10-12)

The visible learner registration form created a disposable account; its session opened the same-origin presence WebSocket with HTTP 101. Redis showed online and last-seen timestamps refreshed after the heartbeat interval. Integration tests reject anonymous, malformed-session and untrusted-origin upgrades; regressions verify heartbeat refresh, offline after the last connection, reconnect ordering, multi-connection behavior and that another user is not blocked. AUDIT-120 fixed missing service wiring and the reconnect race. Go: 790 passed, 0 failed, 0 skipped, including race, vet and ARM64 build. Independent review: APPROVE. Commit: 0161f396.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| REALTIME-PRESENCE-SERVICE-UNWIRED-001 | HTTP composition omitted PresenceService; final offline write could race a reconnect. | Wire the existing Redis service and serialize connect/disconnect per user; cover heartbeat, cleanup, reconnect and cross-user concurrency. | 0161f396 | Visible browser session and WebSocket 101; Redis heartbeat timestamps refreshed; 790 Go tests, race/vet/ARM64; review APPROVE. |

## Latest completed screen — Learner subscription settings (AUDIT-115, 2026-10-12)

The subscription page previously showed a Plus plan and expired premium entitlement after `current_period_end`. Both the API current-subscription object and plan summary now require the same eligibility as official quiz access: active plan, started current period, unexpired end, and non-expired trial. A visible headed browser session authenticated through the real learner Register form was paired with a verified expired-Plus PostgreSQL fixture; the page rendered Free, issued GET 200, and showed no expired date or premium entitlement. The browser test removes its fixture afterward. Go suite passed 788/788 including race, vet, and ARM64 build; independent review APPROVE. Commit: a2aa1b4b.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| SUBSCRIPTION-PERIOD-END-SUMMARY-001 | Current subscription and plan summary ignored period/trial/plan eligibility. | Apply official quiz eligibility filters to both response paths and cover edge cases with PostgreSQL regressions. | a2aa1b4b | Visible real-session browser with expired-Plus fixture; GET 200, Free UI; Go 788/788; independent review APPROVED. |

## Latest completed screen — Public learner profile (AUDIT-114, 2026-10-12)

The public profile page previously returned 404 because the Go API did not register its profile endpoint. AUDIT-114 adds the optional-session GET contract with allowlisted profile fields, privacy-filtered aggregates and achievements, relationship labels, and presence. Visible headed Chrome verified an anonymous standard profile, login redirect for a protected challenge action, authenticated self profile, copy-link feedback, and missing-profile state. At 390×844 there was no horizontal overflow or console error. Integration tests cover anonymous/self/friend/stranger/blocked visibility, invalid/missing/inactive IDs, and omitted authentication fields. Go suite passed 783/783 including race, vet, and ARM64 build; independent AUTH_SECURITY review APPROVE. Commit: 997591e2.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| PUBLIC-PROFILE-GET-MISSING-001 | Public profile UI called an unregistered API route. | Add optional-session profile route and privacy-filtered PostgreSQL contract. | 997591e2 | Visible anonymous/authenticated 390×844 browser checks; Go 783/783; independent review APPROVED. |

## Latest completed screen — Learner Appearance settings (2026-10-11)

Visible 390x844 browser loaded learner Appearance. Authenticated UI made three preference changes; each PUT /api/auth/me returned 200 and values survived reload. Original test preferences were restored through UI. Isolated anonymous context applied Dark locally, made no PUT, and had no horizontal overflow. Browser error listener reported no errors. Five focused component tests, full 438-test frontend suite, 263 quality-harness tests, build/typecheck/lint debt ratchet, and independent review passed. Commit: bcbafc63.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-APPEARANCE-PERSISTENCE-001 | The learner page called PUT /api/auth/me through the same-origin BFF, but the Next route exported GET only; client reported success for any HTTP response, overlapping writes and initial profile reconciliation could overwrite a newer choice, including during auth restoration. | Added session-cookie/Origin-preserving PUT BFF proxy, show saved only after OK and localized failures, serialize updates, and keep latest local choice through stale profile responses and auth restoration. Added route/component regressions; shrank the existing frontend debt baseline by removing a stale disable warning. | bcbafc63 | Visible authenticated browser PUT 200 and refresh persistence; anonymous local-only and mobile 390x844; 5 appearance component tests, suite_harness 263 and frontend 438, production build/typecheck/debt gate; independent review approved. |

## Latest completed screen — Learner linked account settings (2026-10-11)

The protected `/vi/settings/accounts` screen now loads the authenticated learner’s identities and handles empty, connected, and API-error states. A fresh isolated browser context redirected anonymous access to the localized login URL with the exact return path and sent no identity request. At 390×844, the visible signed-in browser loaded HTTP 200, rendered a disposable Google identity, then the real Unlink action returned HTTP 204; the localized empty state returned and PostgreSQL confirmed the fixture row was gone. The `/settings/linked-accounts` caller shares the repaired API contract. Both callers now parse the API `error` field with a legacy `message` fallback, covered by regression tests. Go 757/757 including race; frontend 436/436, typecheck, lint debt ratchet, production build, and independent review passed. Commit: `81de25b5`.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-LINKED-IDENTITY-API-MISSING-001 | Active linked-account callers hit absent Go GET/DELETE routes and failed responses did not match the UI’s parsed error field. | Added owner-scoped session GET, CSRF-protected owner-only DELETE, and compatible API error rendering in both callers. | 81de25b5 | Visible anonymous redirect; GET 200; UI DELETE 204 and database cleanup; Go ownership/CSRF integration; Go 757 and frontend 436 gates; independent review approved. |

## Latest completed screen — Learner Search History (2026-10-11)

The `/vi/search/history` screen now shows its per-item delete control on touch devices with a visible 44×44px target; desktop keeps the hover refinement. The visible 390×844 browser showed the seven preexisting history items, opened a selected `会議` query in Search, removed one item while retaining the rest, and confirmed Clear all renders the localized empty state. I restored the original seven terms through the real Search form and checked their order. Screenshot inspection confirmed no horizontal overflow and visible remove icons. Commit: `a9eeec5b`. Focused regression, all frontend tests (459/459), debt ratchet, typecheck and production build passed; lifecycle suite accounting remains open because the harness reported fingerprint drift on the preceding AUDIT-100 task.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| SEARCH-HISTORY-MOBILE-REMOVE-001 | Individual remove control was `opacity-0` except on hover, leaving it invisible on touch screens. | Keep the 44×44px control visible by default and retain hover-only opacity on desktop. | a9eeec5b | Visible 390×844 retest; each control opacity=1 and 44×44px; individual remove and clear-all UI actions updated local history as expected; frontend test/typecheck/build/debt ratchet passed. |

## Latest completed screen — Learner Review Inbox preview (2026-10-11)

The protected `/vi/review-inbox-preview` screen now redirects anonymous learners to localized login, distinguishes an empty inbox from load errors, and renders persisted context memos using the fields the card consumes. A real learner session loaded the stored Japanese/Vietnamese memo in visible Chrome at 390x844. Clicking `使えそう` issued a real PATCH request, returned 200, changed the card to `既読`, and the GET response plus page refresh retained `feedback=useful` and `status=read`. The page width equaled the 390px viewport. Two-user PostgreSQL tests prove each learner reads only their own memo; route tests cover session, CSRF, invalid verdict, foreign memo and owner success. Anonymous GET returned 401. Commit: `ad5270c6`.

The final repo gates passed: lifecycle harness 263/263, Go 756/756 (including race, vet, and ARM64 build), frontend 424/424 with no new lint debt, and production builds. Independent review approved after verifying both redirect-state handling and cross-user read isolation.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| CAREER-INBOX-401-EMPTY-001 | The client swallowed 401 and displayed an empty state; loading ended before redirect. | Redirect to login with return path, hold loading during redirect, and show retry on non-auth failures. | ad5270c6 | Visible anonymous redirect; regression asserts no empty-state copy on 401; frontend suite passed. |
| CAREER-INBOX-STORE-SCHEMA-002 | Context memo had no canonical Prisma model/migration; Go suppressed query errors and returned a mismatched DTO. | Add the canonical PostgreSQL model/migration, map typed card fields, and propagate read failures. | ad5270c6 | Migration applied; visible typed memo; Go two-user ownership/read and store-error tests. |
| CAREER-INBOX-FEEDBACK-NOOP-003 | Feedback controls called a no-op callback. | Add learner-session/CSRF protected PATCH with validation and owner-scoped persistence; wire the visible action. | ad5270c6 | Visible 200 feedback persisted after refresh; router tests cover 401/403/400/404/200. |
## Latest completed screen — Learner Register (2026-10-11)

At 390x844, anonymous `/vi/register` presented the complete form with no horizontal overflow. Empty required fields kept the route in place, focused the display-name field, and sent no registration request; earlier browser evidence covers malformed email, short password, mismatch, and duplicate behavior. A fresh disposable account was created through the visible form: the browser observed `/api/auth/register` and `/api/auth/login`, reached localized home/onboarding, and `/api/auth/me` returned 200. Visiting `/vi/register` while authenticated left the public form available and preserved the session. No page errors were captured.

## Latest completed screen — Daily Radar coupon detail (2026-10-11)

The visible anonymous learner route `/vi/radar/coupon-terms` now renders the Vietnamese title with its Japanese subtitle and five structured vocabulary entries, each with reading, meaning, example, level, and usage note. Chrome was inspected at 390x844: no horizontal overflow, no captured page error, and the first vocabulary detail is expanded. Same-origin detail GET returned 200 with the full contract; an unknown slug returned 404; anonymous `/api/auth/me` returned the expected 401. This screen is committed as `cd6f05ee`; the preceding public-card timestamp/DTO fix is `9f2be1b7`. The same screen was also observed previously with the real learner session.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| DAILY-RADAR-COUPON-LOCALE-001 | Japanese text was assigned to `titleVi`; `titleJa` was unset. | Set locale-specific title values in the canonical seed. | cd6f05ee | Seed regression, PostgreSQL persisted row, visible Vietnamese and Japanese headings. |
| DAILY-RADAR-COUPON-EXPRESSIONS-001 | Seed stored no structured expressions consumed by the detail page. | Add five structured expressions with readings, meanings, examples, levels, and notes. | cd6f05ee | Exact seed-object regression and visible five-entry detail list. |
| DAILY-RADAR-LIST-LIMIT-001 | The public list handler defaults to 48 without reading the `limit` query. | Strictly parse and honor 1..100; keep default 48 on invalid input. | 0b2fbfce | PostgreSQL-backed all-variant regression; visible same-origin retest returned 2 for limit=2, 1 for module limit=1, 48 default for zero. |

The public Daily Radar list previously ignored `limit` and always returned 48. AUDIT-096 now strictly accepts 1–100 across unfiltered, module, and category queries and retains the safe default of 48 for malformed or out-of-range values. The complete Go suite passed 754/754, including race, vet, and ARM64 build; the fresh runtime passed 0/10/30/60-second stability, and visible browser retests returned 2, 1, and 48 for the expected queries. Commit: `0b2fbfce`.

## Latest completed screens — Learner Quiz hub and focused session (2026-10-10)

The learner Quiz hub and focused session now use canonical localized template metadata and persisted Go assessment sessions. Reading Assist now loads the learner’s deck picker from the registered `/api/flashcards/decks` route; visible Network capture showed 200 responses and no failed resources. Anonymous access redirects through the real localized login gate. On the visible 390x844 Chrome page, the learner started a published practice test, answered all 21 questions, reached the persisted result/history, refreshed successfully, and saw an unavailable score marker instead of a fabricated 0/800. The focused session hides learner shell chrome. Timed expiry returns the persisted result; official availability uses the canonical subscription entitlement and a separate feature flag.

Quiz completion now records `bjt_quiz` in the same PostgreSQL transaction that marks the assessment session complete, including timeout completion; closing the tab cannot lose progress and the client no longer sends a duplicate progress request. Visible 390x844 completion followed by navigation/refresh retained the incremented task. The Go store uses Prisma’s normalized `daily_study_plan` and `daily_study_task` tables. `LOCAL_RUNTIME_STABLE_60S` passed after canonical API rebuild at 0/10/30/60 seconds. Review fixes now also pass targeted PostgreSQL tests for expired active-session recovery with exactly-once progress, abandoned-session/official-entitlement enforcement on question and answer, and study-goal default-versus-persisted state; the widget regression verifies the first-time choices. The post-fix browser retest passed at 390x844. Runtime stability passed at 0/10/30/60 seconds after the canonical rebuild. The reviewer identified and helped close the official-breakdown entitlement gap. The PostgreSQL regression passes with 403 and no protected content; runtime passed 0/10/30/60 and visible same-build Quiz E2E showed no failed network resources. AUDIT-091 is CLOSED/VERIFIED after all suites and fresh review approval. Code commit: c99f978e867902af2d8d011ba78f6188b87e30de.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-QUIZ-TEMPLATE-DTO-001 | Go DTO fields differed from the UI contract. | Return localized title and section-count fields matching the client contract. | c99f978e | Visible template cards and PostgreSQL metadata regression. |
| LEARNER-QUIZ-EMPTY-TEMPLATE-001 | Template listing counted/returned empty tests. | Exclude templates with no published questions from learner selection. | c99f978e | Go regression verifies the empty template is absent. |
| LEARNER-QUIZ-TIMER-UNIT-001 | time.Duration nanoseconds were cast directly to an integer. | Convert remaining duration to rounded-up integer seconds and clamp at zero. | c99f978e | PostgreSQL timer regression observed failing before fix and passed after; visible 45:00 countdown. |
| LEARNER-QUIZ-FOCUSED-SESSION-CHROME-001 | Active timed questions shared the regular learner shell. | Give the active session a focused route and hide shell chrome/promotional UI. | c99f978e | Visible 390x844 question flow had no chrome, promo or horizontal overflow. |
| LEARNER-QUIZ-UNAVAILABLE-ESTIMATED-SCORE-001 | The view defaulted a nullable estimatedScore to zero. | Show an unavailable placeholder until a real estimate exists; never invent a score. | c99f978e | Visible completed 10/21 result shows —/800; Vitest covers null and available-score formatting. |
| LEARNER-QUIZ-BJT-GUIDE-CONTRAST-001 | Guide copy used insufficient contrast tokens. | Use readable semantic text contrast tokens. | c99f978e | Visible Quiz guide and full frontend verification passed. |
| LEARNER-QUIZ-EXPIRY-RESULT-001 | The Go handler correctly completed the session and returned 409 session expired, while the learner client only attempted result recovery for 403. | Recognize only 409 session expired (and the existing 403 path) and fetch the owner-scoped persisted result; the Go completion transaction records daily progress, while unrelated 409 conflicts retain the error state. | PENDING | Visible 390x844 expiry recovery: a real UI answer received 409 session expired, then loaded GET results 200 and rendered the saved result; PostgreSQL regressions verify the persisted completion and exactly-once study task. |
| LEARNER-QUIZ-OFFICIAL-ENTITLEMENT-001 | The official availability handler queried quiz.official while monetization plans define quiz.official_simulation. | Use the canonical quiz.official_simulation key for the server entitlement query; keep the independent quiz.official_simulation.enabled feature flag gate. | c99f978e | PostgreSQL regression links the canonical entitlement to an active plan/subscription and verifies entitled=true with the expected plan slug; frontend availability fixture now uses canonical entitlement and feature-flag keys. |
| LEARNER-QUIZ-STUDY-PLAN-PERSISTENCE-001 | The Go study-plan store queried a retired JSON schema, and browser-only progress recording could be lost or duplicated independently of completed assessment sessions. | Use Prisma’s normalized plan/task tables and write progress in the same transaction as normal or timed-out quiz completion; remove the duplicate client-side write. | c99f978e | PostgreSQL regressions assert normal completion and both timeout paths persist exactly one task in the server transaction; visible 390x844 completion and refresh retained progress with no separate progress POST. The standalone progress API remains covered; SQL conformance removed four fixed drift entries. |
| LEARNER-QUIZ-READING-ASSIST-DECK-404-001 | The shared annotation component called the retired `/api/decks` path. | Use the registered `/api/flashcards/decks` endpoint. | c99f978e | Visible Network after code reload showed two 200 responses and no resource failures; component regression pins the exact URL. |
| LEARNER-QUIZ-OFFICIAL-BREAKDOWN-GATE-001 | Completed official results still exposed prompts and explanations after access revocation. | Recheck the official feature flag and subscription entitlement before returning a completed breakdown. | c99f978e | PostgreSQL regression proves pre-fix 200 with content, post-fix 403 without prompt/explanation; rebuild/browser retest pending. |
| LEARNER-QUIZ-ACTIVE-SESSION-EXPIRY-001 | GET active returned expired sessions without finalizing their result/progress. | Reuse transactional timeout completion in the active-session route and return completed recovery once. | c99f978e | PostgreSQL regression verifies result recovery, one bjt_quiz task and no duplicate on repeat GET. |
| LEARNER-QUIZ-ABANDONED-OFFICIAL-GATE-001 | Question fetch served abandoned sessions and official gating was only checked at session start. | Reject abandoned status and recheck feature/entitlement before question and answer. | c99f978e | PostgreSQL regressions verify 409 for abandoned question and 403 on official question/answer after feature or subscription revocation. |
| LEARNER-STUDY-GOAL-FIRST-TIME-PICKER-001 | Default study-goal response was truthy without proving a persisted row existed. | Return isSet and render the picker when false. | c99f978e | PostgreSQL API contract and widget regressions verify default unset state, save/re-read and first-time choices. |

Quiz checkpoint: screens 48/163 PASS, 2 FAIL, 113 remaining; APIs 279/621 PASS, 0 FAIL, 342 remaining; defects 228 found, 225 fixed, 3 remaining. Next screen: `learner:/:locale/quiz/print/:id`.

## Latest completed screen — Learner Profile (2026-10-10)

The localized /:locale/profile alias redirects to protected /:locale/me. Anonymous access reached localized Login without profile data. A disposable learner was registered through the visible form; the authenticated overview, four tabs, vi/en/ja aliases, refresh persistence, and 390x844 layout passed. The Profile caller previously requested a nonexistent analytics route and silently displayed zero stats. It now uses the registered learner analytics endpoint and the due-review endpoint; both returned HTTP 200 with expected object and array contracts. No horizontal overflow or Console/window errors appeared. Frontend quality: 415/415 accounted tests passed, typecheck/build passed, and no new lint debt. AUDIT-090 is CLOSED/VERIFIED. Code commit: 0038070d011c644418e0351efa204b7bc61fc90e.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-PROFILE-ANALYTICS-404-001 | Profile requested missing /api/learner/analytics and expected due-card data in that response. | Use /api/analytics/learner for totals and /api/flashcards/reviews/due for the due-card count. | 0038070d | Visible API responses 200; Profile tabs/refresh/mobile passed; frontend suite and production build passed. |
## Latest completed screen — Learner Privacy (2026-10-10)

The public Privacy Policy now links the data-rights section to localized Privacy Settings and the contact section to localized Feedback in Vietnamese, English, and Japanese. Visible Chrome confirmed all five policy sections, both link labels and destinations, and the anonymous Settings login gate with its return target. At 390x844, the document stayed 390px wide and both link targets measured 44px high. Feedback resolved to /vi/feedback. The anonymous shared-session request returned the expected 401 JSON contract; the announcement request returned 200. No browser Console or window errors were captured. Frontend quality gate: 415/415 tests, typecheck/build passed, and no new lint debt. AUDIT-089 is CLOSED/VERIFIED. Code commit: d9e7548f.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-PRIVACY-DATA-RIGHTS-LINKS-001 | Privacy policy data-rights and contact instructions were plain text. | Added locale-preserving Settings and Feedback links with localized accessible touch targets. | d9e7548f | Visible vi/en/ja and 390x844 checks; link destinations, anonymous auth gate, no overflow/errors; frontend suite 415/415. |

## Latest completed screen — Learner Pricing (2026-10-10)

Pricing now reads canonical active plans with entitlements and quota limits, shows the signed-in learner’s current subscription and any pending checkout separately, and reports checkout as pending until payment confirmation exists. Anonymous upgrade controls lead to localized Login and return to Pricing. Failed catalog/session loads have a localized retry. Vietnamese, English and Japanese feature labels follow the selected locale while tier names follow the configured catalog. Checkout writes one pending subscription and one event atomically; repeated requests reuse the existing intent.

The visible browser tested anonymous and authenticated Pricing in vi/en/ja. A real learner used the visible Register/Login forms, initiated the upgrade through the visible Pricing button, and retained pending status after refresh. API checks covered public plan reads (200 with canonical features), anonymous session/checkout rejection (401), session identity isolation, unknown plan rejection (400), authenticated checkout persistence, retry idempotency, and simultaneous current-plus-pending subscription state. At 390x844 all three locales had no horizontal overflow. Runtime passed 0/10/30/60 after rebuilding the API; quality gates passed: harness 263/263, Go 734/734 including race/vet/ARM64, frontend 413/413 with zero new lint debt, typecheck/build, visible-browser gate, and independent review APPROVE (0 findings). AUDIT-088 is CLOSED/VERIFIED. Code commit: 100b0a06684cc68245a2199063cfdcb5e25b043e.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-PRICING-PLAN-FEATURES-001 | Public plans omitted quotas and entitlements; Pricing mapped missing arrays. | Return canonical active-plan features and surface query/scan errors. | 100b0a06 | Visible vi/en/ja rendering; PostgreSQL integration verifies feature values and API 200. |
| LEARNER-PRICING-SUBSCRIPTION-SCOPE-001 | Missing summary route, caller-controlled userId, and noncanonical expiry query broke subscription reads and identity scope. | Read /subscription from session identity, use current_period_end, distinguish empty from operational error. | 100b0a06 | Visible session 200, anonymous 401, spoofed identity isolation, PostgreSQL regression. |
| LEARNER-PRICING-CHECKOUT-REQUEST-001 | Frontend submitted planSlug/userId while API accepts planId and derives user from session. | Submit only the selected plan UUID. | 100b0a06 | Visible UI request and client contract regression. |
| LEARNER-PRICING-CHECKOUT-PERSISTENCE-001 | Checkout SQL used obsolete event columns and never created a subscription intent. | Transactionally persist a session-owned pending subscription and checkout event. | 100b0a06 | Go/PostgreSQL test verifies ownership, pending response/event, anonymous 401 and invalid plan 400. |
| LEARNER-PRICING-CHECKOUT-IDEMPOTENCY-001 | Repeated checkout requests duplicated pending rows and events. | Lock by learner/plan and reuse an existing pending intent. | 100b0a06 | Two POSTs return the same ID; exactly one pending row and event remain. |
| LEARNER-PRICING-CURRENT-PLAN-PENDING-001 | A newer pending upgrade hid the learner’s active plan after refresh. | Return and render active/trialing and pending subscriptions separately. | 100b0a06 | API integration and client regression verify both states together. |
| LEARNER-PRICING-ANONYMOUS-CTA-001 | Anonymous upgrade button did nothing. | Link to localized Login with a Pricing return target. | 100b0a06 | Visible anonymous vi/en/ja routes and locale-preserving links. |
| LEARNER-PRICING-RETRY-ERROR-001 | Failed plan/session loads had no reliable retry path. | Show localized operational error and retry control. | 100b0a06 | Client regression verifies 503, retry, and recovered catalog. |
| LEARNER-PRICING-LOCALE-COPY-001 | Feature/quota labels were Vietnamese across locales and English used the wrong plan display-name field. | Use locale-aware labels and the configured display name for the active locale. | 100b0a06 | Visible vi/en/ja audit and localized component tests; no untranslated keys. |

## Latest completed screen — Learner Loto hub (2026-10-10)

The protected Loto hub passed its anonymous redirect, authenticated learner session, and 390x844 states in Vietnamese, English, and Japanese. A disposable learner registered and logged in through the real forms; `/api/auth/me` remained 200 after refresh. Loto6/Loto7 selection issued the matching feed and next-draw requests. Valid feed, next-draw, and stats requests returned their documented empty-data contracts; invalid game values returned 400. PostgreSQL integration tests exercise populated generated-run fixtures, pagination, published-only selection, and database failures with cleanup. English/Japanese pages no longer show untranslated Vietnamese announcement copy, while Vietnamese retains its existing promotion. Frontend suite 404/404, production typecheck/build, Go suite 730/730 including race/vet/ARM64, and independent review passed. Commit: `9ef79f89a5f537338262520819e0e512bf2ce2e4.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-MAGAZINE-LOTO-FEED-CONTRACT-001 | Loto feed contract did not match its caller and failed to enforce pagination/operational errors. | Return the paginated UI DTO, clamp page/limit, and propagate database iteration failures. | 9ef79f89 | Visible valid/invalid requests; PostgreSQL disposable feed/pagination/error tests; Go 730/730. |
| LEARNER-MAGAZINE-LOTO-NEXT-DRAW-CONTRACT-001 | Query referenced a nonexistent column and could select drafts or runs with no selected set. | Query the canonical schema and select only published generated runs with selected sets; return the empty `nextDraw: null` envelope. | 9ef79f89 | Visible 200/400 contracts; PostgreSQL published/selected-run fixture. |
| LEARNER-MAGAZINE-LOTO-STATS-ERROR-CONTRACT-001 | Database failures were converted into successful zero totals. | Validate game and surface PostgreSQL failures as 500. | 9ef79f89 | Visible 200/400; PostgreSQL failure regression expects 500. |
| LEARNER-ANNOUNCEMENT-LOCALE-LEAK-001 | Shared banner used the legacy Vietnamese message on EN/JA pages without translations. | Render the exact locale title and hide untranslated announcements outside VI. | 9ef79f89 | Visible vi/en/ja at 390x844; component regressions and frontend suite 404/404. |

## Latest completed screen — Learner login (2026-10-09)

The localized learner login screen passed its anonymous, authenticated, and 390x844 states. On the visible browser, empty and malformed email submissions were blocked by native validation; an incorrect password produced localized feedback after POST /api/auth/login returned 401. A disposable local learner was created through the visible Register UI, logged out, then signed in through the real Login form. The browser received /api/auth/me 200 and returned to /vi/exercises; a full refresh kept the authenticated session. Opening /vi/login while signed in left the public form accessible. Logging out through the UI returned /api/auth/me to 401. Vietnamese, English, and Japanese copy rendered; mobile document width remained 390px with 50px inputs and a 48px submit target. No page or captured console errors appeared. The anonymous /api/auth/me 401 is expected.

The login screen has no unresolved defect. POST /api/auth/login remains REMAINING in the one-by-one API inventory until its dedicated response-contract and unauthorized-behavior audit is recorded.

## Latest completed screen — Learner BJT level detail (2026-10-09)

The J1 level screen now reads established level definitions, published lessons, saved learner completion, and active canonical vocabulary/kanji/grammar rows. The three top-level content totals count canonical data available to the tabs rather than empty lesson-item links. All five previously missing read APIs now return their expected contracts. No canonical vocabulary, kanji, or grammar record was created, edited, or deleted.

Visible anonymous and authenticated browser sessions rendered the level; the real learner flow completed a lesson, navigated back, refreshed to confirm saved progress, then uncompleted it and cleaned up. The tabs rendered 30 rows each; Japanese vocabulary/kanji searches and exact visible grammar-pattern search worked, and no-result states were localized. At 390x844 all four views had no horizontal overflow. Independent reviews found and fixed six backend defects: public lesson-list registration depended on optional learner sessions; public reads lacked limits; Caddy clients shared one RemoteAddr bucket; nested read DTO fields did not match the learner contract; J1+ aliased N1 data; and Linux Docker Caddy lacked a trusted peer identity. All six GET routes now use a 120/minute normalized-client-IP/per-operation bound, trust forwarded IP only from loopback or an explicitly configured trusted proxy, and fail closed when the dedicated limiter is absent. PostgreSQL tests verify independent proxy client buckets, direct-header spoof resistance, 429 and 503. Final runtime passed 0/10/30/60; Go full/race including PostgreSQL, vet and ARM64 build; frontend 382/382, typecheck/build; Chromium E2E 6/6. Two further reviewer findings were fixed: J1+ no longer aliases N1 master rows, and Linux Docker rate limiting trusts only the statically assigned Caddy proxy /32. Their regressions were observed failing before the fixes and pass afterward. Race testing exposed a host/container clock-skew flake in an unrelated Go SRS fixture; the test now uses a fixed past timestamp. Final Go 718/718 including race, vet, ARM64; frontend 382/382, typecheck/build; Docker config; latest runtime 0/10/30/60; and Chromium smoke 6/6 all pass. Lesson list summary counts now use the same active canonical-content projection as lesson detail: inactive and missing linked IDs are omitted. PostgreSQL regression observed 3/3/3 before the fix and verifies 1/1/1 plus exactly three active detail items afterward. Final same-fingerprint quality gates passed: Go 718/718 including race, vet and ARM64; frontend 382/382, typecheck/build, lint debt-ratchet with zero new debt; Compose validation; runtime 0/10/30/60; canonical-origin Chromium smoke 6/6. Independent review APPROVE (0 findings); AUDIT-080 CLOSED/VERIFIED. Implementation commit: `cce5c0392b4ac95315a1363c845ea48ba0255db9`. Next screen: `learner:/:locale/levels`.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-BJT-LEVEL-DETAIL-API-001 | Level metadata/lesson and canonical-reference handlers were missing; the UI counted only curriculum links, and exact visible grammar search failed on duplicate stored whitespace. | Added read-only Go endpoints for level metadata, lessons and canonical reference tabs; display master counts and normalize whitespace for grammar search. | cce5c039 | Visible anonymous/authenticated J1, all tabs/search/empty states, saved completion refresh and cleanup, 390x844; PostgreSQL API tests, Go full/race/vet/ARM64 and frontend 382/382 pass. |
| LEARNER-BJT-LEVEL-SESSIONLESS-ROUTE-001 | Public lesson-list route registration depended on optional learner session storage. | Register the public route unconditionally and keep only optional identity enrichment conditional. | cce5c039 | PostgreSQL integration returns the public lesson list without a session store; full Go suite and 0/10/30/60 runtime stability pass. |
| LEARNER-BJT-PUBLIC-READ-RATE-LIMIT-001 | Public level APIs had no per-client request bound. | Apply 120/minute per normalized client-IP/per-operation limiting; fail closed without the dedicated limiter. | cce5c039 | Integration verifies 429, direct-peer spoofed X-Forwarded-For resistance and 503 when dedicated limiter is absent; full Go suite and stable runtime pass. |
| LEARNER-BJT-PUBLIC-READ-PROXY-IP-001 | API keyed RemoteAddr directly, so every Caddy client shared the proxy bucket. | Use normalized forwarded client IP only when the direct peer is a trusted proxy. | cce5c039 | Integration verifies distinct loopback clients get separate buckets; Linux Docker Caddy is configured as an exact trusted /32 on an isolated edge network. |
| LEARNER-BJT-LEVEL-NESTED-DTO-001 | New reference queries emitted internal JSON names that differed from the established learner DTO. | Align nested vocabulary, kanji and grammar keys with the client contract. | cce5c039 | PostgreSQL integration verifies pos/meaningVi, component/meaningVi, word/reading/meaningVi, and explanationVi; targeted test GREEN. Full gates and review pending. |
| LEARNER-BJT-LEVEL-J1PLUS-ALIAS-001 | J1+ used the N1 and kanji-level-1 filters. | Return no reference rows until canonical above-N1 data exists. | cce5c039 | Regression failed before fix with [N1]/level 1; PostgreSQL test now verifies zero J1+ counts and empty tabs. |
| LEARNER-BJT-LEVEL-DOCKER-PROXY-RATE-LIMIT-001 | Loopback-only proxy trust caused Docker Caddy requests to share a bridge-peer bucket. | Pin Caddy to a dedicated static edge IP and trust only its /32 from the API. | cce5c039 | Go tests verify independent client buckets and spoof resistance; Compose validates; Go 718/718, runtime 0/10/30/60 and Chromium smoke 6/6 pass. |
| LEARNER-BJT-LESSON-SUMMARY-ACTIVE-COUNTS-001 | Summary counted link rows even when canonical content was inactive or missing. | Join canonical lexeme/kanji/grammar rows with active status and count those projections, matching lesson detail. | cce5c039 | PostgreSQL RED before fix (3/3/3), targeted GREEN after (1/1/1); detail omits inactive/missing rows. Go 718/718 incl. race/vet/ARM64; frontend 382/382/typecheck/build; Compose; runtime 0/10/30/60; Chromium smoke 6/6; independent review APPROVE (0 findings). |
## Latest completed screen — Learner BJT levels index (2026-10-09)

The learner level index now loads the shared public collection and renders canonical counts for all six BJT levels. Level names, descriptions, assessment prompts, readiness labels, and analytics states follow the selected vi/en/ja locale. Anonymous analytics 401 is treated as an empty learner history; server/network failures have a separate localized error. The Home Progress section uses the same collection API. Vocabulary, kanji, and grammar remain read-only.

Visible fresh anonymous Chrome returned 401 for auth/me and learner analytics while GET /api/levels returned 200; all six levels rendered and the no-history state remained visible. The existing authenticated Chrome session returned 200 for auth/me and analytics, and selecting J4 opened /vi/levels/J4. English and Japanese views showed localized copy and six locale-preserving links. At 390x844 the anonymous screen had no horizontal overflow (390px document width); all six cards were reachable. A route-specific Playwright check now repeats that mobile flow, asserts the six links and API 200, and rejects failed requests, unexpected responses, page errors, and console errors while permitting only expected anonymous 401s. The Home Progress tab also loaded the collection. The smoke suite defaults to one worker because concurrent Admin dev-route compilation corrupted Next's shared prerender manifest; serial execution passed all 7 tests and the manifests remained valid.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-BJT-LEVELS-LIST-API-001 | Learner levels and Home Progress called an unregistered GET /api/levels. | Added a rate-limited public collection returning six localized levels and active canonical counts. | 782c8caf | PostgreSQL RED/GREEN; visible anonymous API 200; mobile Playwright observed 200 and rendered six links. |
| LEARNER-BJT-LEVELS-LOCALIZATION-001 | The index used Vietnamese metadata and hard-coded English assessment/readiness text for all locales. | Render locale-specific metadata and move page copy into vi/en/ja messages. | 782c8caf | Visible vi/en/ja pages and locale regressions pass. |
| LEARNER-BJT-LEVELS-ANALYTICS-ERROR-001 | Analytics failures were silently rendered as empty history. | Separate expected anonymous 401 from other HTTP/network failures and localize both states; suppress the empty-history prompt when history cannot be loaded. | 782c8caf | Regression distinguishes 500 from empty history and hides the assessment prompt; anonymous/authenticated browser flows pass. |

## Latest completed screen — Learner Help (2026-10-09)

Help now has 48px FAQ disclosure and contact-link targets without replacing native disclosure or keyboard behavior. In a fresh anonymous visible Chrome context, vi/en/ja pages rendered localized titles, four FAQs, and the correct Feedback link; opening an FAQ by click/Enter worked, and the contact link opened /vi/feedback. At 390x844 the document stayed 390px wide with no horizontal overflow; all targets measured at least 48px.

The English subtitle spacing, answer capitalization, and contact-label case are fixed. Vietnamese copy now promises only the feedback channel the page provides. Frontend 378/378, typecheck, ESLint debt-ratchet, production build and independent reviews pass. AUDIT-077 and AUDIT-078 are CLOSED/VERIFIED.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| HELP-MOBILE-TOUCH-TARGETS-001 | FAQ summaries were 24px and the contact link 36px high on mobile. | Give native summaries and the contact link a 48px minimum target. | 821216c9 | Visible Chromium at 390x844: summaries 48px minimum, link 48px, no overflow; keyboard Enter opens FAQ. |
| HELP-EN-COPY-001 | English subtitle spacing, answer capitalization and button label were malformed. | Corrected localized copy. | d9ebb2a9 | Copy regression, visible English route and full frontend gate pass. |
| HELP-VI-CONTACT-CHANNEL-001 | Vietnamese copy advertised an email address the page did not provide. | Promise only the feedback route. | d9ebb2a9 | Anonymous Vietnamese page and locale regression pass; reviewer approved. |

Checkpoint: screens 35/162 PASS, 2 FAIL, 125 remaining; APIs 243/606 PASS, 0 FAIL, 363 remaining; defects 177 found, 174 fixed, 3 remaining. Next screen: learner:/:locale/levels/:level/lessons/:slug.


## Latest completed screen — Learner Feedback (2026-10-09)

Feedback now accepts anonymous and authenticated submissions through the visible form and persists them in PostgreSQL. The isolated anonymous Chrome context submitted the form; the browser observed HTTP 201 and localized success. The stored disposable rows were verified and removed. At 390x844, the page had no horizontal overflow and its input, select, and submit controls measured 48px.

The form now validates the saved-response contract, prevents duplicate pending submits, associates labels, explains rate limiting in all locales, and uses corrected English confirmation copy. Verification: Go 700/700 including race; frontend 373/373; typecheck, lint debt-ratchet, production build, independent review, and local runtime 0/10/30/60 passed. AUDIT-076 is CLOSED/VERIFIED.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-FEEDBACK-PERSISTENCE-001 | Feedback form had no real Go API or durable PostgreSQL persistence. | Added public POST /api/feedback with validation, rate limiting and transactional persistence in ops.feedback_submission. | 4a6c18b1 | Visible anonymous and learner UI submissions returned 201 and persisted; disposable rows were deleted; Go PostgreSQL integration tests pass. |
| LEARNER-FEEDBACK-FORM-ACCESSIBILITY-001 | Visible fields did not have reliable programmatic labels. | Associated every field with an explicit label/id. | 4a6c18b1 | Visible browser confirmed all four field labels; frontend regression passes. |
| LEARNER-FEEDBACK-DUPLICATE-SUBMISSION-001 | The form allowed repeated submission while a request was pending. | Added pending state and disabled duplicate submission until completion. | 4a6c18b1 | Component test submits once under repeated activation; frontend gate passes. |
| LEARNER-FEEDBACK-SUCCESS-CONTRACT-001 | Any successful 2xx response could be rendered as saved feedback without requiring the endpoint contract. | Show success only for HTTP 201 and preserve the form on other responses. | 4a6c18b1 | UI regression confirms HTTP 200 is not presented as persistence success; visible POST returned 201. |
| LEARNER-FEEDBACK-RATE-LIMIT-GUIDANCE-001 | HTTP 429 had no localized actionable feedback. | Added dedicated rate-limit copy in English, Japanese and Vietnamese. | 4a6c18b1 | Component regression verifies 429 guidance; all three locale messages typecheck/build. |
| LEARNER-FEEDBACK-MOBILE-TARGETS-001 | Compact form controls were below a usable mobile touch size. | Set the input/select/submit controls to at least 48px high. | 4a6c18b1 | Visible 390x844 inspection measured 48px controls and no horizontal overflow. |
| LEARNER-FEEDBACK-EN-COPY-001 | English confirmation copy was ungrammatical. | Corrected the confirmation sentence. | 4a6c18b1 | English copy regression passes; production build passes. |

Checkpoint: screens 34/162 PASS, 2 FAIL, 126 remaining; APIs 243/606 PASS, 0 FAIL, 363 remaining; defects 174 found, 171 fixed, 3 remaining. Next screen: learner:/:locale/help.



## Latest completed screen — Learner Explore (2026-10-09)

Explore now shows the full active vocabulary, kanji, and grammar catalog counts from a single read-only Go endpoint. The catalogs remain canonical and complete; this endpoint adds no content mutation controls. A fresh anonymous browser context and a real learner session both rendered the page; the authenticated request returned 252,175 vocabulary entries, 5,787 kanji, and 2,149 grammar points. Dark-theme cards remain readable, the totals ribbon wraps at 390x844 without horizontal overflow, and the browser recorded no page or console errors.

The full-suite run also exposed a learner-day boundary mismatch in Exercises progress. The handler now uses the learner's stored IANA timezone and a half-open day range, with UTC fallback for invalid timezones. PostgreSQL regressions cover both midnight boundaries and the fallback.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| EXPLORE-CONTENT-TOTALS-CONTRACT-001 | Explore treated paginated list payloads as total-count objects and displayed zero. | Add a read-only active-catalog summary endpoint and validate its response. | 0a4a12fe | Visible anonymous/authenticated request HTTP 200 with exact totals; PostgreSQL active/draft contract passes. |
| EXPLORE-STATS-MOBILE-CLIPPING-001 | The totals ribbon clipped on narrow viewports. | Wrap totals and hide desktop dividers on mobile. | 0a4a12fe | Visible 390x844 layout has no horizontal overflow; all discovery links remain available. |
| EXPLORE-DARK-CARD-CONTRAST-001 | Light-gradient cards had pale surfaces under white text in dark theme. | Add dark gradient, border, and icon surfaces. | 0a4a12fe | Visible dark-theme review and component regression pass. |
| EXERCISE-DAILY-PROGRESS-LOCAL-DATE-001 | PostgreSQL grouped completion by UTC date while the API used the host-local date. | Query the user's local calendar day with timezone-aware bounds; invalid zones fall back to UTC. | 0a4a12fe | Non-UTC boundary and invalid-timezone PostgreSQL tests pass; Go 697/697 incl. race; browser API 200. |

Checkpoint: screens 33/162 PASS, 2 FAIL, 127 remaining; APIs 242/605 PASS, 0 FAIL, 363 remaining; defects 167 found, 164 fixed, 3 remaining. Next screen: learner:/:locale/feedback.

## Latest completed screens — Learner password recovery (2026-10-08)

The localized forgot-password and reset-password screens now complete the full real recovery journey. The browser submitted the actual form, received the localized email through Mailpit, cleared the emailed fragment token from the page URL, rejected mismatched confirmation, changed the password transactionally, revoked the old session, then logged in with the new password through the real UI. Reusing the consumed token returned 400. Both screens passed visible 390x844 checks with no page errors or horizontal overflow. PostgreSQL-backed outbox, SMTP delivery, Go race suite and full frontend suite passed.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-PASSWORD-RESET-TOKEN-LOG-001 | Reset bearer token could reach recovery logging or responses. | Keep raw token only in delivery; persist only its hash and keep logs token-free. | 87881102 | Go handler regression and visible reset response passed. |
| LEARNER-PASSWORD-RESET-SESSION-ATOMICITY-001 | Credential update and old-session revocation were not guaranteed as one transaction. | Consume token, change password and revoke sessions atomically. | 87881102 | PostgreSQL rollback/concurrency tests passed; old browser session returned 401. |
| LEARNER-PASSWORD-RESET-SMTP-ACK-001 | Nested in-memory SMTP queue could acknowledge before delivery failed. | Await real transport delivery in the durable worker. | 87881102 | Localized SMTP delivery regression and Mailpit browser flow passed. |
| LEARNER-PASSWORD-RESET-OUTBOX-DURABILITY-001 | API restart could lose in-memory recovery work. | Persist bounded work in PostgreSQL with leases and retries. | 87881102 | PostgreSQL worker restart/capacity integration passed. |
| LEARNER-PASSWORD-RESET-PUBLIC-URL-001 | Missing public URL could generate localhost links; external HTTP was unsafe. | Require explicit WEB_PUBLIC_URL and HTTPS for external origins. | 87881102 | Config RED/GREEN and SMTP URL tests passed; 60-second runtime stable. |
| LEARNER-PASSWORD-RESET-CLIENT-TOKEN-LIFECYCLE-001 | React effect replay/hash changes or stale requests could lose/replace the one-time token. | Retain the fragment through lifecycle replay and ignore responses for obsolete tokens. | 87881102 | Component regressions and visible success/replay flow passed. |
| LEARNER-PASSWORD-RESET-RETRY-BOUND-001 | An expired worker claim could exceed its retry ceiling. | Discard already exhausted claims before token or email work. | 87881102 | PostgreSQL exhausted-claim regression passed. |

Checkpoint: screens 31/162 PASS, 2 FAIL, 129 remaining; APIs 235/603 PASS, 0 FAIL, 368 remaining. Defects: 154 found, 151 fixed, 3 unresolved. Next: `learner:/:locale/exercises`.

## Latest completed screen — Learner Daily Standup (2026-10-08)

Anonymous requests no longer see the prototype Career RPG identity or rank. The real career endpoint's 401 redirects through localized Login with a returnTo value. A disposable learner registered through the visible UI, received a real session, set a Japanese work name through the screen, and saw it persist after navigating away and back. Expired-session clock-in now clears career state and redirects instead of entering the story flow. The visible 390x844 page had no horizontal overflow; frontend tests/build and independent review passed.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-DAILY-STANDUP-MOCK-IDENTITY-001 | Anonymous 401 left a client prototype profile/rank visible on the screen. | Removed the fallback provider and render private data only after the real career API responds; redirect anonymous 401. | dac6552a | Anonymous visible browser redirected to login; authenticated real API profile and persisted name verified. |
| LEARNER-DAILY-STANDUP-CLOCK-IN-SESSION-EXPIRY-001 | Clock-in's finally block navigated even when the request failed with 401. | Clear session-bound state, send the learner to Login, and navigate to the chapter only after a successful clock-in. | dac6552a | Regression tests prove 401 redirects and no chapter navigation; all 351 frontend tests and production build passed. |

Daily Standup checkpoint: screens 28/161 PASS, 2 FAIL, 131 remaining; APIs 229/603 PASS, 0 FAIL, 374 remaining. Defects: 144 found, 141 fixed, 3 unresolved. Next: learner:/:locale/decks/shared/:token.

## Latest completed screen — Learner Career (2026-10-08)

The Career route now consumes the persisted Go CareerMe contract and canonical rank rows; anonymous visits show localized login recovery, while partial or empty datasets stay honest. A real learner submitted a Japanese work name through the visible Daily Standup onboarding form; the greeting and Career card updated, and the name remained after refresh. The real 390x844 Career screen had no horizontal overflow or browser errors. The browser regression uses the real Career components, asserts GET method/path pairs, verifies missing skill values and empty-rank messaging.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-CAREER-GET-CONTRACT-001 | The page expected nested CareerMe data and could fall back to prototype state. | Normalize flat Go data and render only persisted learner state. | 48bcef95 | Anonymous 401/localized recovery; real learner GET 200 and refresh; contract tests and visible browser pass. |
| LEARNER-CAREER-PROFILE-DEMO-DEFAULTS-001 | New profiles had fictional name/company defaults. | Remove fake store/schema defaults and read ranks from canonical seeded rows. | 48bcef95 | Migration deploy, PostgreSQL integration, 8 persisted ranks shown; canonical language datasets untouched. |
| LEARNER-CAREER-PARTIAL-SKILL-ZEROS-001 | Missing skill measurements rendered as zero. | Show unavailable markers and omit the radar polygon for incomplete measurements. | 48bcef95 | Component regression and 390x844 browser E2E pass. |
| LEARNER-CAREER-RANKS-EMPTY-001 | Empty rank API response silently removed the rank ladder. | Add localized empty-rank state. | 48bcef95 | Empty-list component assertion and browser E2E pass. |
| LEARNER-CAREER-NAME-ONBOARDING-CONTRACT-001 | Blank profiles did not prompt; flat PATCH responses did not update parent state. | Prompt only for blank names and normalize PATCH through the shared Career adapter. | 48bcef95 | RED/GREEN API tests; actual visible form updated greeting/card; refresh retained name and dismissed the prompt. |

Career checkpoint: screens 25/161 PASS, 2 FAIL, 134 remaining; APIs 224/599 PASS, 0 FAIL, 375 remaining. Defects: 138 found, 135 fixed, 3 unresolved. Go 658/658; frontend 344/344; harness 263/263; independent review APPROVE. Next: learner:/:locale/daily/:id.

## Latest verified repair — Learner flashcard library and generation (2026-10-08)

The authenticated learner library now reads canonical `learning.deck`; create/detail/archive and AutoGen use matching API contracts. AutoGen filters active canonical vocabulary, kanji and grammar by level, and reverse-direction decks use private variants without changing source content. Visible browser verification ran at 390x844; anonymous-state verification remains open.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-CARDGEN-DIRECTION-PREVIEW-001 | Cardgen preview ignored the requested Japanese/Vietnamese direction. | Apply the selected direction to preview samples and generated cards without mutating canonical content. | PENDING | Visible preview verified both directions; generated cards use private variants. |
| LEARNER-CARDGEN-TRAILING-JSON-001 | Cardgen request decoding accepted valid JSON followed by trailing data. | Require EOF after the single decoded request value. | PENDING | Regression test rejects trailing JSON; Go Cardgen integration passes. |
| LEARNER-FLASHCARD-REVIEW-DUE-CARD-CONTRACT-001 | Due review API returned SRS metadata without the nested card content required by ReviewSession. | Join active flashcard variants and return the canonical nested card DTO. | PENDING | Visible review loaded Japanese text/reading and submitted successfully; contract integration passes. |
| LEARNER-FLASHCARD-REVIEW-EVENT-PERSISTENCE-001 | Review submission omitted required previous_due_at and next_due_at columns. | Read previous due under row lock, calculate the next schedule, and persist both timestamps atomically. | PENDING | Visible review persisted across navigation/refresh; PostgreSQL contract asserts review event and schedule. |
| LEARNER-FLASHCARD-DECK-CANONICAL-STORE-001 | Learner deck store referenced nonexistent learning.flashcard_deck instead of canonical learning.deck. | Use Prisma-owned learning.deck fields for list/create/update/archive/share/clone/generate and return library DTO fields. | PENDING | Visible list/create/archive passed; canonical-schema integration CRUD passes. |
| LEARNER-FLASHCARD-DECK-API-UI-CONTRACT-001 | Deck composer sent titleVi/cards/visibility while Go create/update handlers accepted only name/description, so deck data was not persisted. | Accept the learner composer contract and transactionally link personal card variants without editing canonical vocabulary/kanji/grammar. | PENDING | Visible create/list/detail/archive succeeded; PostgreSQL contract verifies one persisted Japanese/Vietnamese card. |
| LEARNER-FLASHCARD-DECK-DETAIL-ROUTE-001 | Deck detail UI requested /api/decks/{id}, a route absent from Go, and received 404. | Register owner/public-safe GET /api/flashcards/decks/{deckId} with ordered cards and update the caller. | PENDING | Visible detail rendered 1-card test deck and 20-card generated deck; integration contract passes. |
| LEARNER-FLASHCARD-AUTOGEN-LEVEL-DIRECTION-001 | AutoGen sent level/cardCount, expected total, and omitted required name; backend ignored level and direction. | Align payload/response fields and filter active canonical vocabulary, kanji and grammar by level; reverse only private card variants. | PENDING | Visible numeric preview and 20-card Vietnamese→Japanese deck passed; Go tests cover N5/J5 and all three sources. |
| LEARNER-FLASHCARD-DECK-OWNER-WRITE-001 | CreateCardFromContent could add a card to a private deck owned by another learner. | Verify active deck ownership in the same transaction before creating/linking a variant. | PENDING | PostgreSQL regression confirms cross-user write returns ErrNotOwner without card creation. |
| LEARNER-FLASHCARD-SHARE-TOKEN-ENTROPY-001 | Share tokens were predictable timestamps. | Generate 256-bit URL-safe tokens with crypto/rand. | PENDING | Share/clone CRUD integration passes using the generated token. |

## Latest verified repair — Learner Cardgen (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-CARDGEN-GENERATION-CONTRACT-001 | Preview was a placeholder; generate targeted a nonexistent table and returned the wrong shape. | Read active canonical vocabulary/grammar/kanji data; transactionally create a private deck, variants, SRS rows and completed job. Canonical source rows are never modified. | PENDING_CARDGEN_COMMIT | Visible 390x844: previews for all three content types and topic “会社”; empty-topic HTTP 400 shown in UI; generate 20 cards, navigate away/refresh, 20 due cards persisted. Go PostgreSQL integration asserts preview no-write and generated persistence. 259 frontend tests, 632 Go tests, harness 263 tests, lint/build all pass. |
| LEARNER-ANNOUNCEMENT-MODAL-BLOCKS-CARDGEN-001 | Globally queued promo dialogs covered learner actions and opened another dialog after dismiss. | Show at most one modal on the locale home route per visit. | PENDING_CARDGEN_COMMIT | Regression test and visible Cardgen UI show no modal; home dismissal does not queue another. |

Cardgen screen and both Cardgen API methods PASS. Counts: 17/161 screens PASS, 202/590 APIs PASS; next screen: `learner:/:locale/career`. Canonical vocabulary, kanji and grammar rows remain unchanged.

## Latest verified repair — Learner Analytics (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ANALYTICS-GO-STUDY-STATS-CONTRACT-001 | The UI expected `dailyActivity` and treated omitted range fields as real empty metrics, while Go returns `dailyStats` and all-time totals. | Render localized study minutes/XP/sessions, retain rolling-window boundary dates, fill inactive days, and hide unsupported summaries. | 08012dbd | Visible anonymous redirect + API 401; real learner 7/30/90 and refresh API 200; fixture values displayed then deleted; 390x844 no overflow; 244 frontend tests and production build passed; independent review approved. |

Checkpoint: screens 9/161 PASS, 0 FAIL, 152 remaining; APIs 188/588 PASS, 0 FAIL, 400 remaining. Next item: `learner:/:locale/battle/match`.

## Latest verified repair — Admin Learning Paths (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-LEARNING-PATHS-MOBILE-OVERFLOW-001 | Wide table expanded the page on mobile. | Constrain the table within a horizontal scroller. | 7811907f | Visible 390px viewport; document width remained 390px. |
| ADMIN-PAGE-HEADER-CHILDREN-HIDDEN-001 | Shared header discarded action controls passed as children. | Render child controls in the shared action region. | 7811907f | Visible create action and render regression tests pass. |
| ADMIN-LEARNING-PATHS-DETAIL-RESPONSE-001 | Save response was rendered as full detail before audit history loaded. | Reload persisted detail after create/update. | 7811907f | Visible create/update, detail reload and audit history passed. |
| ADMIN-LEARNING-PATHS-RBAC-001 | Learning Path routes lacked per-route content permissions and write CSRF checks. | Enforce content.read for GET and content.write plus CSRF for mutations. | 7811907f | Visible CRUD passed; integration matrix proves anonymous 401, roleless 403, authorized persistence/audit. |
| ADMIN-LEARNING-PATHS-LOCALE-VALIDATION-001 | Missing validation labels and placeholder EN/JA strings. | Complete Learning Paths locale strings. | 7811907f | Focused validation and locale regressions pass. |
| ADMIN-LEARNING-PATHS-REFRESH-FALSE-FAILURE-001 | Detail reload failure could report a persisted write as failed. | Handle detail errors independently from mutation success. | 7811907f | Regression tests cover HTTP/network reload failures; visible browser confirmed a transition network error toast without mutation. |
| ADMIN-LEARNING-PATHS-MISSING-ROW-404 | PATCH/archive ignored affected-row count and could audit a missing target. | Return 404 and atomically persist mutation plus audit. | e881f20e | PostgreSQL test confirms 404 and no audit for missing UUID. |
| ADMIN-LEARNING-PATHS-TRANSITION-ERROR-SILENT | Non-2xx/network errors in status/delete actions were invisible. | Parse API errors and show a localized toast. | e881f20e | Regression test, Admin typecheck/build pass; CSRF checks deny missing/untrusted Origin. |

Screen status: PASS — anonymous gate, authorized Admin workflow, CRUD persistence, desktop/mobile layout. Learning Paths API methods individually verified: 8 PASS. Counts: 8/161 screens PASS, 188/588 APIs PASS, 117 defects found and fixed. Next screen: learner:/:locale/analytics.
## Latest verified repair — Learner account alias (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-ACCOUNT-MOBILE-TABS-OVERFLOW-001 | Intrinsic tab widths made the last profile tab extend beyond the 390px viewport. | Use four equal columns, compact labels, and 48px-high touch targets on mobile; retain the desktop flex layout. | b08c4a21 | Visible 390x844 browser: all four 48px-high tabs fit inside the 358px row and document width stays 390. Playwright Chromium checks row/label overflow at 390px in vi/en/ja; anonymous smoke and focused regression pass. Anonymous /account redirects to localized login; authenticated real learner data survives refresh. |

Account screen status: PASS. Canonical vocabulary, kanji, and grammar datasets were not modified. Counts: 8/161 screens PASS, 188/588 APIs PASS, 117 defects found and fixed. Next screen: learner:/:locale/analytics.

## Latest verified repair — Admin Kanji (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-KANJI-STROKE-FILTER-001 | Kanji content list omitted `strokeCount`; list and summary ignored stroke-count bounds. | Project the canonical stroke count and apply validated, parameterized min/max filters consistently to list and aggregates. No canonical content was added, edited or deleted. | 53366773 | Visible Admin anonymous redirect, authenticated catalog and 390×844 view passed. Filter counts min10/max10/exact10/level1/no-result/reset: 9,961/4,162/1,030/1,243/0/13,093, matching PostgreSQL. Both GET APIs returned 200; console clean. Go suite 595 passed, 6 expected skips; independent review approved. |

Kanji screen: PASS. Screen counts 4/161 PASS, 157 remaining; API counts 178/588 PASS, 410 remaining. Defects 104 found, 104 fixed. Next: `admin:/admin/:locale/learning/competencies`.

## Latest verified repair — Admin Dictionary (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-CONTENT-READ-PERMISSION-001 | Content list and summary GET routes had no `admin.content.read` middleware. | Enforce permission at both Go route groups. | 58627b8f | Browser logout/direct route redirects to Admin login; integration checks anonymous 401, roleless 403, authorized 200. |
| ADMIN-LEXEME-READING-FILTER-001 | Dictionary list ignored the reading query although summary applied it. | Parameterized `reading ILIKE` list predicate. | 58627b8f | Visible list and summary both returned the single fixture for its reading; malicious-looking filter remains parameterized in test. |
| ADMIN-LEXEME-EXAMPLES-SCHEMA-CONTRACT-001 | Example CRUD used columns/DTO shape absent from canonical `lexeme_sense_example` and `example_sentence` schema. | Persist/link canonical examples and audit transactionally; project linked examples back into lexeme list. | 58627b8f | Visible POST 201, PATCH 200, DELETE 200; integration tests verify DB state and audit. |
| ADMIN-LEXEME-SHORT-MEANING-DTO-001 | Lexeme list omitted `shortMeaningVi`, so edit form could not prefill the existing value. | Include field in list projection. | 58627b8f | Regression test and rebuilt visible edit form show persisted “Nghĩa sửa audit”. |
| ADMIN-DICTIONARY-MOBILE-OVERFLOW-001 | Wide lexeme table expanded the mobile document instead of staying in a bounded scroll region. | Bound the table wrapper and contain its layout. | 58627b8f | At 390×844, document scroll width is 390; table scrolls inside a 356px wrapper. |

Dictionary screen complete: anonymous, authorized Admin, desktop and mobile states PASS. Per-route evidence is in `FULL_API_INVENTORY.json`. Counts: 3/161 screens PASS; 178/588 APIs PASS; 103 defects found and fixed. Next screen: `admin:/admin/:locale/learning/competencies`.

## Latest verified repair — Admin Daily Radar card create (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-DAILY-RADAR-CARD-CREATE-001 | POST used retired `title/summary/module_key` storage/payload and lacked write permission middleware; audit failure was ignored. | Accept the live CardRow DTO, persist canonical fields and audit atomically, reject duplicate/missing module inputs, and enforce admin.content.write + CSRF. | — | Real visible Admin form POST 201, UI row refreshed, PostgreSQL card/audit matched; roleless real-session POST 403; fixtures and temporary role removed. |

## Latest verified repairs — Admin Daily Radar cards and modules (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-DAILY-RADAR-CARDS-LIST-001 | Joined list used ambiguous/unqualified filters, selected/scanned the wrong fields, ignored limit, and returned a DTO unlike the UI contract. | Use typed joined query/filters, canonical fields, paging and fail closed on SQL errors. | — | PostgreSQL regression passed; rebuilt visible Admin page rendered the persisted disposable card with its Vietnamese title and module key; same-origin GET 200, no browser errors; fixture removed. |
| ADMIN-DAILY-RADAR-MODULE-LIST-001 | List filtered against nonexistent columns and emitted legacy key/title fields, leaving Admin table cells blank. | Query canonical status/title/module_key columns, return the typed camelCase client DTO and surface DB errors. | — | Canonical PostgreSQL RED/GREEN passed; rebuilt visible page displayed module key/title/category/enabled/status; filtered GET 200; fixture removed. |

## Resolved visible retest — Admin Daily Radar archive (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-DAILY-RADAR-CARD-ARCHIVE-001 | Archive lookup used ambiguous `status`, the route lacked `admin.content.write`/CSRF guards, and its audit insert was non-atomic. | Require content-write permission and CSRF; validate ID; lock/update the canonical card and write its audit row in one transaction; distinguish 404 from database errors. | — | Focused real-router PostgreSQL tests pass for roleless 403/no mutation, authorized archive plus exactly one audit row, and missing-ID 404. Full suite_go (578 pass, 6 expected skips), race and ARM64 pass. Visible Admin archive action returned HTTP 200 and the follow-up card GET/UI showed `archived`; disposable card/module/audit rows were removed and verified absent. |

Checkpoint 2026-10-07 09:11 JST: runtime stable for 60 seconds. Screen counts remain 0/161 pass and 161 remaining; API counts remain 167/588 pass and 421 remaining. Next item remains the visible archive retest.

## Latest verified repair — Admin companion tip list errors (2026-10-06T15:33:37.925Z)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-COMPANION-TIPS-LIST-SCAN-ERROR-001 | The list handler silently discarded row scan failures and never checked iteration errors, allowing partial results to appear successful. | Log and return HTTP 500 on scan/iteration failure. | — | Latest rebuilt runtime stable 0/10/30/60s; visible companion UI loaded 15 items; authenticated GET 200 and anonymous GET 401; SQL conformance PASS. |

## Latest verified repair — Admin Support Notes (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-SUPPORT-NOTES-MISSING-TABLE-001 | Go queried absent `admin.support_note`; route lacked permission checks; response did not match the UI's audit projection contract. | Store immutable note events in canonical `ops.admin_audit_log`; enforce server-side read/write RBAC and visibility; validate input; audit list reads. | — | PostgreSQL Go tests cover 403, both POST routes, persistence, UI DTO, private/team/audit_only scope, invalid input and audit. Visible Admin list/create passed; note details survived reload. Runtime stable at 0/10/30/60 seconds after rebuild. |

Current source inventory remains 161 screens and 588 method+path APIs. Support Notes' authenticated screen state passed; its anonymous/mobile states and the other 160 screens remain. API checkpoint: 165 PASS, 0 FAIL, 423 remaining; 161 screens remain. Current next API: GET /api/admin/daily-radar/cards/{id}.

## Latest verified repair — Persist public ad click events (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADS-CLICK-DROPPED-001 | Mounted `/api/ads/click` handler logged a stub and returned 204 without persistence; its TODO referenced a nonexistent table. | Persist click events in canonical `monetization.ad_impression`, require an active placement, validate optional campaign-to-placement association, and return errors on unavailable persistence. | — | Visible learner-origin POST returned 204 and PostgreSQL confirmed event/context; inactive/missing placement returned 404; `suite_go`: 499 passed, 6 allowed skips, race and ARM64 build passed. Runtime supervisor rebuilt and restarted API. |

## Latest verified repairs — Public Ads learner flow (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADS-CLICK-DROPPED-001 | Mounted click handler only logged a stub and referenced a nonexistent table. | Persist `click` in canonical `monetization.ad_impression`; validate active placement and campaign association; fail when persistence fails. | — | Visible learner AdSlot click persisted campaign/locale/device; disposable event removed after verification. PostgreSQL integration, 502 Go tests, race and ARM64 build passed. |
| ADS-DECISION-LEGACY-CONTRACT-001 | Decision handler returned static `showAd=false`, incompatible with the learner `AdSlot` response and ignored active campaign configuration. | Query active placements, enabled providers, eligible approved campaigns, locale/date/plan/limit constraints and return the frontend contract with a safe destination. | — | Visible home rendered the local storefront campaign; real decision response matched `AdSlot`; integration cases passed for no match, inactive placement, draft, rejected and locale mismatch. |

## Latest verified repair — Persist public ad impression events (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADS-IMPRESSION-DROPPED-001 | Mounted impression handler only logged a stub and returned 204 without persistence. | Validate placement/campaign, bounded payload and persist `kind=impression` in `monetization.ad_impression`. | — | Same-origin learner-page POST returned 204; PostgreSQL confirmed event, campaign and context, then disposable row removed. Integration test covers persistence and invalid requests; suite_go 503 passed, 6 allowed skips, race and ARM64 passed. The automatic IntersectionObserver event was not observed because the attached tab reports hidden. |

## Latest verified repair — Learner analytics identity isolation (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ANALYTICS-USER-IDOR-001 | Authenticated learner analytics trusted caller-controlled `userId` query input. | Scope the shared analytics handler to `LearnerGuard` identity in request context. | — | Visible browser GET with spoofed and omitted `userId` returned the actual session identity and HTTP 200; anonymous request returned 401 in integration test; contract and empty console errors verified. |

Current checkpoint: 113 APIs PASS, 0 FAIL, 475 remaining; 161 screens remain; 44 defects found, 43 fixed, 1 known pre-existing defect remains. Next item: `GET /api/analytics/heatmap`.

## Latest verified repair — Learner analytics and heatmap (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ANALYTICS-USER-IDOR-001 | `/api/analytics` trusted the query-string userId despite authenticated learner context. | Query analytics using LearnerGuard identity. | — | Visible browser spoofed and normal requests returned current session ID; anonymous 401 regression passed. |
| ANALYTICS-HEATMAP-USER-IDOR-001 | Heatmap trusted caller-controlled userId. | Scope SQL to learner session identity. | — | Disposable second-learner study record was excluded; browser progress tab showed only current learner fixture. |
| ANALYTICS-HEATMAP-CONTRACT-001 | API returned sparse `{heatmap,date,minutes}` while `LearningHeatmap` expected 365-day `days` plus streak/activity metrics. | Return the UI DTO from PostgreSQL session aggregates; guard empty state. | — | Visible Progress tab rendered 1 active day and streak 1 from disposable data; fixture removed and empty state rechecked; 504 Go tests, 6 allowed skips, race and ARM64; web typecheck passed. |

Checkpoint: 116 APIs PASS, 0 FAIL, 472 remaining; 161 screens remain. Defects: 49 found, 48 fixed, 1 pre-existing remains. Next: `POST /api/announcements/{id}/dismiss`.

## Latest verified repair — Learner analytics days validation (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ANALYTICS-LEARNER-DAYS-ERROR-001 | Invalid or out-of-range `days` caused a database query failure that was returned as HTTP 200 with empty analytics. | Accept only integer days 1–365 (default 7), use integer interval parameterization, and return errors for query/scan failures. | — | Visible learner session returned the normal contract; spoofed userId ignored; days=0/366/abc returned 400. DB-backed isolation test passed; suite_go: 506 passed, 6 expected skips, race and ARM64 passed. |

Checkpoint: 116 APIs PASS, 0 FAIL, 472 remaining; 161 screens remain; 48 defects found, 47 fixed, 1 remains. Next `POST /api/announcements/{id}/dismiss`.

## HISTORICAL BASELINE (superseded counts)

The anonymous learner results and 107-screen/179-API counts below are from an earlier run and are retained only as historical notes. Current source inventory is `FULL_SCREEN_INVENTORY.json` (161 routes) and `FULL_API_INVENTORY.json` (588 method+path entries); current verdicts live in `FULL_PRODUCT_AUDIT_STATE.json`.

## ANONYMOUS LEARNER AUDIT RESULTS — HISTORICAL

| Check | Result | Notes |
|-------|--------|-------|
| Page loads | ✅ PASS | http://localhost:18081/vi returns 200 |
| Title correct | ✅ PASS | "Trang chủ học tập — KotobaWorks" |
| ReadyState | ✅ PASS | complete |
| Nav items present | ✅ PASS | KotobaWorks, Trang chủ, Lộ trình BJT, Luyện tập, Ôn tập, Tiến độ |
| Login link present | ✅ PASS | hasLoginLink=true |
| Body content length | ✅ PASS | 1420 chars rendered |
| Console errors | ⚠️ EXPECTED | 401 Unauthorized on protected API (expected for anon) |
| API health/live | ✅ PASS | 200 via Caddy→Go |
| API daily-radar/home | ✅ PASS | Returns data |
| API nhk-news | ✅ PASS | Returns data |
| API announcements | ✅ PASS | Returns data |

## HISTORICAL DEFECTS LOG

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| D-001: 401 on protected endpoint during anon load | Expected behavior — anon user hitting auth-gated API | No fix needed — correct server-side enforcement | N/A | N/A |

## HISTORICAL RUNTIME SNAPSHOT

| Service | Port | Status |
|---------|------|--------|
| Caddy (reverse proxy) | 18081 | LISTENING |
| Learner Web (Next.js) | 3000 | LISTENING |
| Admin Web (Next.js) | 3001 | LISTENING |
| Go API | 4001 | LISTENING |
| PostgreSQL | 15432 | HEALTHY |
| Redis | 6379 | HEALTHY |
| Meilisearch | 7700 | RUNNING |
| Chrome CDP | n/a | External Chrome CDP was unavailable; the Codex visible browser remained available |

## HISTORICAL INVENTORY REFERENCES

- `FULL_SCREEN_INVENTORY.md` — 107 screens (20 learner + 87 admin)
- `FULL_API_INVENTORY.md` — 179 API endpoints across 20 domains
- `FULL_PRODUCT_AUDIT_STATE.md` — Machine-readable audit state JSON

## PREVIOUS NEXT-PHASE NOTES (superseded)

1. Create learner account via real UI login flow
2. Authenticate and audit all 20 learner screens
3. Audit all 179 APIs one-by-one with proper auth tokens
4. Audit Admin login + all 87 admin screens
5. Audit realtime (WebSocket battle/presence)
6. Audit media upload/stream
7. Fix any defects found
8. Re-run regression
9. Update this report with final counts


## Historical recovery run 2026-10-05 (superseded)

Prior report is historical and is not accepted as evidence for this run. Starting HEAD: c1ac21af48df5de85994ca8e8612a394b8c1a081. Preserve pre-existing Admin/proxy edits and untracked tools.

| Service | Mode | Start | Host endpoint | Container endpoint | Dependency/health |
|---|---|---|---|---|---|
| PostgreSQL | Compose | docker compose up -d --wait postgres | 127.0.0.1:15432 | postgres:5432 | pg_isready; API readiness |
| Redis | Compose + existing native listener | docker compose up -d --wait redis | localhost:6379 (native listener also present) | redis:6379 | PONG; API readiness |
| Meilisearch | Compose | docker compose up -d --wait meilisearch | localhost:7700 | meilisearch:7700 | /health |
| Go API | supervised native compiled binary | node scripts/local-audit-up.mjs | :4001 | n/a | PostgreSQL, Redis, /health/ready |
| Learner Next | supervised native | same launcher | [::1]:3000 | n/a | visible /vi; unrelated IPv4 owner preserved |
| Admin Next | supervised native, basePath /admin | same launcher | [::1]:3001 | n/a | /admin/vi/login |
| Caddy | supervised native, generated config | same launcher | localhost:18081 | n/a | /health |
| Media | Go LocalFS | MEDIA_BASE_PATH set by launcher | tmp/local-audit/media | n/a | Go initialization confirmed |

Routing: browser localhost:18081 → Caddy → /api/* and /ws/* to Go4001; /admin/* to Admin3001 preserving basePath; other routes to learner3000. Runtime uses published host database ports, not Compose service hostnames. Native Go does not load dotenv itself; supervisor passes repo .env and explicit local HTTP overrides. Both bypass flags are disabled.

Stability: 0/10/30/60-second checkpoints all passed; raw evidence tmp/local-audit/stability.jsonl. No application crash/restart loops. Logs and parent terminal PID are retained.

Auth: visible register201 → login200; valid/wrong learner login200/401; real logout observed. Acceptance remains pending because cached auth context stays anonymous after client navigation, then authenticated home crashes on malformed recommendation envelope. Vietnamese auth copy and password confirmation defects reproduced. No login bypass used.

Historical phase: AUTH_DEFECT_REPAIR. Those defects were repaired and real Admin authentication subsequently passed. The current phase and inventories are recorded below.

## Current recovery checkpoint — 2026-10-06 (Asia/Tokyo)

The full source inventories now contain 161 active route screens and 588 unique API method+path entries. All rows remain individually visible in the JSON files; the audit is still open. At this checkpoint 12 APIs have explicit PASS verdicts, 0 complete screens, and no unresolved defect from 11 repaired waves. Counts are derived from the inventories and obey the total/pass/fail/remaining invariants.

The local startup command is `rtk proxy node scripts/local-audit-up.mjs`. The runtime uses Compose PostgreSQL/Redis/Meilisearch with host-published ports, a native supervised Go API and two native Next servers, with Caddy on `localhost:18081`. After the M6 RBAC/audit repair and Go rebuild, the 0/10/30/60-second stability checks all passed again. Evidence: `tmp/local-audit/stability.json` and `tmp/local-audit/api.log`.

Learner registration and login have passed through the actual visible forms, including the mismatch/short-password and wrong-password cases. The same learner tab stayed signed in after a real browser refresh. Admin superuser and roleless actors both logged in through the visible form with Argon2id verification. The roleless dashboard showed RBAC 0 and visible same-origin actor list/create requests returned backend 403. The superuser dashboard survived API rebuild with 51 RBAC permissions. The learner onboarding Skip action closed its real dialog; its completion survived refresh in PostgreSQL.

Sixty-six API method+path items have individual PASS records in `FULL_API_INVENTORY.json`, including auth, onboarding, IAM, Admin analytics, and growth/Battle/learning/search/system retests. The remaining 522 APIs and all 161 screens still need individual verdicts. Mobile, media, realtime, full RBAC role matrix, and full persistence journeys remain open; do not report overall completion.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| Learner auth copy/confirmation/redirect | Auth screens omitted localized confirmation/error handling and accepted unsafe redirect targets | Restored localized validation and safe same-locale return targets; refreshed Go auth context after login | — | Learner auth regression suite and visible real registration/login/refresh |
| Authenticated home feed crash | Study feed endpoint returned the wrong shape and no real lesson rows | Query published lessons and return the typed items/meta envelope | — | Go DB integration tests and visible 504-candidate/8-recommendation home |
| Admin auth feedback and redirect | Stale Keycloak-specific copy and auth error normalization/redirect handling | Localized native-auth errors and kept Admin login within `/admin` | — | Admin login regression suite and visible successful/wrong-password flows |
| Admin actor permissions absent | `/api/admin/me` returned an empty placeholder | Resolve actual actor roles and effective RBAC permissions | — | Go RBAC tests and visible dashboard shows 51 permissions |
| Admin navigation/logout escaped basePath | Shared navigation and logout links omitted `/admin` | Resolve links and logout through Admin basePath and locale | — | Admin shell regression tests and visible logout/return link |
| Admin access-denied sign-out escaped basePath | Access-denied page linked to root `/auth/logout` | Route through `/admin/auth/logout?locale=…` | — | Source regression plus Admin logout flow |
| Admin health card used a nonexistent API path | Dashboard requested `/api/health/ready` while Go serves `/health/ready` | Corrected readiness caller | — | Admin overview regression and visible readiness card |
| Onboarding APIs queried columns absent from Prisma schema | Questionnaire fields were stored in `learner_onboarding`, which only contains lifecycle state | Save profile preferences plus current level/topics; transactionally persist onboarding completion in canonical tables | — | 3 PostgreSQL integration tests; visible Skip and refresh; migration deployed |
| Prisma migration history looked empty | Prisma CLI defaulted to `public`, while this project tracks migrations in `content` | Ensure migration URL defaults to `schema=content` | — | Status showed only the new migration pending; deploy succeeded |
| Admin executive analytics returned plausible zeros from invalid SQL | Handler ignored SQL errors, used nonexistent tables/columns and counted sessions instead of distinct users | Query canonical profile/study/quiz/review/event/content tables, fail on database errors, report no-data honestly | — | Go PostgreSQL endpoint test; visible HTTP 200 contract with actual local counts |
| Admin IAM routes lacked permission checks and mutation audits | M6 used AdminGuard+CSRF only; actor/status/role writes had no durable audit record | Require `iam.manage`; write create/status/grant/revoke snapshots in the same transaction without credential fields | — | Roleless real Admin UI login then visible GET/POST 403; current Go binary produced password-free live audit events for create/status/grant/revoke; full Go/race gates passed |
| Growth analytics returned false empty data | Config targeted nonexistent `gamification.xp_event`; XP is persisted in `learning.study_session` | Aggregate `xp_earned` by `started_at`, group by `mode`, expose unsupported streak metric as unavailable, and surface breakdown SQL errors | — | Visible Admin breakdown matched PostgreSQL empty source; fixture integration verified summary, daily series and mode breakdown with 42 XP; quality RED/GREEN passed |
| Battle analytics breakdown returned false empty data | `learning.battle_session` has `started_at`, not `created_at`; query errors were ignored | Use canonical `started_at` and return database errors instead of empty rows | — | Visible Admin GET 200 matched PostgreSQL source; export and RBAC route regression tests passed |
| Learning analytics breakdown returned HTTP 500 | `learning.study_session` has `started_at` and `mode`, not `created_at` and `subject` | Point summary, completion timeseries and mode breakdown at persisted session fields | — | Focused PostgreSQL integration test verifies all learning KPIs, completion series, and one mode row; visible Admin retest matched PostgreSQL empty state |
| Learning analytics showed a valid zero average with no sessions | Empty SQL average was coerced to 0 and exported as available | Mark average duration unavailable until at least one session exists | — | PostgreSQL test checks populated/empty states; visible summary and CSV show null/blank with available=false |
| Search analytics breakdown fails | Configuration used nonexistent `analytics.search_query_log`; canonical events live in `analytics.analytics_event` | Filter and aggregate the canonical `content_search_submitted` events, group by source, and mark click-through untracked | — | Visible authenticated search analytics requests returned truthful empty/unsupported states; PostgreSQL fixture verifies persisted event metrics and export |
| System analytics breakdown fails | Config points to nonexistent `analytics.event`; the canonical source is `analytics.analytics_event` | Read event records from the canonical table and make error rate unavailable without a tracked error contract | — | PostgreSQL fixture verifies summary, daily events, event-name breakdown and CSV; visible breakdown/export/refresh/summary/timeseries all pass |

Current validation completed:

- Learner/Admin auth, navigation, and overview regression tests: 66 passed.
- Onboarding PostgreSQL integration tests: 3 passed against the canonical disposable schema.
- Admin executive analytics PostgreSQL integration test passed; it no longer skips in short mode.
- Admin IAM route tests passed; Go verification passed 457 tests, 6 expected skips, race, vet and ARM64 build; harness passed 263 tests.
- `pnpm --dir packages/database exec prisma validate --schema prisma/schema.prisma` passed.
- `pnpm exec prisma migrate status` identified only `20261006100000_onboarding_profile_preferences` as pending; `pnpm exec prisma migrate deploy` applied it successfully.
- `rtk proxy node scripts/local-audit-status.mjs --stable`: PASS at 0, 10, 30, and 60 seconds after the latest API rebuild.

NEXT_ITEM: Consolidate Wave 6 targeted tests, then select the next 20 remaining APIs

| Admin analytics CSV placeholders and missing backend RBAC | Export handler emitted fixed placeholder/zero rows and silently accepted malformed JSON; analytics routes only checked for an Admin session | CSV exports now project canonical summary/timeseries/breakdown responses, reject malformed/unsupported requests, and analytics routes enforce reader/manage permissions | — | PostgreSQL integration tests PASS; visible Admin same-origin browser received genuine CSV and HTTP 400 invalid-input responses; 0/10/30/60 runtime stability PASS |

| Analytics refresh falsely returned accepted without a durable row | Handler inserted into a nonexistent relation, used noncanonical columns, ignored the write error and still returned 202 | Persist requests in analytics.rollup_run using Prisma-defined columns, return runId, reject malformed input and surface persistence failures | — | Visible Admin 202 plus PostgreSQL row verification; focused integration test GREEN |

| Analytics freshness never reflected refresh state | Summary queried nonexistent analytics.analytics_rollup_run and ignored the database error | Query analytics.rollup_run, propagate status/completion timestamp and return 500 for database failures | — | Integration and visible Admin retest showed status=accepted from the durable canonical row |

| Flashcard analytics hid real reviews | Config pointed at nonexistent learning.flashcard_review_session; timestamps/dimensions did not match learning.review_event | Use review_event.reviewed_at/rating/elapsed_ms and count persisted events | — | PostgreSQL integration test verified one review in summary, daily series and rating group; visible endpoint matches genuine empty data |

| Flashcard analytics falsely marked empty KPIs available | Metrics defaulted available, retention was not derived from ratings, and duration fallback targeted KPI 4 | Derive retention and elapsed duration from review_event; mark unsupported/empty metrics unavailable | — | PostgreSQL fixture verified values and empty-state semantics; visible Admin CSV reflects unavailable fields honestly |

| ANALYTICS-EVENT-INGESTION-001 | Handler rejected the single event and wrote to nonexistent table while returning accepted | Validate, transactionally persist into analytics.analytics_event, expose write failures | — | PostgreSQL tests and visible POST/summary/breakdown/timeseries/export all passed on rebuilt stack |



| ASSESSMENT-MOCK-EXAM-DUPLICATE-LOSS-001 | Duplicate saved only the exam header and the mutation route had no content-write RBAC check | Transactionally clone sections, questions and options with fresh IDs; require `admin.content.write` plus CSRF and persist audit | — | Canonical PostgreSQL test verified section/question/option copying and 401/403 enforcement; visible Admin API returned nine ordered sections; duplicate was deleted and verified 404; source remained published |
| ASSESSMENT-MOCK-EXAM-PUBLISH-ATOMICITY-001 | Publish discarded status-update and audit insert errors, potentially reporting success without persistence | Wrap status update and audit write in one transaction; return 500 on any write/commit failure | — | PostgreSQL regression forced status update failure and verified HTTP 500, unchanged draft, and no publish audit; visible real Admin session published a disposable exam, GET confirmed published status and audit reason; both disposable records were removed and verified absent |
| QUESTION-BANK-CREATE-PARTIAL-001 | Create bound JSON tags to PostgreSQL `text[]`, then ignored option/audit write errors outside a transaction | Bind tags as `[]string`; atomically write question, options, and audit; surface failures as HTTP 500 | — | Canonical PostgreSQL success and forced option/audit failure tests pass; visible Admin POST returned full persisted detail with tags/options/audit; disposable question removed |
| QUESTION-BANK-SECTION-FK-001 | Local `bjt_question.section_id` FK pointed to empty legacy `bjt_section` despite API/Prisma using `bjt_test_section` | Add a data-preserving correction migration; validate FK when there are no orphaned question rows | — | Local migration deployed with zero pre-existing questions/orphans; FK now targets `bjt_test_section` and `convalidated=true`; visible create returned HTTP 200 |
| QUESTION-BANK-RBAC-001 | AdminGuard and CSRF were the only barriers on question-bank mutations | Require `assessment.manage`; suggestion edits accept `assessment.review` or `assessment.manage` | — | Go PostgreSQL route tests verify 403 without the relevant permission; visible superuser create/update/delete/suggest calls succeeded |
| QUESTION-BANK-TAGS-CONTRACT-001 | List/detail/patch/bulk treated Prisma PostgreSQL `text[]` tags as JSON bytes/JSONB | Read and write tags with PostgreSQL string arrays and array operations | — | Go DB regression plus visible list/detail/PATCH/bulk-tag/bulk-untag readbacks verified arrays and audit events |
| QUIZ-SESSION-DETAIL-001 | Nullable score caused false 404 and answer lookup used stale columns | Nullable score scan plus canonical test/answer/question/options/audit joins, computed breakdown and propagated errors | — | Go PostgreSQL regression and visible authenticated same-origin Admin GET returned HTTP 200 with stored nullable score and answer |

## Latest durable checkpoint — 2026-10-06

Runtime stability passed at 0/10/30/60 seconds after the latest API rebuild. Visible Admin tests covered Question Bank list/create/detail/update/suggest/bulk tag+untag/delete and quiz-session listing; those fixtures are cleaned. Migration deploy repaired the local FK without existing question rows to remap. API inventory is 84 PASS / 0 FAIL / 504 REMAINING; screens are 0 PASS / 0 FAIL / 161 REMAINING (authenticated quiz-session screen state passed). Defects are 35 found / 34 fixed / 1 remaining. Quiz-session list and detail both pass through the visible Admin UI with persisted answers. Runtime stability passed at 0/10/30/60 seconds after the latest Go API rebuild.


| QUIZ-SESSION-LIST-NULL-SCORE-001 | List hid persisted sessions with nullable estimated score; nullable test time also caused scan failure | Scan nullable values into nullable Go fields; join test metadata and surface query/scan/iteration errors | — | Go PostgreSQL regression GREEN; visible Admin list row and detail drawer showed persisted answer/breakdown, list/detail HTTP 200 |


### Latest completed API and screen verdicts (2026-10-06T03:42:59.000Z)

- PASS — [GET /api/admin/assessment/quiz-sessions ]: real Admin UI displayed a persisted completed session with null score as an em dash; detail drawer showed saved answer and breakdown.
- PASS — authenticated state for [admin:/admin/:locale/assessment/quiz-sessions ]: route, table, row and details inspected in visible browser. Anonymous/mobile states remain open.
- Fix — [QUIZ-SESSION-LIST-NULL-SCORE-001 ]: list now handles nullable score/test time and returns joined test metadata; database count, scan and iteration errors are surfaced as HTTP 500 rather than silently dropping rows.

- PASS — POST /api/admin/assessment/quiz-sessions/{id}/abort: actual authenticated same-origin browser returned 200 for completed-session noop; Admin detail confirmed durable audit and unchanged status. Missing credentials returned 401 and a too-short reason returned 400.

| QUIZ-SESSION-ABORT-UPDATED-AT-001 | Abort failed because quiz_session has no updated_at; audit writes were ignored | Lock and transactionally update status/completed_at with audit, removing updated_at | — | PostgreSQL regression GREEN; visible Admin confirmation returned 200, persisted abandoned status/audit; 401 and 400 paths verified |

| QUIZ-SESSION-EXTEND-TIME-001 | Extension failed because updated_at is absent and seconds were bound as text | Typed integer × interval; transactionally update started_at and audit | — | PostgreSQL regression GREEN; visible Admin request returned 200 and persisted +120 seconds plus audit |

- PASS — POST /api/admin/assessment/quiz-sessions/{id}/abort: visible Admin confirmation changed the active fixture to abandoned; table/detail showed persisted status and audit actor/reason. Unauthorized requests returned 401; a short reason returned 400.

- PASS — GET /api/admin/assessment/quiz-templates: visible Admin page rendered six persisted templates; non-existent search returned empty state; unauthenticated visible-browser request returned 401.

## Quality gates — 2026-10-06

Go canonical suite PASS (497/497, six expected skips, race and ARM64 build); harness suite PASS (263/263); frontend suite PASS (typecheck, debt ratchet, 243 tests and both production builds); visible Support Notes browser check PASS. The only open AUDIT-023 gate is independent review because the reviewer OAuth session expired and refresh failed.


## Latest verified repair — Learner announcements (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ANNOUNCEMENT-LIST-STUB-001 | Public Go endpoint returned a static empty list and ignored active notices in PostgreSQL. | Query active, currently scheduled all/free announcements from content.announcement; return the learner strip DTO and surface database failures. | — | Visible learner page fetched six persisted announcements and rendered the greeting banner. Integration verifies DTO and active/date filtering; suite_go 507 passed, 6 expected skips, race and ARM64 passed. |

Checkpoint: 117 APIs PASS, 0 FAIL, 471 remaining; 161 screens remain; 49 defects found, 48 fixed, 1 remains. Next: `POST /api/auth/change-password`.


## Latest verified repair — Learner announcement dismissal (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ANNOUNCEMENT-DISMISS-ROUTE-SHADOW-001 | Earlier static route shadowed the PostgreSQL handler; the DB handler was registered a second time without optional learner session context or CSRF middleware. | Keep one route behind optional learner-session resolution and CSRF; surface DB failures instead of claiming persistence. | — | Real authenticated learner clicked the visible banner close control; POST 200 returned persisted=true and PostgreSQL confirmed the per-user row. Integration verifies idempotency and anonymous behavior. Go suite 513 passed, 6 expected skips, race and ARM64 passed; visible browser_e2e passed. |

Checkpoint: 117 APIs PASS, 0 FAIL, 471 remaining; 161 screens remain; 49 defects found, 48 fixed, 1 remains. Next: `POST /api/auth/change-password`.


## Latest verified API — Learner password change (2026-10-06T07:19:02.808879+00:00)

POST /api/auth/change-password passed through a real authenticated browser session. Wrong current password and anonymous session returned 401; valid change returned 200, updated the Argon2id credential and revoked the old session in PostgreSQL. The actual visible login UI rejected the old password, accepted the new one, and stayed authenticated after refresh. Current API coverage: 118/588 PASS, 0 FAIL, 470 remaining. Next: `GET /api/admin/audit`.


## Latest API finding — Admin audit RBAC (2026-10-06T07:20:53.351377+00:00)

`GET /api/admin/audit` is temporarily FAIL: visible authenticated Admin with no roles or permissions received 200 and saw 59 records; anonymous request received 401. Go route enforces Admin session only, but lacks `viewer.audit`/`iam.manage`. Root-cause repair and visible retest are active. Coverage: 118 PASS, 1 FAIL, 469 remaining.


## Latest repair — Admin audit RBAC (2026-10-06T07:30:08.442567+00:00)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-AUDIT-ROLELESS-ACCESS-001 | API route used AdminGuard without audit-read permission enforcement. | Require `viewer.audit` or `iam.manage` for GET /api/admin/audit. | — | Visible roleless Admin receives 403, no records render, anonymous receives 401; integration confirms both authorized permissions return the paginated 200 contract. Go suite 514 passed, 6 expected skips, race/vet/gofmt/ARM64 passed; runtime stable at 0/10/30/60. |

Current API coverage: 119/588 PASS, 0 FAIL, 469 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 50 found, 49 fixed, 1 remaining. Next: `GET /api/admin/battle/abuse`.


## Latest API finding — Admin Battle Abuse list (2026-10-06T07:35:47.253367+00:00)

`GET /api/admin/battle/abuse` is temporarily FAIL: visible Admin session with no roles/permissions loads the page and receives 200; anonymous receives 401. Navigation declares `iam.manage` or `support.user.read`, while the route only checks Admin session. DB currently has zero reports. Regression fix is underway. Coverage: 119 PASS, 1 FAIL, 468 remaining.


## Latest repair in progress — Admin Battle Abuse read RBAC (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-BATTLE-ABUSE-ROLELESS-READ-001 | The list and detail GET routes allowed any authenticated Admin session. | Require `iam.manage` or `support.user.read` for both read routes. | — | Valid RED and GREEN Go DB integration tests pass: anonymous 401, roleless 403, authorized roles 200 with list contract. Browser, complete Go suite and stable-runtime retest are next. |


## Additional Battle Abuse defects — 2026-10-06

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| BATTLE-ABUSE-SYSTEM-REPORT-NULL-REPORTER-001 | List DTO dropped valid system reports when nullable reporter_id failed string scanning. | Nullable reporterId DTO. | — | Visible roleless browser receives 403 and anonymous 401; PostgreSQL fixture returns the counted row with reporterId=null for both authorized permissions; suite_go and 0/10/30/60 runtime checks pass. |
| BATTLE-ABUSE-DETAIL-DTO-MISSING-001 | Detail response omitted description/evidence and treated NULL reporter as missing report. | Return missing fields and accept nullable reporterId. | — | Visible roleless browser receives 403 and anonymous 401; PostgreSQL fixture verifies description, evidence, null reporter, history/audit arrays for both permissions; suite_go and 0/10/30/60 runtime checks pass. |


## Newly reproduced Admin Battle Abuse write-access defect — 2026-10-06

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-BATTLE-ABUSE-WRITE-ROLELESS-ACCESS-001 | POST resolve/escalate routes use AdminGuard plus CSRF only, without server-side `battle.manage`. | Add `battle.manage` to the shared write group. | — | Pre-fix visible roleless Admin escalated disposable report (200), confirmed by PostgreSQL. After fix, visible browser roleless receives 403 and anonymous 401; database confirms no mutation/audit. `battle.manage` integration succeeds and persists one audit row; fixture cleaned. |

## Latest verified repair — Admin Battle Abuse resolve contract (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-BATTLE-ABUSE-RESOLVE-ACTION-CONTRACT-001 | Go rejected the Admin form's warning/temp_ban/perm_ban values; after accepting them, the invalid-action error still listed only legacy values. | Keep legacy compatibility, accept every current shared frontend action and report the full accepted set on 400; add PostgreSQL-backed regression coverage for state and audit. | — | Visible Chrome opened a disposable report, submitted the real Resolve form with warning, received HTTP 200 and a success toast; detail showed resolved status, notes and audit entry. PostgreSQL confirmed one audit row and cleanup. Invalid action 400 text, anonymous 401 and roleless 403 verified. Go suite 526 passed, 6 expected skips; race/vet/gofmt/ARM64 passed. |

## Latest local runtime recovery — Admin Next cache (2026-10-06)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LOCAL-ADMIN-NEXT-PRERENDER-CACHE-001 | A corrupted generated apps/admin/.next/dev/prerender-manifest.json caused fresh Admin Next requests to return 500; source JSON files parsed correctly. | Removed only the malformed generated manifest and restarted the canonical supervisor. | — | Admin health and the full local stack passed at 0/10/30/60 seconds; Admin pages rendered again. |


## Latest API verdict — Admin battle bot list (2026-10-06T09:02:31Z)

Visible Chrome login succeeded through the real Admin form. The roleless Admin opened `/admin/vi/battle/bots`; the read-only UI issued `GET /api/admin/battle/bots?page=1&pageSize=25` and received HTTP 200 with `{items:[],page:1,pageSize:25,total:0}`. Anonymous 401 had already been confirmed. The empty list matches the response contract; no mutation was performed.

Current API coverage: 124/588 PASS, 0 FAIL, 464 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 56 found, 55 fixed, 1 remaining. Next: `POST /api/admin/battle/bots`.


## Latest verified Admin Battle bot API fixes (2026-10-06T09:19:08Z)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-BATTLE-BOT-CREATE-ROLELESS-001 | POST create route used AdminGuard + CSRF only; the UI hid controls, but an authenticated roleless Admin could create a persisted bot and audit row. | Require `battle.manage` on the bot mutation route group. | — | Real roleless visible browser POST now returns 403; actual authorized Admin form POST returns 200 and creates exactly one PostgreSQL bot/audit record. Anonymous 401. Regression has VALID_RED/GREEN; isolated Go suite 527 passed, 6 allowed skips, race/vet/gofmt/ARM64 passed. |

The same visible create action loaded `GET /api/admin/battle/bots/{id}`: response 200 matched the selected bot and audit entry; anonymous request returned 401. Disposable UI bot retained for the next CRUD endpoint wave. Runtime passed 0/10/30/60 after rebuild.

Current API coverage: 126/588 PASS, 0 FAIL, 462 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 57 found, 56 fixed, 1 remaining. Next: `DELETE /api/admin/battle/bots/{id}`.


## Latest API verdict — Admin battle bot update (2026-10-06T09:24:00Z)

`PATCH /api/admin/battle/bots/{id}` passed through the real visible edit form. The updated name and exactly one update audit row persisted; the detail panel showed the event. A roleless same-origin PATCH returned 403 and left data unchanged; the temporary permission assignment was restored.

Current API coverage: 127/588 PASS, 0 FAIL, 461 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 57 found, 56 fixed, 1 remaining. Next: `DELETE /api/admin/battle/bots/{id}`.


## Latest API verdict — Admin battle bot archive (2026-10-06T09:27:00Z)

The visible archive form returned 200; PostgreSQL shows archived status and one audit row. A roleless same-origin POST returned 403 without changing state.

Current API coverage: 128/588 PASS, 0 FAIL, 460 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 57 found, 56 fixed, 1 remaining. Next: `DELETE /api/admin/battle/bots/{id}`.


## Latest API verdict — Admin battle bot deletion (2026-10-06T09:30:00Z)

The real disposable bot was deleted only after archive. Roleless DELETE returned 403; authorized active-bot DELETE returned 400 and preserved it; authorized archived-bot DELETE returned 200. PostgreSQL confirms the bot row is gone and the delete audit is retained. CREATE→READ→UPDATE→ARCHIVE→DELETE cleanup is complete.

Current API coverage: 129/588 PASS, 0 FAIL, 459 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 57 found, 56 fixed, 1 remaining. Next: `POST /api/admin/battle/bots/{id}/disable`.


## Latest API verdicts — Admin battle bot disable/enable (2026-10-06T09:34:00Z)

Visible confirmation flows returned 200 for disable and enable; PostgreSQL transitions and `admin.battle.bot.toggled` before/after audit entries matched. Roleless same-origin requests to each endpoint returned 403 without changing state or audit count.

Current API coverage: 131/588 PASS, 0 FAIL, 457 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 57 found, 56 fixed, 1 remaining. Next: `GET /api/admin/battle/configs`.


## Latest API verdict — Admin battle config list (2026-10-06T09:38:00Z)

Visible config screen returned the paginated empty-list contract. Search/no-result, status+level filters and pagination normalization also passed; anonymous got 401 and roleless Admin read-only got 200.

Current API coverage: 132/588 PASS, 0 FAIL, 456 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 57 found, 56 fixed, 1 remaining. Next: `POST /api/admin/battle/configs`.


## Latest API verdict — Admin battle config create (2026-10-06T09:33:51+00:00)

`POST /api/admin/battle/configs` passed individually. A real roleless Admin session received 403 and left no row. The permissioned Admin created a draft through the visible form; PostgreSQL confirms `{'id': '50155c26-4d2f-4675-b18f-d4d7a34584ad', 'status': 'draft', 'bot_difficulties': '{{medium}}', 'audit_rows': 1}`. Fixed the JSON-string/text[] mismatch and added server-side `battle.manage` to the config mutation routes.

Current API coverage: 133/588 PASS, 0 FAIL, 455 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 58 found, 57 fixed, 1 remaining. Next: `DELETE /api/admin/battle/configs/{id}`.


## Latest API verdict — Admin battle config delete (2026-10-06T09:35:44+00:00)

Draft config deleted through the visible Admin confirmation form. PostgreSQL confirms config row 0 and one deletion audit row; roleless returned 403 and anonymous 401 without side effects.

Current API coverage: 134/588 PASS, 0 FAIL, 454 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 58 found, 57 fixed, 1 remaining. Next: `GET /api/admin/battle/configs/{id}`.


## Latest API verdict — Admin battle config detail (2026-10-06T09:36:39+00:00)

The visible detail panel and same-origin GET returned the persisted draft contract, including `botDifficulties:[medium]` and its audit row. Roleless Admin 200 and anonymous 401; PostgreSQL fixture remained intact.

Current API coverage: 135/588 PASS, 0 FAIL, 453 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 58 found, 57 fixed, 1 remaining. Next: `PATCH /api/admin/battle/configs/{id}`.


## Latest API verdict — Admin battle config update (2026-10-06T09:37:37+00:00)

Visible Sửa flow updated the fixture name; detail and PostgreSQL reflected the change, and one update audit row was recorded. Roleless PATCH 403, authorized empty PATCH 400, anonymous 401; no unauthorized/invalid side effects.

Current API coverage: 136/588 PASS, 0 FAIL, 452 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 58 found, 57 fixed, 1 remaining. Next: `POST /api/admin/battle/configs/{id}/archive`.


## Latest API verdict — Admin battle config archive (2026-10-06T09:38:22+00:00)

Visible Lưu trữ confirmation archived the fixture and persisted `archived_at` plus audit. Roleless 403 and anonymous 401 caused no changes. Repeating archive returned 200, kept status archived, and recorded `noop:true`.

Current API coverage: 137/588 PASS, 0 FAIL, 451 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 58 found, 57 fixed, 1 remaining. Next: `POST /api/admin/battle/configs/{id}/duplicate`.


## Latest API verdict — Admin battle config duplicate (2026-10-06T09:44Z)

The visible Admin duplicated the archived fixture into a draft. PostgreSQL confirms the clone preserved `{medium}` bot difficulties and scoring JSONB and has one duplicate audit row. Roleless received 403 and anonymous 401 without a clone. Fixed the last config text[] bytes conversion.

Current API coverage: 138/588 PASS, 0 FAIL, 450 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 59 found, 58 fixed, 1 remaining. Next: `POST /api/admin/battle/configs/{id}/publish`.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-BATTLE-CONFIG-TEXT-ARRAY-001 | Create, patch and duplicate treated the PostgreSQL `text[]` column as JSON bytes; create/duplicate failed against real PostgreSQL and detail could not decode the stored array. | Bind and scan `[]string` directly in config create/update/detail/duplicate; guard config writes with `battle.manage`. | — | Create, detail, patch, archive, duplicate and delete passed visible/API and DB checks. 530 Go tests, race, vet, gofmt and ARM64 build pass. |


## Latest API verdict — Admin battle config publish (2026-10-06T09:46:13+00:00)

Visible publish flow moved the clone draft to published; PostgreSQL confirms published_at and audit. Roleless 403, anonymous 401, archived config 400 without effects, repeated published request 200 with audit and stable status.

Current API coverage: 139/588 PASS, 0 FAIL, 449 remaining. Screens: 0/161 PASS, 0 FAIL, 161 remaining. Defects: 59 found, 58 fixed, 1 remaining. Next: `GET /api/admin/battle/leaderboard`.


## Checkpoint — Admin Battle leaderboard (2026-10-06)

The Vietnamese summary translation is repaired across en/ja/vi and verified in the visible Admin browser; the locale regression test passes 3/3. `GET /api/admin/battle/leaderboard` is individually PASS: visible all/30d/90d filters each issue a 200 request, empty response fields and `since` are correct, invalid window/pagination normalize to defaults, and an anonymous same-origin request returns 401. No raw translation key, page alert, or API console failure was observed.

Current: APIs 140/588 PASS, 0 FAIL, 448 remaining; screens 0/161 PASS, 0 FAIL, 161 remaining. Defects 60 found, 59 fixed, 1 remaining. Next: `GET /api/admin/battle/matches`.


## Checkpoint — Admin Battle matches list (2026-10-06)

The Admin list failure is fixed. The route now sorts by `started_at`, returns the expected time fields, and surfaces row scan/iteration errors instead of silently dropping data. PostgreSQL integration seeded two disposable matches and verified order/contract, pagination defaults, roleless Admin read, and anonymous 401. The visible Vietnamese screen now shows “Không có trận nào” with a 200 response; refresh works. The screen’s authenticated state is PASS; anonymous and mobile states remain.

Current: APIs 141/588 PASS, 0 FAIL, 447 remaining; screens 0/161 fully PASS, 0 FAIL, 161 remaining. Defects 61 found, 60 fixed, 1 remaining. Next: `GET /api/admin/battle/matches/{id}`.


## Audit correction — Battle matches read contract (2026-10-06T09:57:58+00:00)

The initial PASS for `GET /api/admin/battle/matches` was withdrawn after comparing a seeded-record response contract against `BattleMatchesClient`: the handler omits `currentRoundIndex` and `_count.rounds`. Source inspection also found the detail route queries nonexistent `created_at`/`updated_at` and does not return rounds. Both read paths remain open until PostgreSQL fixtures and the visible Admin interaction verify the full client DTO. API totals now count the list path as REMAINING.


## Checkpoint — Admin Battle matches list and detail (2026-10-06T13:59:11+00:00)

Both GET routes are now individually PASS. The authenticated visible table rendered a disposable persisted match and opened its detail panel; a same-origin request confirmed the complete detail JSON and missing IDs return 404. PostgreSQL regression tests assert ordering, `_count.rounds`, populated round records, nested audit actor data, pagination normalization, anonymous 401, and roleless Admin read 200. The screen authenticated state is PASS; anonymous/mobile states remain.

Current: APIs 142/588 PASS, 0 FAIL, 446 remaining; screens 0/161 fully PASS, 0 FAIL, 161 remaining. Defects 62 found, 61 fixed, 1 remaining. Next: `POST /api/admin/battle/matches/{id}/abort`.


## API checkpoint — POST /api/admin/battle/matches/{id}/abort (2026-10-06T14:31:37.735Z)

Visible authenticated Admin Battle UI submitted Abort; Network showed POST /api/admin/battle/matches/{id}/abort 200 followed by detail/list GETs. UI changed to Bỏ dở and displayed audit reason. PostgreSQL verified status=abandoned, abandoned_reason=admin_abort, completed_at set, exactly one abort audit with actor/reason. Go integration tests: roleless Admin 403 with no side effects; malformed/blank reason 400 with no side effects; authorized persistence PASS.

## API checkpoint — POST /api/admin/battle/matches/{id}/rerun (2026-10-06T14:32:11.532Z)

Visible authenticated Admin Battle UI submitted Rerun; Network showed POST /api/admin/battle/matches/{id}/rerun 200 and GET detail for the new session. UI showed success toast, new in_progress row, and selected detail. PostgreSQL verified new session, room code, started_at, and one rerun audit with reason and newId. Go integration tests verify roleless 403 without side effects, malformed/blank reason 400 without side effects, authorized session+audit persistence.

## Defect repair — Admin Battle match actions

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-BATTLE-MATCH-ACTIONS-RBAC-PERSISTENCE-001 | Abort/Rerun lacked backend battle.manage enforcement and ignored invalid-column/write failures; state and audit were not atomic. | Enforced battle.manage, validated reason, used canonical battle_session columns and atomic PostgreSQL transactions for session plus audit writes. | — | Visible UI Abort and Rerun passed, database state/audit verified, roleless 403 and invalid-input 400 integration tests pass; disposable rows cleaned. |

## API checkpoint — GET /api/admin/battle/system-parameters (2026-10-06T14:43:27.687Z)

No product UI caller exists for this registered summary path, so it was invoked through the current visible Admin browser origin with the existing real session. Latest rebuilt binary returned 200 and {activeBots:1, activeConfigs:1, pendingAbuseReports:0, inProgressMatches:0, completedToday:0}; PostgreSQL aggregate query independently matched all five fields. Same-origin credentials:omit returned 401. Go tests verify anonymous 401, roleless Admin 200 with DB-matching response fields, and 500 (not false zeroes) on aggregate query failure.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-BATTLE-SYSTEM-PARAMS-SILENT-QUERY-ERROR-001 | All five aggregate scan errors were discarded, so failed queries appeared as valid zero counts. | Return 500 with aggregate-specific server logging when a query fails. | — | Closed-pool regression, visible 200 with DB-matching values, anonymous 401, and roleless Admin 200 all passed. |


## API checkpoint — GET /api/admin/cardgen/jobs (2026-10-06T14:50:53.457Z)

The visible Admin Cardgen history tab triggered the real request against the rebuilt API. A disposable PostgreSQL job with nullable rule/user references appeared with completed status, three generated cards and creation time. The actual UI request completed successfully; same-origin credentials:omit returned 401. PostgreSQL cleanup was verified. Go integration test reproduced the missing row before the fix and now asserts the response contract.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-CARDGEN-JOBS-NULLABLE-IDS-001 | Nullable DB identifiers were scanned into required strings and the scan error was ignored, silently dropping valid jobs. | Scan nullable references safely, preserve rows, and report query iteration errors as 500. | — | Visible Admin history showed fixture; DB row deleted and absence verified; anonymous 401; targeted Go integration PASS. |


## API checkpoint — GET /api/admin/cardgen/jobs/{id} (2026-10-06T14:54:21.620Z)

No product UI control requests a job detail, so the visible authenticated Admin page context issued the same-origin request. A disposable persisted job returned 200 with canonical params and nullable references; malformed UUID returned 400, absent UUID 404, and anonymous access 401. PostgreSQL cleanup and targeted Go integration tests passed.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-CARDGEN-JOB-DETAIL-STALE-SCHEMA-001 | Handler selected nonexistent result_payload and mapped all query failures to 404; nullable IDs also broke scanning. | Read canonical params, scan nullable IDs, validate UUID, distinguish missing rows from database errors. | — | Visible 200/400/404/401 responses, PostgreSQL fixture removed, Go integration PASS. |


## API checkpoint — GET /api/admin/cardgen/rules (2026-10-06T15:00:28.169Z)

The visible Cardgen screen requested the real list and rendered a disposable PostgreSQL rule with canonical source, level, direction and enabled state. The UI and response matched; anonymous same-origin access returned 401, and the disposable row was deleted and verified absent. Integration tests reproduce the prior omission and verify row fields plus DB-error propagation.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-CARDGEN-RULE-LIST-SCAN-001 | List selected eight columns but attempted nine scan destinations, ignored Scan errors, and omitted schema-backed source/direction. | Align SQL and DTO with Prisma; return 500 on scan/iteration errors. | — | Visible Admin fixture rendered; anonymous 401; DB cleanup and integration test passed. |


## Admin Cardgen API wave (2026-10-06T15:17:12.309Z)

Verified methods individually through the real visible Admin session and DB-backed tests. GET jobs, GET job detail, GET rules, POST/PUT/DELETE rules have current PASS evidence in FULL_API_INVENTORY.json. UI Create → Update → Delete completed against disposable rows; persisted fields and audit events were checked in PostgreSQL, then fixture rows, audit entries and temporary RBAC role binding were cleaned. Roleless and anonymous access were denied.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-CARDGEN-RULE-DETAIL-SCAN-001 | Rule detail scanned description despite selecting different columns, silently returning 404 for persisted rules. | Select the actual Prisma fields and return explicit 400/404/500 contracts. | — | Visible browser and targeted Go/PostgreSQL tests PASS; fixtures removed. |
| ADMIN-CARDGEN-RULE-CREATE-SCHEMA-RBAC-001 | Rule create lacked backend write permission and CSRF enforcement, wrote a nonexistent description column, omitted required source/direction and ignored audit failures. | Require admin.content.write and CSRF; validate the schema DTO; transactionally persist canonical rule fields and audit. | — | Visible browser and targeted Go/PostgreSQL tests PASS; fixtures removed. |
| ADMIN-CARDGEN-RULE-DELETE-AUDIT-001 | Delete reported success for missing IDs and discarded database/audit write failures. | Validate UUID, return 404 for missing, and transact deletion with before-snapshot audit. | — | Visible browser and targeted Go/PostgreSQL tests PASS; fixtures removed. |
| ADMIN-CARDGEN-RULE-UPDATE-FIELDS-AUDIT-001 | Update omitted source_type/direction, referenced nonexistent description, and ignored missing-row and audit failures. | Update canonical fields under row lock in a transaction with before/after audit; enforce permission and input validation. | — | Visible browser and targeted Go/PostgreSQL tests PASS; fixtures removed. |

## Latest verified repair — Admin content summary/list contract (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-CONTENT-CMS-SUMMARY-CONTRACT-001 | The Go content summary omitted the shared CMS chart fields, and list/summary routes always queried lexeme tables for kanji and grammar. | Added typed summary and paginated queries for canonical lexeme, kanji, and grammar_point tables; database scan/query errors fail closed. | — | Target Go regressions PASS; canonical runtime stable 0/10/30/60; visible Admin Dictionary/Kanji/Grammar rendered persistent data without console errors. GET summary/list each returned 200 for all three types; anonymous requests returned 401. |

## Admin CMS create issue found and repaired locally (pending rebuilt UI retest)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-CONTENT-CREATE-STUB-001 | POST returned a success flag without writing content or audit data, and the route lacked content-write RBAC. | Create canonical lexeme/kanji/grammar_point rows with an atomic audit entry; require admin.content.write; validate status and required fields. | — | Red integration evidence reproduced fake 201 and roleless 201; typed persistence/audit and roleless 403 Go tests pass; visible Admin UI created a persisted disposable lexeme with audit, empty input returned 400, and temporary role/data were cleaned. Latest runtime stable 0/10/30/60. |

## Admin CMS patch issue found and repaired locally (pending visible retest)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-CONTENT-PATCH-FAKE-SUCCESS-001 | PATCH returned `{updated:true}` without changing the canonical row or recording audit. | Validate type, UUID, reason and editable fields; update under row lock and write audit in one transaction. | — | RED test confirmed unchanged content despite HTTP 200; integration test now passes, visible Edit dialog updated the row and stored the before/after audit, and temporary test data/role were cleaned. Latest source stable 0/10/30/60. |

## Admin CMS status issue found and repaired locally (pending visible retest)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-CONTENT-STATUS-AUDIT-NONATOMIC-001 | Status handler used a wrong grammar table and ignored audit errors after changing content. | Validate request, update canonical table, and write before/after audit atomically. | — | RED trigger test reproduced committed update despite audit failure; rollback GREEN, visible Publish persisted needs_review→active with before/after audit, and temporary role/data were cleaned. Latest source stable 0/10/30/60. |

## Admin Daily Radar cards list issue found and repaired locally (pending visible retest)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-DAILY-RADAR-CARDS-LIST-QUERY-SCAN-001 | Joined list filters were ambiguous, search named a nonexistent column, limit was ignored, and the handler scanned one nonexistent field while discarding row errors. | Qualify filters, search canonical title_vi/slug, honor limit, join for count, scan selected columns and fail on scan/iteration errors. | — | RED filtered-row test reproduced ambiguous-status 500; typed query/filter/limit integration regression passes. Rebuild and visible UI retest pending. |


## Latest verified repair — Admin Daily Radar card detail (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-DAILY-RADAR-CARD-DETAIL-001 | Joined query selected ambiguous id and scanned more destinations than selected columns; all DB errors were mislabeled as 404. | Select qualified canonical columns, align scan/DTO with Prisma schema, distinguish no-row from DB errors and log the latter. | — | PostgreSQL integration regression passed; real visible Admin-origin GET returned 200 with persisted contract, missing ID returned 404, browser errors empty, and disposable rows were deleted and verified absent. |


## Latest verified repair — Admin Daily Radar card update (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-DAILY-RADAR-CARD-PATCH-001 | PATCH had no write-permission middleware and mapped the Admin CardRow payload to legacy nonexistent columns; database and audit failures were unchecked. | Require admin.content.write and CSRF; validate/map current DTO into canonical columns and commit mutation plus audit atomically. | — | Visible Admin edit returned 200, refreshed updated title; PostgreSQL verified title, description, metadata and one audit row. Roleless Admin integration returned 403 without mutation; fixture, role, and audit were deleted and verified absent. Focused PostgreSQL RED/GREEN passed. |

## Latest verified screen — Admin Daily Radar (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-DAILY-RADAR-MODULE-CRUD-CONTRACT-001 | Create/update UI payload and legacy handler/database fields diverged; write middleware/audit were incomplete. | Persist the current module DTO with transactional audit and content-write/CSRF enforcement. | 5f98948a | Visible Admin create 201, update 200, reload persistence; PostgreSQL regression and unauthorized 403 pass; fixture cleaned. |
| ADMIN-DAILY-RADAR-CARD-ARCHIVE-001 | Archive SQL was ambiguous; route omitted write/CSRF guards and audit atomicity. | Guard and transact archive plus audit. | 5f98948a | Visible row archive returned 200 and subsequent read/UI showed archived; fixture cleaned; Go suite pass. |
| ADMIN-DAILY-RADAR-MOBILE-TABLE-OVERFLOW-001 | Wide cards/modules tables expanded the 390px page. | Put each table in its own horizontal-scroll container. | 5f98948a | Visible 390×844 browser: document remains 390px wide; Admin typecheck, regression test and full frontend suite pass. |

Checkpoint: Daily Radar is the first completed current inventory screen (1/161); API coverage 171/588; all disposable Daily Radar records/audit rows were cleaned. Next screen: `admin:/admin/:locale/decks`.


## Latest verified screen — Admin Decks (2026-10-07T02:39:47.171Z)

Anonymous browser redirected to the Admin login and unauthenticated deck reads returned 401. The authorized Admin UI rendered canonical card counts, search/no-results, CSV, bilingual detail and reason validation. A disposable deck was created through the same-origin endpoint, archived through the visible drawer, read back with audit reason, then fully cleaned. Mobile viewport remained 390px wide with the table in its own horizontal scroller.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-DECK-CARD-COUNT-001 | Admin deck rows/export showed zero cards. | Frontend read _count.cards while Go returns cardCount; use the canonical cardCount in table, detail and CSV. | 5f98948a | Visible counts 10/20 and CSV verified; frontend tests pass. |
| ADMIN-DECK-READ-CONTRACT-001 | Deck owner and detail descriptions were absent from responses. | Return ownerUserId and descriptionVi/descriptionJa in list/detail contracts. | 5f98948a | Visible list/detail responses and seeded bilingual descriptions verified. |
| ADMIN-DECK-NULLABLE-TITLE-JA-001 | Decks with null title_ja were dropped or returned 404. | Scan title_ja as nullable and serialize it as nullable. | 5f98948a | PostgreSQL integration fixture with NULL passes list/detail. |
| ADMIN-DECK-MOBILE-OVERFLOW-001 | Deck table widened the page on mobile. | Wrap the table in overflow-x-auto. | 5f98948a | Visible Chrome 390x844: viewport/body width 390px; table scrolls within its container. |
| ADMIN-DECK-RBAC-CSRF-001 | Deck endpoints relied on Admin session guard without content RBAC/CSRF. | Require admin.content.read for GET and admin.content.write+CSRF for mutations. | 5f98948a | Read-only PostgreSQL route test permits GET, rejects both writes with 403 and no side effects. |
| ADMIN-DECK-GENERATE-SCHEMA-001 | Deck generation inserted source_type/jlpt_level/max_cards columns absent from canonical schema and returned 500. | Insert a private draft using only canonical learning.deck columns. | 5f98948a | Visible POST201 and saved list/detail verified; canonical DB test passes. |
| ADMIN-DECK-GENERATE-AUDIT-001 | Generation ignored audit insert errors and could persist without an audit event. | Create the deck and generated audit row in one transaction. | 5f98948a | PostgreSQL integration test asserts one durable audit event with created deck. |
| ADMIN-DECK-TRANSITION-DETAIL-001 | Transition returned {id,status}, but frontend cast it to full Detail and crashed reading audit.length. | Reload GET detail after successful transition instead of treating the mutation response as Detail. | 5f98948a | Visible archive action keeps drawer and audit rendered; regression test covers short API response. |
| ADMIN-DECK-TRANSITION-STATUS-001 | Drawer heading kept the pre-transition status after a successful update. | Render status from refreshed detail, falling back to selected row while detail loads. | 5f98948a | Visible drawer changes to ARCHIVED immediately; Vitest regression passes. |
| ADMIN-DECK-TRANSITION-AUDIT-001 | Transition ignored audit insert errors and could persist a status without its audit event. | Lock the deck and update status plus audit in one transaction; roll both back on audit failure. | 5f98948a | Failing-audit-trigger integration test returns 500 and retains draft; visible archive renders reason-bearing audit; disposable fixture cleaned. |

API verdicts recorded independently: GET list 200; GET detail 200; POST generate 201 with durable transactional audit; POST transition 200 with atomic status/audit persistence and read-after-write. Invalid transition target and blank reason each returned 400 without changing the canonical active deck. The read-only role integration test confirmed both write routes return 403 and preserve state.

Checkpoint: Admin Decks completed (2/161 screens); APIs 175/588; defects 98 found/98 fixed; next: `admin:/admin/:locale/dictionary`.


Checkpoint 2026-10-07 12:55 JST: Admin Dictionary source commit `58627b8f59912bd87b57f5c389c15632fed23b7e`; clean isolated PostgreSQL Go verification passed (591 tests, race, ARM64); frontend passed (243/243); visible-browser smoke passed. Screen/API counts: 3/161 screens PASS, 178/588 APIs PASS; 103 defects found and fixed. Review is externally unavailable because the reviewer OAuth session expired; next screen: `admin:/admin/:locale/kanji`.


## Latest verified screen — Admin Learning Competencies (2026-10-07)

Visible Chrome: Admin logout followed by direct /admin/vi/learning/competencies navigated to /admin/vi/login?returnTo=...; anonymous API read behavior is protected by adminGuard (integration test GET list 401).

Real Admin session through the visible login UI. Competencies list rendered 7 canonical rows; search/filter interactions covered BJT.KANJI.BUSINESS (1), no-match (0), draft (0), published (7), advanced (1), reset (7). Selecting BJT.READ.LONG loaded detail. Actual same-origin GET list and GET detail returned 200; Console errors empty.

Visible Chrome device emulation 390x843: document width 390 equals viewport; 478px table stays inside max-w-full overflow-x-auto and can scroll horizontally so every column remains reachable.

PostgreSQL integration test sent trusted-Origin requests individually: anonymous GET list 401; roleless Admin GET list/detail and POST/PATCH/publish/archive/DELETE all 403; granting admin.content.read allowed list 200 and missing detail correctly returned 404. No competency CRUD request was made by browser acceptance.

No vocabulary/kanji/grammar or competency canonical records were created, edited, archived or deleted during browser acceptance.

API METHOD+PATH verdicts are recorded individually in `FULL_API_INVENTORY.json`: GET list and GET detail PASS from the authenticated visible UI plus RBAC integration evidence. POST create, PATCH, publish, archive, and DELETE each record the trusted-Origin roleless 403 result and remain REMAINING because this screen audit explicitly avoids CRUD.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-COMPETENCIES-MOBILE-OVERFLOW-001 | The wide data table expanded the 390px document and clipped columns. | Bounded the table in its own horizontal-scroll wrapper. | f773354f | Visible Chrome 390×843: document/viewport both 390px, table scroll is contained, 7 persisted rows render, Console has no errors; frontend suite 243/243 and build/typecheck pass. |
| ADMIN-COMPETENCIES-RBAC-001 | Competency endpoints had only an Admin session guard and lacked content read/write permissions. | Require admin.content.read for GET and admin.content.write plus CSRF for writes. | f773354f | PostgreSQL integration: anonymous 401, roleless Admin 403 for all seven methods/paths using trusted Origin, authorized list 200; full Go suite 603 pass, 6 expected skips, race and ARM64 pass. |

Checkpoint: Competencies screen PASS (5/161 screens; 156 remaining); APIs 180/588 PASS, 0 fail, 408 remaining; defects 106 found/106 fixed. Next screen: `admin:/admin/:locale/learning/paths`. Canonical vocabulary, kanji and grammar records were not changed.

## Latest verified repair — Learner achievements (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-ACHIEVEMENTS-STREAK-SCHEMA-001 | Gamification store used retired user_streak column names. | Align streak reads/writes with streak_config_id and last_activity_date; add canonical PostgreSQL integration coverage. | 67703a11 | Visible authenticated UI and DB integration test pass; temporary streak/config removed. |
| LEARNER-ACHIEVEMENTS-STREAK-DTO-001 | Client expected a bare array with nested streakConfig, while Go returns {streaks:[...]} with flat fields. | Parse the response envelope and render canonical fields. | 67703a11 | Visible populated 3-day streak, 5-day record and remaining freeze; all tabs work. |

Achievements screen: PASS, including anonymous redirect/401 and 390x844 no-overflow. Canonical vocabulary, kanji and grammar data were not modified. Counts: 8/161 screens PASS, 188/588 APIs PASS, 117 defects found and fixed. Next screen: learner:/:locale/analytics.


## Battle Match screen audit (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| BATTLE-REALTIME-SOCKETIO-GO-PROTOCOL-001 | Learner battle still speaks Socket.IO at `/socket.io`; local Go backend accepts a different plain JSON WebSocket protocol at `/ws/battle`, with only a limited event set. | OPEN — implement the documented authenticated battle event flow in Go and migrate its learner client, including match lifecycle and persisted results. | — | Anonymous route correctly redirected to login. Authenticated UI loaded bots/chat (200) at 390×844 without overflow, but stayed “reconnecting”, disabled Start, and could not enter a match. |

Battle Match verdict: FAIL (anonymous gate PASS; authenticated interaction and mobile primary action blocked). Next screen: `learner:/:locale/battle`. API inventory unchanged.


## Latest verified screen — Learner Battle Lobby (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| BATTLE-LOBBY-LEADERBOARD-API-001 | Lobby called a missing learner leaderboard route. | Add learner-authenticated ranked aggregate endpoint with empty state, paging, and privacy-safe display fields. | 4c101422745b723f8ab42942b2285777847eb9b3 | Visible 30d/90d/all filter calls each returned 200; PostgreSQL integration verifies anonymous 401, PvP ranking, paging, empty state and no email leakage. Go suite 615 passed, 6 expected skips; independent review approved. |
| BATTLE-LOBBY-API-SCHEMA-DRIFT-001 | Config, bot and recent-chat handlers queried retired/missing schema fields/tables and returned false empty 200 responses. | Query canonical schema, map current DTOs, enforce moderation/private-room membership, and surface database errors. | 6277fda5 | Visible Lobby requests each returned 200; PostgreSQL integration verifies DTO/lifecycle, anonymous 401, private participant/outsider access, cleanup; Go 616 pass, 6 allowed skips; independent review approved. |
| BATTLE-REALTIME-SOCKETIO-GO-PROTOCOL-001 | Client Socket.IO protocol differs from Go plain WebSocket events. | OPEN — align the authenticated protocol and complete match lifecycle. | — | Visible lobby remains reconnecting and Start stays disabled. |

Battle Lobby verdict: FAIL. Anonymous route state remains to be audited; authenticated mobile UI has no horizontal overflow, but match start is blocked by realtime. The leaderboard plus bots/config/recent-chat APIs have individual PASS evidence. Counts: 9/161 screens PASS, 2 FAIL, 150 remaining; 192/589 APIs PASS, 0 FAIL, 397 remaining; 121 defects found, 120 fixed, 1 unresolved (realtime). Vocabulary, kanji and grammar datasets were not changed. Next: repair/retest Battle realtime, then close Lobby.

Latest API repair: 6277fda5 fixes Battle bots/config/recent-chat canonical SQL/DTO drift. Visible authenticated 390x844 Lobby loaded the published config and bot; all three GETs returned 200 and no horizontal overflow appeared. Battle Lobby remains FAIL because realtime is still disconnected; anonymous Lobby state remains pending.


## Latest verified repair — Battle Lobby chat persistence (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| Battle Lobby chat POST missing | UI emitted an event that Go silently ignored; no write endpoint persisted messages. | Add learner-session and trusted-Origin guarded POST; validate length, derive identity from PostgreSQL profile, return canonical DTO; UI renders server response. | Pending — Battle screen not complete | Visible authenticated form POST 201; reload retained message through recent-chat GET; integration confirms 401/403/400 validation and disposable cleanup; Go focused test and web typecheck PASS; runtime stable 60s. |

API checkpoint: 193/590 PASS, 0 FAIL, 397 remaining. Battle Lobby remains FAIL: bot challenge has no server round flow yet. Vocabulary, kanji, and grammar datasets were left unchanged. Next: implement/verify Battle challenge and match flow.

## Latest verified repairs — learner vocabulary, kanji and grammar search (2026-10-07T11:05:04.398Z)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-DICTIONARY-OPTIONAL-SENSES-001 | Canonical lexeme list DTO omitted optional senses while the client dereferenced it unconditionally. | Render list rows using shortMeaningVi when senses are absent; canonical vocabulary rows were not edited. | 69b8ed58 | Visible 390x844 list/filter/detail, persistence refresh and cleanup; UI contract regression PASS. |
| LEARNER-KANJI-DETAIL-CANONICAL-SCHEMA-001 | Handler queried nonexistent example columns and omitted component records. | Read canonical example/component schema and return explicit errors; canonical kanji rows were not edited. | 006c7ac5 | PostgreSQL integration plus visible 390x844 detail PASS, including examples and components. |
| SEARCH-CANONICAL-PROJECTION-API-CONTRACT-001 | Go queried retired indexes, ignored UI scope and returned an envelope the UI rejected. | Query populated content_search by kind and return the expected result array. | 76ff4178 | Visible 390x844 Japanese, reading, Vietnamese, lexeme/kanji/grammar scopes, no-results state; Go tests and typecheck PASS. |

The canonical vocabulary, kanji and grammar datasets were not added to, edited or deleted. Anonymous route/API checks remain pending, so these seven screen records remain REMAINING until that required state passes. Runtime stability passed at 0/10/30/60 seconds after rebuild.

| SEARCH-DETAIL-CANONICAL-ROUTE-404-001 | Search detail links pointed at retired lexeme/grammar API paths. | Use canonical /api/content/lexemes/{id} and /api/content/grammar/{id}; protect mapping with regression test. | 03fc0e37 | Reproduced lexeme 404; visible grammar result now opens details via HTTP 200; Vitest RED/GREEN and typecheck pass. |

Search detail flow retested in the visible mobile browser: lexeme detail shows canonical meaning/reading, grammar detail shows explanation, and kanji detail/stroke APIs return 200. Search page remains open at 390×844. Anonymous-state checks remain next.

| SEARCH-JLPT-LEVEL-FILTER-001 | Search hits lacked canonical JLPT metadata; client ignored level when filtering; grammar projection showed JLPT as a reading. | Enrich visible search hits from PostgreSQL lexeme/grammar levels and kanji N1–N5 mapping, normalize grammar reading, and combine kind/level filters including multi-level lexemes. | dbe144b8 | Real PostgreSQL integration; visible 390x844 N4 grammar (2 matches), N1 lexeme and N5 kanji filters all show only matching levels; no content rows changed; web typecheck and Go/Vitest pass; runtime 0/10/30/60 PASS. |


## Latest anonymous screen — Vocabulary dictionary (2026-10-07)

The visible 390x844 browser loaded canonical dictionary rows and a selected lexeme detail without a learner session; list/detail API responses were 200 and the detail showed the login action for saving. The authenticated search field also returned canonical results for 学生. The shared legacy announcement image URL failure is recorded separately as MEDIA-LEGACY-ANNOUNCEMENT-URL-001; no vocabulary content was changed. Screen checkpoint: 10/161 PASS, 2 FAIL, 149 remaining. Next: anonymous dictionary detail.


## Latest anonymous screen — Vocabulary detail (2026-10-07)

A fresh visible 390x844 browser opened a canonical lexeme detail without a learner session. The page rendered headword, reading, meaning and the login action for personal saves; the canonical detail GET returned 200 and there was no horizontal overflow. The shared announcement-media failure is tracked independently; no vocabulary content was written. Screen checkpoint: 11/161 PASS, 2 FAIL, 148 remaining. Next: anonymous Kanji list.


## Latest anonymous screen — Kanji catalog (2026-10-07)

The fresh visible mobile browser loaded canonical 日/N5 and the catalog API returned 200 without horizontal overflow. The expected anonymous session probe returned 401; the shared stale promo-image issue remains separately tracked. Canonical Kanji data was not written. Screen checkpoint: 12/161 PASS, 2 FAIL, 147 remaining. Next: anonymous Kanji detail.


## Latest anonymous screen — Kanji detail (2026-10-07)

A fresh visible 390x844 browser rendered canonical 日 readings, meaning, JLPT level, example words and anonymous save/login state. The content detail GET returned 200 with no horizontal overflow; the expected auth probe returned 401. No Kanji data was changed. Screen checkpoint: 13/161 PASS, 2 FAIL, 146 remaining. Next: anonymous Grammar catalog.


## Latest anonymous screen — Grammar catalog (2026-10-07)

A fresh visible 390x844 browser loaded canonical grammar patterns, meanings and levels; the list GET returned 200 with no horizontal overflow. Anonymous session probe returned the expected 401. Grammar content remained read-only. Screen checkpoint: 14/161 PASS, 2 FAIL, 145 remaining. Next: anonymous Grammar detail.


## Latest anonymous screen — Grammar detail (2026-10-07)

The visible 390x844 anonymous browser loaded the canonical A-い+N explanation and summary; detail API returned 200 and the page had no horizontal overflow. Saving is clearly presented as a login-required action. Grammar source rows stayed read-only. Screen checkpoint: 15/161 PASS, 2 FAIL, 144 remaining. Next: submit a search from the anonymous unified-search screen.

## Latest verified screen — Anonymous unified content search (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| SEARCH-INACTIVE-STALE-INDEX-RESULTS-001 | Reindex is not implemented, so stale/inactive Meilisearch documents could remain searchable after canonical content changed status. | Validate each hit against current PostgreSQL public status; lessons allow active or published rows only when published_at is absent or due; unknown result kinds are dropped. Canonical vocabulary, kanji and grammar rows remain read-only. | f4ffbbfb | Go/PostgreSQL integration covers active and draft grammar, active and published lessons, future lessons, unknown mixed hits, and unknown-only hits. Visible anonymous browser at 390×844 shows 20 results for ために and the correct no-results state; both GET /api/search calls returned 200. |

Search screen: PASS (16/161 PASS, 2 FAIL, 143 remaining). GET /api/search is public read-only; the Admin-only reindex endpoint remains protected. APIs: 200/590 PASS, 0 FAIL, 390 remaining. Defects: 109 found, 106 fixed, 3 remaining. Next: `learner:/:locale/cardgen` anonymous + authenticated + mobile.


## Latest anonymous screen — Grammar detail (2026-10-07)

The visible 390x844 anonymous browser loaded the canonical A-い+N explanation and summary; detail API returned 200 and the page had no horizontal overflow. Saving is clearly presented as a login-required action. Grammar source rows stayed read-only. Screen checkpoint: 15/161 PASS, 2 FAIL, 144 remaining. Next: submit a search from the anonymous unified-search screen.


## Latest verified repair — Public Search (2026-10-07)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| SEARCH-INACTIVE-STALE-INDEX-RESULTS-001 | Stale Meilisearch hits could outlive canonical content status and future lesson publication dates. | Validate every returned result against active canonical PostgreSQL rows, enrich JLPT from those rows, and keep reindex Admin-only. | 55c5de7d | Anonymous visible 390x844 search: ために returned 20 results; no-result query rendered correctly; both requests returned 200. Go integration covered active/draft and published/future lessons. Full Go, frontend, harness suites and 60-second runtime check passed. Canonical vocabulary, kanji, and grammar data rows were unchanged. |

Checkpoint: screens 16/161 PASS, 2 FAIL, 143 remaining; APIs 200/590 PASS, 0 FAIL, 390 remaining. Next item: `learner:/:locale/cardgen anonymous + authenticated + mobile`.

## Latest flashcard library repair and screen checkpoint (2026-10-08)

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-FLASHCARD-PUBLIC-DECK-NULL-OWNER-001 | Canonical shared decks can have NULL owner_user_id; the newly owner/public-scoped query scanned NULL into a required string and returned HTTP 500. | Preserve ownerless system decks as an empty ownerUserId in list/detail DTO queries. | f4ffbbfb | Visible authenticated 390x844 public tab rendered canonical community decks; GET /api/flashcards/decks returned 200. PostgreSQL test covers ownerless public, owned and hidden private decks. |
| LEARNER-FLASHCARD-EDITED-CARD-TEXT-001 | Updating a deck with existing cardId values relinked cards but ignored submitted front/back/reading edits. | Update deck-owned custom variants; create a personal copy when edited source card is canonical/shared, leaving source content unchanged. | 2cfe7921 | PostgreSQL integration updates a lexeme-backed card, verifies the deck copy changed, and verifies the canonical variant did not. |

Flashcards library and deck-detail screens: anonymous redirects, authenticated content, and 390x844 mobile layout passed. Visible API reads returned 200; anonymous auth probe returned 401. Canonical vocabulary, kanji and grammar data remain read-only; their search/generation logic continues to use active canonical rows. Screen checkpoint: 19/161 PASS, 2 FAIL, 140 remaining; API inventory: 210/591 PASS, 0 FAIL, 381 remaining. Defects: 123 found, 120 fixed, 3 unresolved. Runtime stability passed at 0/10/30/60 seconds. Next: finish quality gates/review, commit this screen, then profile anonymous/authenticated/mobile.

| LEARNER-FLASHCARD-CONTENT-SOURCE-VALIDATION-001 | The from-content endpoint trusted arbitrary source type/ID after checking deck ownership. | Require an active canonical lexeme/grammar/kanji source and return 404 for unavailable content. | f4ffbbfb | PostgreSQL test covers missing/custom IDs, draft source rejection, valid active lexeme, and visible-route handler 404 contract. |
| LEARNER-FLASHCARD-REMOVED-CARD-SRS-HISTORY-001 | Detached cards remained in due review; archiving pruned user_flashcard and cascaded review history. | Restrict due/review writes to active deck membership, archive orphan custom variants, preserve user SRS and review history. | f4ffbbfb | PostgreSQL test removes a reviewed card, confirms it leaves due and direct review, then archives the deck and verifies history remains. |


## Latest final-restart flashcard verification — 2026-10-08

Visible browser confirmed authenticated flashcard rendering and HTTP 200 list data after runtime recovery. The actual account-menu logout redirected to the learner Login page; the session probe returned the expected 401. Anonymous navigation to flashcards at 390x844 redirected with `returnTo=/vi/flashcards` and no overflow. Runtime stability passed 0/10/30/60 seconds. Canonical vocabulary, kanji, and grammar data remain unchanged and read-only.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-FLASHCARD-CONTENT-SUGGESTION-LEAK-001 | Caller-supplied card text was persisted as a globally suggestible canonical variant. | Validate active canonical source, then store generated text as a custom variant scoped to its learner deck; preserve null owner in public DTOs. | 2cfe7921 | PostgreSQL regression verifies private text is absent from suggestions; nullable owner test, 654 Go tests, frontend gates and visible UI pass. |

Flashcard screen checkpoint: 19/161 PASS, 2 FAIL, 140 remaining. API checkpoint: 210/591 PASS, 0 FAIL, 381 remaining. Next: `learner:/:locale/me?tab=progress` anonymous behavior, authenticated session, and mobile progress screen.


## Latest completed screen — Learner profile progress (2026-10-08)

Anonymous access redirected to Login and the session probe returned 401. A real learner session rendered the profile and progress tab; after full navigation/reload the session and progress screen remained available. At 390x844, page width and scroll width were both 390. Selecting 7, 30, and 90 days and refreshing called GET /api/analytics/learner with HTTP 200; the empty-state title now reflects the selected range. No JavaScript errors were observed.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-PROFILE-PROGRESS-EMPTY-RANGE-LABEL-001 | Empty-state copy was fixed at 7 days while the report range could be 7, 30, or 90 days. | Localized dynamic day-count template used by the card and empty-state title. | 439162e2 | Visible 30/90-day UI, authenticated API refresh 200; analytics contract regression 4/4; web typecheck pass. |
| QUALITY-ANNOUNCEMENT-TEST-UNUSED-VAR-001 | The Cardgen announcement regression test retained an unused container binding. | Remove the unused binding. | 439162e2 | Full frontend quality gate passes with no new lint debt; all 343 indexed tests pass. |

Screen checkpoint: 20/161 PASS, 2 FAIL, 139 remaining. APIs: 210/591 PASS, 0 FAIL, 381 remaining. Defects: 129 found, 126 fixed, 3 unresolved. Frontend quality gate: typecheck, lint ratchet, 343/343 indexed tests, and production build PASS; Go 654/654 and harness 263/263 PASS. Next: `learner:/:locale/modules/:moduleKey`.


## Latest completed screen — Learner Daily Radar module route (2026-10-08)

The visible module route initially showed the app ErrorState. Next logs identified `Failed to parse URL from /api/daily-radar/modules`: the canonical startup intentionally leaves `NEXT_PUBLIC_API_URL` empty for same-origin browser calls, but the server page used it for Node fetch. The existing `getServerApiBaseUrl()` resolver correctly uses `API_URL`; Modules, Radar detail, and Magazine server pages now use that shared resolver. A regression test failed with relative URLs and passed with the server URL.

Anonymous and authenticated visible-browser states both load `/vi/modules/audit_probe_module`; the real Login form returned POST 200 and the session GET returned 200. Anonymous session GET returned expected 401. Module and card GETs returned 200 with empty arrays; the page rendered its explicit coming-soon state. At 390x844, page width and scroll width were both 390. Web typecheck and targeted analytics/module tests passed.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-MODULE-SSR-API-URL-001 | Server-rendered content screens used the browser API URL, which is intentionally blank under local same-origin proxying. | Reuse `getServerApiBaseUrl()` for Modules, Radar, and Magazine server requests. | f2149efa | Regression red/green; visible anonymous/authenticated module route 200, read APIs 200, no mobile overflow; web typecheck and targeted tests pass. |

Screen checkpoint: 21/161 PASS, 2 FAIL, 138 remaining. APIs: 210/591 PASS, 0 FAIL, 381 remaining. Defects: 130 found, 127 fixed, 3 unresolved. Next: `learner:/:locale/news/:id`.


## Latest completed screen — Learner NHK News detail (2026-10-08)

Go now reads NHK articles from PostgreSQL and implements detail, reading progress, bookmarks, and private vocabulary flashcards. The canonical dictionary and authored vocabulary remain untouched. Anonymous learners can read content; progress, bookmarks, and flashcard actions require a learner session, and POST routes use CSRF protection.

The visible 390x844 browser rendered a disposable persisted article, toggled furigana, bookmarked/unbookmarked, saved reading progress, saved an article word as a private card, and created/renamed an article deck. Successful requests returned GET 200, POST bookmark 200, POST flashcard/deck 201. After UI logout, article content stayed public and learner-only APIs returned expected 401. Missing article returned 404. The reading badge persisted after navigation, no page/console errors occurred, and width/scrollWidth remained 390. Test article and learner-derived rows were removed after the test. PostgreSQL-backed NHK regression passed; full Go suite passed before the final missing-article 404 assertion, and targeted integration plus `go vet` passed afterward. Runtime passed 0/10/30/60 seconds.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-NHK-ARTICLE-API-GAPS-001 | The API returned an empty hard-coded list and lacked article detail, reading, bookmark, and flashcard routes despite existing persistence tables and UI callers. | Query persisted NHK content; add public detail/list and learner-authenticated progress/bookmark/private-card flows. | 40ed0684 | PostgreSQL integration, full Go tests, targeted vet, visible real-session and anonymous flows, all seven added METHOD+PATHs, 390x844, no console errors, disposable fixture cleanup. |

A metadata-only RSS article defect was found during the visible detail audit: local easy feed has 68 rows (9 with body), normal has 1,255 (6 with body). The API now returns explicit null body fields and the learner gets a localized explanation plus the NHK source link; authored vocabulary/kanji/grammar content remains untouched.

| LEARNER-NHK-HEADLINE-ONLY-EMPTY-STATE-001 | Metadata-only RSS article detail rendered a blank reader area without explaining the missing stored body. | Return nullable body fields and show a localized unavailable-content notice when both are empty. | 1c9753d4 | Visible 390x844 metadata-only and full-content articles, API GET 200/null contract, auth session 200, no console errors/overflow; PostgreSQL valid RED/GREEN; frontend 344/344, typecheck/build, runtime stable 60s. |

Screen checkpoint: 22/161 PASS, 2 FAIL, 137 remaining. API checkpoint: 218/598 PASS, 0 FAIL, 380 remaining. Defects: 132 found, 129 fixed, 3 unresolved. Next: `learner:/:locale/onboarding`.


## Latest completed screen — Learner NHK News list (2026-10-08)

Anonymous list state passed after a real UI logout: auth probe 401, persisted Easy list 200/12, and no learner progress call. After logging in through the visible Login form, both Easy/Normal tabs fetched their own data; Load more requested normal offset 12 and expanded the list from 12 to 24 unique article cards. The saved-read badge remained after refresh and the progress API returned the persisted article ID. At 390x844, document width stayed 390 and browser error instrumentation remained empty.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| None found | — | — | — | Anonymous/authenticated UI, tab switch, pagination, reading badge persistence, 390x844 and list/progress GET contracts passed. |

Screen checkpoint: 23/161 PASS, 2 FAIL, 136 remaining. API checkpoint: 218/598 PASS, 0 FAIL, 380 remaining. Defects: 132 found, 129 fixed, 3 unresolved. Next: `learner:/:locale/onboarding`.


## Latest completed screen — Learner BJT placement onboarding (2026-10-08)

The missing learner onboarding status route and broken placement flow are repaired. A real learner session loaded 20 published question prompts and public options; submitting the visible form scored answers against PostgreSQL, persisted 8/20 (band F), and restored that result after refresh. Anonymous navigation redirected to Login and the status endpoint returned 401. At 390x844 the page remained within 390px, with no recorded browser error. Canonical vocabulary, kanji and grammar data were not modified; placement uses the canonical BJT question bank.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-PLACEMENT-ONBOARDING-CONTRACT-001 | The UI called a missing status route; start omitted question DTOs, submit used a fixed 50% score, and onboarding completion persistence was incomplete. | Add authenticated session status, canonical question/options contract, DB-derived answer scoring and atomic completion persistence. | 1fb24763 | PostgreSQL placement integration and invalid-answer regression; Go vet; learner typecheck; real visible Start/Submit at 390x844; 8/20/F persisted across refresh; anonymous 401/redirect; runtime stable 0/10/30/60. |

Screen checkpoint: 24/161 PASS, 2 FAIL, 135 remaining. API checkpoint: 221/599 PASS, 0 FAIL, 378 remaining. Defects: 133 found, 130 fixed, 3 unresolved. Next item: `learner:/:locale/career`.


## Latest completed screen — Learner Daily detail (2026-10-08)

Anonymous visible browser access rendered the published Japanese daily item at 390x844; the detail API returned 200 and learner-only actions stayed hidden. In the authenticated browser, the learner opened the quick quiz, answered correctly, marked the item useful, and generated a private deck. API responses were 200/200/201; width remained 390 and browser error instrumentation was empty. Mounted-router PostgreSQL tests verify session identity, CSRF rejection (403), anonymous rejection (401), quiz/action payload persistence, deck/card persistence, missing item 404 and invalid UUID 400.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-DAILY-DETAIL-ROUTES-001 | Daily detail/action endpoints were not registered in the Go API. | Add public published-item read and learner session/CSRF-protected actions. | 72f55cc6 | Visible anonymous/authenticated browser and mounted-router integration. |
| LEARNER-DAILY-ACTIONS-MISSING-EXTRACTION-001 | Published items without extraction rows could not start a quiz or create cards. | Derive fallback quiz choices and a real card from published item data. | 72f55cc6 | Visible quiz/card actions and PostgreSQL integration. |
| LEARNER-DAILY-ACTION-PERSISTENCE-001 | Flashcard generation omitted its daily action row; fallback quiz stored an empty payload. | Persist generated deck metadata and the normalized quiz using session identity. | 72f55cc6 | Independent review approved; integration assertions verify persisted action payloads. |

Screen checkpoint: 26/161 PASS, 2 FAIL, 133 remaining. API checkpoint: 228/603 PASS, 0 FAIL, 375 remaining. Defects: 141 found, 138 fixed, 3 unresolved. Next: `learner:/:locale/daily`.


## Latest completed screen — Learner Daily Radar home (2026-10-08)

The visible anonymous browser opened `/:locale/daily`, which intentionally redirects to the home page. Selecting the Today tab rendered the public Daily Radar feed from PostgreSQL: 15 modules, 51 cards, 8 categories and a spotlight. The same-origin endpoint returned HTTP 200; at 390x844 the document width stayed 390 with no browser errors. Runtime checks passed at 0/10/30/60 seconds. Vocabulary, kanji and grammar canonical data were not changed.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-DAILY-RADAR-EMPTY-API-001 | The public Daily Radar endpoint hard-coded empty arrays while the PostgreSQL tables and canonical local seed were available. | Read enabled published modules and active published cards from PostgreSQL; derive categories and spotlight in the existing frontend contract. | 4872afba | PostgreSQL RED/GREEN, 664 Go tests, race check, ARM64 build, visible 390x844 UI/API response, and 60-second runtime stability pass. |

Screen checkpoint: 27/161 PASS, 2 FAIL, 132 remaining. API checkpoint: 229/603 PASS, 0 FAIL, 374 remaining. Defects: 142 found, 139 fixed, 3 remaining. Next: `learner:/:locale/daily-standup`.

## Latest completed screen — Learner shared deck preview (2026-10-08)

The public token route now reads the learner's active shared deck and returns only preview fields. In the visible anonymous browser at 390x844, the Japanese/Vietnamese title, description and front/reading sample rendered; the answer remained private and the document width stayed 390px. The valid-token API returned 200 with `Cache-Control: no-store`; an unknown token rendered the not-found state and returned 404 with `no-store`. PostgreSQL integration covers revoked and archived tokens, the five-sample limit, and private-field exclusion. Visible share and unshare actions on a disposable deck produced their expected API results; unsharing made the public URL return 404 immediately.

The clone CTA uncovered a separate learner-library defect: one real visible learner action generated two `POST /api/flashcards/decks/clone/{token}` requests and two persisted copies. This is recorded as a failing API and open defect; AUDIT-071 will repair the library flow before the next screen.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-SHARED-DECK-API-CONTRACT-001 | Public preview still queried the obsolete `study.public_deck` model, while actual share tokens live on `learning.deck`. | Serve a safe preview DTO from the active learner deck share token and route the API through `FlashcardDeckStore`. | abc8ad0c | Visible 390x844 valid/unknown token states; PostgreSQL integration for active, revoked, archived, sample cap and private-field exclusion; Go 665, frontend 353, harness 263. |
| LEARNER-SHARED-DECK-CACHE-001 | API and Next route allowed shared previews to remain cached after share changes. | Set `Cache-Control: no-store` on responses and disable Next revalidation. | abc8ad0c | Browser and integration assertions for 200/404 no-store responses. |
| LEARNER-FLASHCARD-CLONE-DUPLICATE-001 | A single visible clone action submitted the same POST twice. | Pending AUDIT-071. | — | Reproduced through real learner UI; two HTTP 201 responses and duplicate user-owned decks observed. |

Screen checkpoint: 28/161 PASS, 3 FAIL, 130 remaining. API checkpoint: 232/603 PASS, 1 FAIL, 370 remaining. Defects: 147 found, 143 fixed, 4 remaining. Next item: learner Flashcards clone de-duplication (AUDIT-071).

## Latest completed screen — Learner Flashcards library clone flow (2026-10-08)

A single clone query previously produced two persisted copies because React StrictMode replayed the effect before asynchronous state updated. The learner client now takes a synchronous per-user/token guard and removes the one-shot query only after a successful POST. Failed POSTs retain the query so a page reload can retry; successful clones refresh the library list.

The visible authenticated learner browser opened the shared-deck CTA at 390x844. One action produced exactly one clone POST with HTTP 201, one new user-owned copy, and the success message. The URL no longer contained `cloneToken`; after refresh, the same copy remained and no second mutation occurred. A regression test exercises StrictMode replay, the follow-up list read, and the failed-request/reload retry path. Canonical vocabulary, kanji and grammar data were not modified.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-FLASHCARD-CLONE-DUPLICATE-001 | The effect checked React state that had not committed yet, so StrictMode replay submitted the persistent mutation twice. Keeping the token in the URL after success also allowed a refresh to repeat it. | Guard synchronously by learner/token; keep the token on failure for retry, and consume it only after success. Refresh the deck list after successful cloning. | 53cf69a4 | Valid RED/GREEN; 2 focused Vitest cases; frontend gate typecheck, lint ratchet, 353/353 baseline tests and production build; visible real learner click, exactly one POST 201, one new persisted copy, refresh persistence, no repeated request, 390x844; independent review approved. |

Screen checkpoint: 29/161 PASS, 2 FAIL, 130 remaining. API checkpoint: 233/603 PASS, 0 FAIL, 370 remaining. Defects: 147 found, 144 fixed, 3 remaining. Next item: `learner:/:locale/forgot-password`.

## TOMORROW_MORNING_SUMMARY — AUDIT-071 checkpoint

| Field | Status |
|---|---|
| STARTING_GIT_HEAD | `c1ac21af48df5de85994ca8e8612a394b8c1a081` |
| FINAL_GIT_HEAD | 8804f629f5e3afe5997e5d548aa2a06aa52d91a0 (Exercises screen commit). |
| LOCAL_RUNTIME_STATUS | PASS — API, learner, Admin, proxy, PostgreSQL, Redis, Meilisearch and Mailpit passed 0/10/30/60 after reviewer fixes and Go API rebuild. |
| LOCAL_RUNTIME_START_COMMAND | `node scripts/local-audit-up.mjs` |
| LEARNER_LOGIN_STATUS | PASS — visible real registration/login and session lifecycle previously verified. |
| ADMIN_LOGIN_STATUS | PASS — visible real Admin login and session lifecycle previously verified. |
| SCREENS_TOTAL / PASS / FAIL / REMAINING | 161 / 29 / 2 / 130 |
| APIS_TOTAL / PASS / FAIL / REMAINING | 603 / 233 / 0 / 370 |
| DEFECTS_FOUND / FIXED / REMAINING | 147 / 144 / 3 |
| COMMITS_CREATED | 8804f629 fix: secure learner exercise session completion; earlier commits remain in audit history. |
| LEARNER_STATUS | PASS — real registration/login and full visible forgot/reset/session lifecycle. |
| ADMIN_STATUS | PASS for verified real login/session; full Admin screen audit remains incomplete. |
| MOBILE_STATUS | PARTIAL — password recovery and exercises passed at 390x844; other critical learner mobile flows remain. |
| API_STATUS | IN_PROGRESS (241 PASS, 0 FAIL, 363 remaining of 604). |
| REALTIME_STATUS | PENDING — full realtime audit remains. |
| MEDIA_STATUS | PENDING — full media audit remains. |
| PERSISTENCE_STATUS | PARTIAL — recovery outbox, password reset and session revocation verified; full learning journey remains pending. |
| CURRENT_PHASE | LEARNER_EXERCISES |
| NEXT_ITEM | learner:/:locale/exercises |
| EXTERNAL_BLOCKERS | None recorded. |
| FINAL_VERDICT | IN_PROGRESS — 128 screens remain (2 fail); 363 API methods/paths remain; 4 tracked defects remain. |


## Latest completed screen — Learner Exercises (2026-10-08)

The authenticated exercise flow now generates questions through a CSRF-protected POST, reuses persisted questions by canonical source key, and binds every session to its question IDs. Session start validates level and placement values before persistence. Completion now locks the owned session and requires a saved answer for every assigned question before writing score totals. Answer submission checks assignment before scoring; the due-review contract contains the nested exercise fields consumed by the UI.

In the visible learner browser, POST generation returned HTTP 200 without answer keys, session creation returned 201 with assigned IDs, and the rebuilt API completed a ten-question session after all ten visible answers were submitted. The result showed 0/10; daily progress advanced from 58 to 68/10 and remained after refresh. PostgreSQL regressions verify invalid level/placement/sessionType return 400, early completion returns 409 without closing the session, and valid completion stores exact totals. A disposable due-review row rendered the Japanese prompt, choice, answer and explanation and was deleted after the check. The removed generator GET returned 405. Mobile emulation at 390x844 kept document/body width at 390px and opened a word-order session using the visible keyboard flow.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| EXERCISE-REVIEW-CANONICAL-SCHEMA-001 | Review state used a retired schema and upsert omitted updated_at. | Use canonical exercise review state and persist updated_at. | 8804f629 | Canonical PostgreSQL integration; visible due-review GET and card rendered. |
| EXERCISE-DAILY-PROGRESS-CANONICAL-QUERY-001 | Daily progress used a legacy relation and risked fake zeros. | Aggregate canonical completed sessions and profile goal. | 8804f629 | PostgreSQL integration; visible persisted progress survived refresh. |
| EXERCISE-SESSION-UI-API-CONTRACT-001 | Session DTOs differed from the UI and client correctness was trusted. | Align payloads and score persisted answers server-side. | 8804f629 | Go integration and visible answer result. |
| EXERCISE-GENERATION-MISSING-001 | Generation was absent and the GET handler inserted rows on reads. | Use CSRF-protected POST and source-keyed cached rows; return questions without answer keys. | 8804f629 | Visible five-type generation; POST 200 and removed GET 405; PostgreSQL cache retry regression. |
| EXERCISE-WORD-ORDER-MIXED-LANG-001 | Bilingual examples produced mixed-language tokens. | Exclude Latin-script examples before tokenization. | 8804f629 | Sensitivity mutation and visible word-order session. |
| EXERCISE-SESSION-ASSIGNMENT-001 | Answer handler accepted any same-type question, whether or not that session assigned it. | Store assigned IDs with the session and validate membership before scoring. | 8804f629 | PostgreSQL integration proves unassigned 404 and assigned 201; visible session/answer flow. |
| EXERCISE-DUE-REVIEW-DATA-CONTRACT-001 | Due-review API omitted question content expected by the card. | Return the nested exercise DTO including prompt, choices, answer, explanation and level. | 8804f629 | PostgreSQL DTO regression and visible disposable due-review card. |
| EXERCISE-SESSION-LEVEL-PLACEMENT-VALIDATION-001 | Unvalidated session level/placement could violate DB limits and return 500. | Validate supported JLPT levels and placement/sessionType values before persistence. | 8804f629 | PostgreSQL integration: invalid values return 400; visible valid session start remains 201. |
| EXERCISE-SESSION-INCOMPLETE-COMPLETION-001 | A fresh session could be completed with 0/0 answers and persist misleading progress. | Lock the session and require all assigned questions answered before atomically saving totals. | 8804f629 | PostgreSQL early-completion 409 and exact totals after answers; visible ten-question completion and refresh persistence. |

Checkpoint: screens 32/162 PASS, 2 FAIL, 128 remaining; APIs 241/604 PASS, 0 FAIL, 363 remaining; defects 163 found, 160 fixed, 3 remaining. Next screen: `learner:/:locale/explore`.


## Latest completed screen — Learner lesson detail (2026-10-09)

The lesson route now reads published canonical content through the Go API. Anonymous visitors can read it and are directed to the real login page before saving progress. Authenticated learner completion is stored in PostgreSQL, survives refresh, and can be cleared. Unknown lessons return 404, and progress writes require a learner session plus trusted Origin/CSRF. No vocabulary, kanji, or grammar master rows were added, edited, or deleted. The visible 390x844 page had no horizontal overflow.

The lesson document contains five activities. The canonical `bjt_lesson_item` relationship table has no linked rows for this lesson, so the separate vocabulary/kanji/grammar relation counters show zero; the lesson document itself still renders its learning content. This audit did not create master-content records or fabricate links.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-LESSON-DETAIL-PERSISTENCE-001 | Lesson detail GET route was missing and completion lived only in browser localStorage. | Add the published lesson read contract, CSRF-protected PostgreSQL progress, and server-backed UI state. | 7b1e6a1f | Visible anonymous and learner browser states; complete → refresh → persisted → uncomplete cleanup; Go 706/706, frontend 379/379, Prisma validate/build and independent review pass. |

Checkpoint: screens 36/162 PASS, 2 FAIL, 124 remaining; APIs 245/608 PASS, 0 FAIL, 363 remaining; defects 178 found, 175 fixed, 3 remaining. Next screen: learner:/:locale/levels/:level.


## Latest completed screen — Learner Magazine article detail (2026-10-09)

The published article detail returns ordered vocabulary with stable row IDs, quiz options and answer feedback, plus a valid publication timestamp. The UI renders the seeded Japanese and Vietnamese introduction, localized dates and back links. Learner quiz results are validated and idempotently saved to daily.magazine_user_read; upstream 503/network failures surface through the route error boundary rather than becoming a 404.

Visible browser checks passed for vi/en/ja at 390x844, anonymous published reading, unknown-slug 404, real learner session, quiz result save, and vocabulary-to-flashcard creation. The flashcard flow created a disposable learner deck through the page and returned 201 for the vocabulary card. PostgreSQL confirmed learner-owned deck/card/SRS rows and the unchanged article vocabulary master row. Public decks are no longer offered as write targets. Runtime passed 0/10/30/60 after API rebuild.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-MAGAZINE-DETAIL-CONTRACT-001 | Detail GET omitted vocabulary/quiz children and the page read a mismatched date field. | Return ordered child DTOs and publishedAt; format dates and back navigation by locale. | a127559c | Go PostgreSQL regression; visible vi/en/ja and 404 browser checks. |
| LEARNER-MAGAZINE-QUIZ-PERSISTENCE-001 | MiniQuiz used a wrong API fallback; handler wrote a retired table, ignored failures and dropped score fields. | Same-origin POST; validate and upsert score/total into the canonical read table; show localized failure. | a127559c | Go integration, MiniQuiz Vitest, visible POST 200 and PostgreSQL refresh persistence. |
| LEARNER-MAGAZINE-INTRO-CONTENT-001 | Seeded introduction fields were ignored. | Render Japanese and Vietnamese introduction. | a127559c | Component regression and visible vi/en/ja check. |
| LEARNER-MAGAZINE-FLASHCARD-PERSISTENCE-001 | Vocabulary action only toggled local success text. | Persist learner-owned cards through the authenticated flashcard API; leave master vocabulary read-only. | a127559c | Visible click, 201 response, PostgreSQL rows and unchanged source count. |
| LEARNER-MAGAZINE-ERROR-STATUS-001 | Every failed fetch became not-found. | Only 404 maps to notFound; throw operational failures. | a127559c | Route regression for 404, 503 and network error. |
| LEARNER-MAGAZINE-FLASHCARD-PUBLIC-DECK-001 | Public decks appeared as writable targets despite server rejection. | Restrict picker to learner-owned decks. | a127559c | UI regression and visible deck creation/add flow. |
| LEARNER-MAGAZINE-DRAFT-VOCAB-EXPOSURE-001 | Flashcard creation could accept a vocabulary source from a draft article. | Require its parent article status to be published. | a127559c | PostgreSQL integration rejects draft source; public source add flow remains passing. |

Checkpoint: screens 40/162 PASS, 2 FAIL, 120 remaining; APIs 254/614 PASS, 0 FAIL, 360 remaining; defects 196 found, 192 fixed, 4 remaining. Next screen: learner:/:locale/magazine. Adjacent open defect LEARNER-MAGAZINE-INDEX-LIST-CONTRACT-001: the list endpoint returns a bare array while the screen expects an envelope; repair is queued as the next screen task.

## Latest completed screen — Learner Magazine index (2026-10-09)

The list endpoint now returns a published-only paged envelope with the fields used by the learner web page and mobile DTO. Both `kind` and legacy `widgetKind` filters work, page/limit are applied, and database or decoding failures return an error rather than masquerading as an empty catalog. The web screen shows a localized retry state for operational failures and preserves a true no-results state.

Visible browser checks at 390x844 passed in vi/en/ja: published cards and locale dates, category filtering, page 2, true no-match state, and navigation to article detail. The page stayed within the viewport. Same-origin GET `/api/magazine?kind=vocab&page=1&limit=1` returned the envelope and ordered vocabulary preview. Go PostgreSQL tests cover filter/page, draft exclusion, vocabulary ordering, and database failure; Vitest covers the visible error state.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-MAGAZINE-INDEX-LIST-CONTRACT-001 | The API returned a bare reduced array, ignored filters/pagination, and failed requests appeared as empty results. | Return the compatible paged published list DTO; handle filter/page/limit and localized retryable operational errors. | Pending AUDIT-084 | Visible vi/en/ja browser at 390x844; Go PostgreSQL list/error/out-of-range integration, web page tests, and visible same-origin page=999 request (page 7 of 7). |

Checkpoint: screens 41/162 PASS, 2 FAIL, 119 remaining; APIs 255/614 PASS, 0 FAIL, 359 remaining; defects 196 found, 193 fixed, 3 remaining. Next screen: learner:/:locale/magazine/loto.


## Latest completed screen — Learner Home (2026-10-10)

The public Home remains usable anonymously, while learner-specific focus actions route guests to the localized login form. Authenticated Home Progress now loads the latest persisted weekly report by session identity and returns `null` for an empty history. Focus timers persist in canonical `learning.study_session`; totals, active-session lookup and end operations are scoped to `mode=focus`, so quiz and lesson records cannot appear as timers or be changed by the focus endpoint. Early stops clear the active session without counting completion.

Visible-browser verification passed with a real learner session at 390x844, including Progress, weekly-report empty state, focus start and early stop; the document width remained 390px. Anonymous focus login gating was verified through the actual localized link. Runtime passed 0/10/30/60 seconds; Go 733/733 including race, frontend 404/404, quality harness 263/263, visible E2E and independent review passed. AUDIT-087 is CLOSED/VERIFIED.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| HOME-WEEKLY-REPORT-API-001 | Home Progress called an unregistered endpoint and got 404. | Added authenticated learner-scoped latest report query with empty `null` contract. | 4fecce16 | Visible request 200/null; PostgreSQL ownership, latest-row, anonymous and empty-state tests. |
| HOME-FOCUS-STUDY-SESSION-CONTAMINATION-001 | Focus table was missing; the shared study-session replacement initially risked mixing quiz/lesson sessions. | Use canonical persistence and scope reads/updates to `mode=focus`; retain early-stop semantics. | 4fecce16 | PostgreSQL contamination regression and visible UI start/stop; totals and active state verified. |

Checkpoint: screens 43/162 PASS, 2 FAIL, 117 remaining; APIs 262/615 PASS, 0 FAIL, 353 remaining; defects 202 found, 199 fixed, 3 remaining. Next item: `learner:/:locale/pricing`.


## Latest completed screen — Learner BJT Quiz hub and session (2026-10-10)

The Quiz hub now renders canonical localized template metadata, filters templates with no published questions, and gates anonymous visitors through the real localized Login flow. Authenticated practice persists the session, each answer, completed result and history in PostgreSQL. The timed session opens in a focused route without global navigation or promotions. Remaining time uses seconds, and an unavailable calibrated BJT score displays “—” instead of a misleading zero.

Visible Chrome checks covered signed-out redirect/401, real learner registration, six canonical templates, vi/en/ja localized hub rendering, a full 21-question session, result/breakdown/history, refresh persistence, and mobile 390x844. The completed 10/21 practice result displayed “— / 800”; viewport/document width remained 390px and the focused session contained no promotional UI. API requests returned 200/201 as expected. The Go PostgreSQL session/ownership integration and timer regression passed. Final quality verification: Go 735/735 including race, vet and ARM64 build; frontend 418/418, typecheck and learner/Admin production builds passed; lint debt-ratchet recorded 65 existing errors/25 warnings and zero new debt.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-QUIZ-TEMPLATE-DTO-001 | The template client expected localized fields/section counts the Go list DTO did not provide. | Align the list contract with localized card titles and actual section counts. | Pending AUDIT-091 | Visible six-template card list and PostgreSQL DTO regression. |
| LEARNER-QUIZ-SESSION-API-GAP-001 | The learner called missing session lifecycle/availability routes. | Register authenticated, owner-scoped session handlers backed by assessment tables. | Pending AUDIT-091 | Visible start/21 answers/results/history; Go PostgreSQL owner and lifecycle integration. |
| LEARNER-QUIZ-EMPTY-TEMPLATE-001 | Empty published templates appeared playable. | Exclude tests with no published questions. | Pending AUDIT-091 | PostgreSQL template-list regression. |
| LEARNER-QUIZ-TIMER-UNIT-001 | Duration nanoseconds were rendered as seconds. | Convert remaining duration to integer seconds. | Pending AUDIT-091 | RED→GREEN PostgreSQL timer regression; visible 45:00 timer. |
| LEARNER-QUIZ-FOCUSED-SESSION-CHROME-001 | Timed questions retained global chrome and promotional UI. | Use a focused session route with hidden learner chrome. | Pending AUDIT-091 | Visible 390x844 active session and completed result. |
| LEARNER-QUIZ-UNAVAILABLE-ESTIMATED-SCORE-001 | A null calibrated score displayed as 0/800. | Render an unavailable placeholder until an actual estimate exists. | Pending AUDIT-091 | Vitest null/available formatting; visible 10/21 result displays — / 800. |
| LEARNER-QUIZ-BJT-GUIDE-CONTRAST-001 | Guide text used low-contrast theme colors. | Use readable semantic contrast tokens. | Pending AUDIT-091 | Visible Quiz guide and frontend production build. |

AUDIT-091 checkpoint: screens 48/163 PASS, 2 FAIL, 113 remaining; APIs 279/621 PASS, 0 FAIL, 342 remaining; defects 228 found, 225 fixed, 3 remaining. Next item: learner:/:locale/quiz/print/:id.


## Latest completed screen — Learner Quiz printable exam (2026-10-10)

The printable Quiz route now uses the canonical assessment schema and the same-origin Caddy API proxy. It renders localized title/metadata, ordered sections and 21 questions; the answer-key toggle marks the correct options, while the print stylesheet hides the navigation controls. The Go store returns canonical `title_vi/title_ja` and section `code/title_vi/title_ja` columns, and official simulation templates remain forbidden.

Visible browser acceptance used an isolated anonymous Chrome context (`/api/auth/me` returned 401): the public printable request returned 200 and rendered in Vietnamese and Japanese. Invalid IDs showed a retry action. At 390x844 the document had no horizontal overflow; answer toggle worked, print media hid the controls, and browser runtime/resource checks found no unexpected errors. The same learner exam also rendered in an authenticated session. API response was 23,708 bytes. Quality gates passed: harness 263/263; Go 743/743 including race, vet and ARM64 build; frontend 421/421 including typecheck and learner/Admin builds; lint debt ratchet found no new debt (65 existing errors, 25 warnings); independent review APPROVE.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-QUIZ-PRINT-API-SCHEMA-001 | Printable SQL selected a removed section title column and the UI expected an incompatible DTO/API origin. | Use canonical schema fields/DTO and same-origin proxy, with localized retryable printable UI. | 84f30c25 | Visible anonymous/authenticated vi/ja flows; API 200 and official 403 PostgreSQL integration; invalid-ID retry, answer key and print CSS; Go/frontend/harness gates passed. |

AUDIT-093 checkpoint: screens 49/163 PASS, 2 FAIL, 112 remaining; APIs 280/621 PASS, 0 FAIL, 341 remaining; defects 229 found, 226 fixed, 3 remaining. Next screen: learner:/:locale/radar/:slug.

## Latest completed screen — Learner Saved (2026-10-11)

Visible authenticated Chrome at 390x844 showed a real saved lexeme title from `GET /api/content/lexemes/{id}`; the three Saved tabs loaded their Go list endpoints, Kanji/Grammar empty states rendered, and the page width remained 390px. A real UI bookmark was removed and remained absent after refresh. Regression tests cover the real `type` list DTO, canonical word/grammar detail routes, anonymous privacy and recoverable errors. The frontend suite passed 429/429, production builds passed, and independent review approved. Commit: `a5e15f53`.

Search deep-link repair: `entry=lexeme:<id>` now remains in the URL and auto-selects the exact matching detail; an absent target remains intact without falling back to a different result. Verified at 390x844 with a real authenticated browser session. Commit: `c2599d07`. AUDIT-100 frontend suite output passed tests/typecheck/build but lifecycle harness recorded TOOL_FAILURE for fingerprint drift; task remains VERIFYING.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| SAVED-BOOKMARK-CONTRACT-001 | Saved client expected `targetType` and obsolete detail routes; Go returns `type` and canonical content paths. | Align row model and use canonical lexeme/grammar detail endpoints; add regression coverage. | a5e15f53 | Visible title resolved; all three list tabs and refresh-safe removal passed; 429 frontend tests/build passed. |
| SEARCH-SAVED-ENTRY-001 | Search initialized the pending entry only on bootstrap and fell back to the first result when the requested target was absent. | Sync pending target from URL changes, wait for exact kind+ID match, and retain missing targets without fallback; add 3 regression tests. | c2599d07 | Visible 390x844 authenticated deep link selected exact lexeme detail; missing-target and mounted-query transitions passed; focused tests 3/3, full tests 458/458 and builds passed. Lifecycle harness still records TOOL_FAILURE for fingerprint drift. |


## Latest completed screen and API wave — AUDIT-124 (2026-10-13)

The Admin exercises screen and nine active API METHOD+PATH entries now pass individually. The canonical `exercise.exercise` schema is used for JSONB prompts/choices/answers and text-array tags; mutation endpoints enforce `admin.content.write` and trusted-origin CSRF, audit writes are transactional, and deleting an exercise with answer history returns 409 without losing data. Config validation/defaults and visible form fields align with the shared contract.

Visible headed Chrome at 390x844 verified the anonymous Admin-login redirect and the real authenticated Admin page. The config form created order 17, edited it to 18, and deleted it; the page returned to its empty state. Exercise list, analytics, create, detail, update, delete and post-delete 404 were tested through the same-origin browser session. No page/console errors were captured after reload; document width remained 390px. Go 811/811, frontend 460/460, quality harness 263/263, browser E2E PASS, independent fresh-session review APPROVE. Runtime passed 0/10/30/60 seconds after generated manifest recovery.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-EXERCISE-API-SCHEMA-001 | Handlers drifted from canonical exercise schema and JSON/array types. | Align queries/scans/writes with canonical columns and types. | 8343860d | Browser CRUD/list and Go PostgreSQL suite. |
| ADMIN-EXERCISE-AUTH-AUDIT-001 | Mutations needed full permission/CSRF/audit guarantees and deletion could lose answer history. | Require write permission and CSRF; transact audit; preserve referenced history with 409. | 8343860d | Roleless/untrusted-origin, rollback and history tests; headed UI CRUD. |
| ADMIN-EXERCISE-CONFIG-CONTRACT-001 | Config API and visible form disagreed on enums, defaults and update fields. | Align validation/defaults and preserve all config values in form updates. | 8343860d | Visible create/read/edit/delete plus Go contract tests. |
| ADMIN-EXERCISE-MOBILE-TABLE-001 | Invalid table header nesting and narrow-screen overflow. | Use valid header row and internal horizontal scrolling. | 8343860d | Visible 390x844 width and console check. |

Checkpoint: screens 63/163 PASS, 2 FAIL, 98 remaining; APIs 315/627 PASS, 0 FAIL, 312 remaining; defects 278 found, 274 fixed, 4 remain. Next item: GET /api/admin/flashcards/styles — continue source-discovered API audit one METHOD + PATH at a time.


## API wave 10 checkpoint — AUDIT-159 (2026-10-15)

All 20 METHOD+PATH entries passed their targeted PostgreSQL-backed router tests. Repairs added canonical review deck/queue models and migration, fixed review ownership CRUD, aligned quiz revenge persistence/queue with the learning schema, corrected quiz section titles, and implemented bounded dictionary-backed Reading Assist tokenization/reading extraction. Timed quiz analysis hides meanings unless the authenticated quiz session is complete, regardless of client-supplied answerSubmitted. The active lexeme fixture proves Japanese readings and Vietnamese meanings. Test run: `TEST_REDIS_URL=redis://127.0.0.1:6379 bash scripts/quality/with-test-db.sh go -C apps/api-go test ./internal/httpserver ./internal/quiztemplate -run '^TestAudit159Wave10|^TestStudyFeed_|^TestRevenge|^TestGetTemplate|^TestSubmitRevenge' -count=1` — PASS. Full suite and browser UI checks remain deferred.

Counts: 615/632 APIs PASS, 9 FAIL, 8 remaining; screens 68/163 PASS, 2 FAIL, 93 remaining; defects 404 found, 394 fixed, 10 remaining. NEXT_ITEM: GET /api/search/suggest.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| LEARNER-PUSH-SUBSCRIPTION-CONTRACT-159 | Push subscription handlers expected a non-browser payload and DELETE did not consume the JSON endpoint body. | Accept the active browser payload, validate fields and delete only the authenticated user's subscription. | pending | Wave 10 targeted PostgreSQL route tests PASS. |
| LEARNER-PUBLIC-SHARE-EXPIRY-159 | Expired public share records could be returned as live shares. | Enforce expiry and return non-cacheable public responses. | pending | Wave 10 targeted PostgreSQL route tests PASS. |
| LEARNER-STUDY-FEED-QUERY-159 | Invalid study-feed limit values were silently normalized. | Validate bounded pagination and return explicit 400 for invalid input. | pending | Wave 10 targeted PostgreSQL route tests PASS. |
| LEARNER-REVIEW-SCHEMA-159 | Review handlers depended on study tables absent from the canonical Prisma schema. | Add Prisma models and migration for owner-scoped review decks and exercise review queue; verify CRUD/ownership persistence. | pending | Wave 10 targeted PostgreSQL route tests PASS. |
| LEARNER-QUIZ-REVENGE-PERSISTENCE-159 | Revenge answer used a retired assessment table and columns. | Persist to the canonical learning.revenge_attempt model and test correct/incorrect answers. | pending | Wave 10 targeted PostgreSQL route tests PASS. |
| LEARNER-QUIZ-REVENGE-QUEUE-159 | Queue hid database errors and did not exclude correctly revenged questions. | Use canonical revenge attempts, filter solved questions and propagate query/scan/iteration errors. | pending | Wave 10 targeted PostgreSQL route tests PASS. |
| LEARNER-QUIZ-TEMPLATE-SECTION-159 | Template detail selected nonexistent bjt_test_section.title. | Read canonical title_vi. | pending | Wave 10 targeted PostgreSQL route tests PASS. |
| LEARNER-READING-ASSIST-TOKENIZER-159 | Analyze route returned 503 with no local analyzer. | Tokenize against active canonical lexemes, return safe unknown tokens, hash normalized text and hide meanings for active timed sessions. | pending | Wave 10 targeted PostgreSQL route tests PASS. |
| LEARNER-READING-ASSIST-READING-159 | Deck composer reading lookup returned 503 with no local extractor. | Build reading from lexicon matches and kana; report unavailable readings for unknown kanji. | pending | Wave 10 targeted PostgreSQL route tests PASS. |


## Latest completed API wave — AUDIT-142 (2026-10-14)

All nine Admin achievement and tier METHOD+PATH entries passed individually. The routes now enforce content read/write RBAC and trusted-origin CSRF for mutations, validate against the shared schema, return accurate not-found/database errors, and persist mutation audit records atomically. The Admin gamification tables use valid header rows. Headed Chrome at 390×844 used the real Admin session; the achievements list rendered without hydration/page/console errors or horizontal overflow. Disposable achievement/tier and audit fixtures were removed. Go 912/912, frontend 467/467, headed browser E2E PASS, independent fresh-session review APPROVE. Code commit: `e641ef88`.

Checkpoint: screens 67/163 PASS, 2 FAIL, 94 remaining; APIs 351/627 PASS, 0 FAIL, 276 remaining; defects 311 found, 307 fixed, 4 remaining. Next item: `GET /api/admin/gamification/leaderboards`. Gamification screen authenticated/mobile states are PASS; anonymous screen state remains pending, so its overall screen verdict remains REMAINING.


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


## Latest completed API wave — AUDIT-144 (2026-10-14)

Five Admin pet/streak METHOD+PATH APIs passed individually: pet statistics, pet detail, pet update, pet reset, and streak list. Read routes require admin.content.read; pet mutations require admin.content.write and trusted-origin CSRF. The handlers now return accurate database/not-found errors, bound pet values to PostgreSQL types, and commit mutations with actor audit rows atomically.

Headed Chromium at 390×844 used the real Admin login form and HttpOnly session. Pet detail was fetched from the authenticated page; the visible editor and Reset confirmation changed persisted PostgreSQL values and audit history. All five target routes returned 200, the view remained within the viewport, and there were no console/page errors. Go 930/930, race/vet/ARM64, browser E2E, runtime 0/10/30/60, and independent fresh-session review APPROVE. Code commit: a80172f6.

Gamification remains REMAINING overall because its anonymous state is pending; authenticated and mobile states are PASS. Counts: screens 67/163 PASS, 2 FAIL, 94 remaining; APIs 361/627 PASS, 0 FAIL, 266 remaining; defects 321 found, 317 fixed, 4 remaining. Next: POST /api/admin/gamification/streaks.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-PET-STATS-ERRORS-001 | Statistics query and row failures were swallowed, and the route lacked explicit read permission. | Surface database errors and require content-read permission. | a80172f6 | DB-failure regression and headed Admin request. |
| ADMIN-PET-DETAIL-ERRORS-002 | Malformed IDs and database failures were reported as not found; the route lacked explicit read permission. | Validate UUIDs and distinguish 400/404/500 behind content-read permission. | a80172f6 | Missing/detail contract, DB-failure regression, and authenticated same-origin request. |
| ADMIN-PET-UPDATE-CONTRACT-003 | Invalid values and missing rows could be silently accepted; mutation audit was absent. | Enforce field bounds, accurate statuses, and transactional actor audit. | a80172f6 | PostgreSQL validation/persistence, audit-trigger rollback, and visible edit. |
| ADMIN-PET-RESET-CONTRACT-004 | Reset did not reliably report missing rows or keep actor audit atomic. | Lock/check row and commit reset with audit as one transaction. | a80172f6 | Missing/reset persistence, audit-trigger rollback, and visible confirmation flow. |
| ADMIN-STREAK-LIST-ERRORS-005 | Streak list skipped scan/iteration errors and lacked read permission. | Require content-read permission and fail closed on incomplete reads. | a80172f6 | Closed-pool DB regression and visible screen list. |


## Latest completed API wave — AUDIT-145 (2026-10-14)

Five Admin METHOD+PATH APIs passed individually: streak create, update and delete; Growth campaign list and create. Streak writes now require `admin.content.write` plus trusted-origin CSRF, validate against shared bounds (actions 1–100, freezes 0–10), and persist mutations with actor audit atomically. Campaign GET honors Growth read permissions and safe pagination/error handling. Campaign POST requires `growth.manage` plus CSRF, validates its schedule and reason, returns 201 from the transaction-built detail response, and commits audit atomically. OpenAPI now matches permissions and status codes for the campaign route group.

Headed Chromium at 390×844 used the real Admin login form and HttpOnly session. It observed streak GET/POST/PUT/DELETE (200/201/200/200), campaign GET/POST (200/201), verified persisted campaign/audit data and cleanup, and recorded no console/page errors. A real populated-table overflow was fixed with a keyboard-focusable horizontal scroll region. Go 939/939 (race/vet/ARM64), frontend 467/467 (0 new lint debt), runtime stable 0/10/30/60, and independent fresh-session review APPROVE. Code commit: `d4185812`.

Gamification remains REMAINING overall because its anonymous state is pending; authenticated and mobile states PASS. Growth Campaigns anonymous/authenticated/mobile states all PASS (the anonymous session probe returns expected 401 and redirects to login). Counts: screens 68/163 PASS, 2 FAIL, 93 remaining; APIs 366/627 PASS, 0 FAIL, 261 remaining; defects 327 found, 323 fixed, 4 remaining. Next API: `GET /api/admin/growth/campaigns/audience-estimate`.

| Defect | Root cause | Fix | Commit | Retest |
|--------|------------|-----|--------|--------|
| ADMIN-STREAK-CREATE-CONTRACT-006 | Missing complete write authorization, shared bounds and atomic actor audit. | Validate and commit create plus audit in one transaction. | d4185812 | Go integration and visible POST 201. |
| ADMIN-STREAK-DELETE-CONTRACT-007 | DB errors/missing rows were hidden and no audit existed. | Accurate status handling and atomic before-image audit. | d4185812 | Go rollback/404 tests and visible DELETE 200. |
| ADMIN-STREAK-UPDATE-CONTRACT-008 | Weak validation, no missing-row behavior, and no audit. | Shared bounds and transactional before/after audit. | d4185812 | Go integration and visible PUT 200. |
| ADMIN-GROWTH-CAMPAIGN-LIST-CONTRACT-009 | Read RBAC and pagination/error contracts diverged. | Match Growth read permissions and surface scan/iteration failures. | d4185812 | Go filtered/paginated/DB-failure tests and headed GET 200. |
| ADMIN-GROWTH-CAMPAIGN-CREATE-CONTRACT-010 | Wrong permission/status, weak validation, non-atomic audit and post-commit lookup. | Require growth.manage+CSRF; transactionally return complete 201 response. | d4185812 | Go persistence/rollback tests and headed POST 201. |
| ADMIN-GROWTH-CAMPAIGN-MOBILE-TABLE-011 | Populated table overflowed 390px. | Keyboard-focusable internal horizontal scroller. | d4185812 | Headed 390×844 screenshot and no document overflow. |
| ADMIN-LEGAL-DUPLICATE-VERSION-COLLISION-158 | Distinct legal-policy source versions could collide after common-prefix truncation. | Preserve the source prefix and use a 96-bit SHA-256 Base32-derived suffix for long versions. | pending | Two same-prefix 32-character source versions both duplicate successfully to distinct <=32-character values. |
| ADMIN-LEGAL-TRANSITION-UUID-VALIDATION-158 | Malformed IDs reached PostgreSQL and surfaced as 500. | Validate UUID format before SQL in publish/archive/duplicate. | pending | All three malformed-ID paths return 400 in PostgreSQL-backed integration tests. |


### Wave 2 checkpoint — 2026-10-15

Twenty Admin monetization METHOD+PATH entries were individually exercised through PostgreSQL-backed real-router tests: authorized contract, roleless/anonymous denial, CSRF for mutations, persistence and audit where applicable. All 20 PASS. A malformed placement UUID regression was observed returning 500, fixed at the handler boundary, and retested to 400. The combined targeted command passed; the full Go suite remains deferred until all remaining APIs are audited. Earlier full-suite failures remain recorded and were not deleted. Wave 3 (next 20 APIs) is underway.


### Wave 3 checkpoint — 2026-10-15

All 20 Wave 3 method+path APIs passed focused PostgreSQL real-router tests. Fixed Admin summary RBAC and notification broadcast create method (PATCH→POST); the focused component test passed. The NHK Easy live source returned HTTP 401, while local controlled feed fixtures validate both successful persistence and 502 failure behavior. Full suite remains deferred until every remaining API is covered.


Wave 4 partial checkpoint: four Import Manifest/Import Staging endpoints are recorded FAIL because they currently audit but do not persist or dispatch their action. Repairs are in progress; these are not accepted as PASS.

| GAMIFICATION-CONTRACTS-159 | Gamification routes had stale learner payloads, weak query error handling, and reward claims lacked tested concurrent idempotency. | Align store DTOs and error propagation with active learner contracts; keep reward claims atomic and verify one success under concurrent requests. | pending | Wave 8 focused PostgreSQL tests PASS; concurrent login-bonus and mystery-box claims each return exactly one success and one conflict; cleanup failures now fail tests. |

| GAMIFICATION-REWARD-APPLICATION-159 | Login bonus and mystery box routes record claims but do not apply XP or other configured rewards to learner state/inventory. | Follow the configured reward types through a supported persistent reward mechanism and apply them atomically with the claim. | pending | Source trace confirms no reward application after claim insert; route contract tests PASS, gameplay effect FAIL pending fix. |

| LEARNER-KANJI-LOOKUP-CONTRACT-159 | Kanji endpoints did not support actual word/reference lookup and masked database failures. | Align lookup with canonical content and surface query failures. | pending | RED/GREEN focused PostgreSQL route tests PASS. |
| LEARNER-PRIVACY-REQUEST-CONTRACT-159 | Privacy request validation/DTO drifted from client-supported request types and trusted request identity input. | Match supported request types and derive ownership exclusively from the learner session. | pending | RED/GREEN focused PostgreSQL route tests PASS. |
| LEARNER-SHARE-PERSISTENCE-CONTRACT-159 | Share endpoints did not persist active client payload/consent or return preview/share URL contract. | Persist consent-safe share payloads and return the active share contract. | pending | RED/GREEN focused PostgreSQL route tests PASS. |
| GAMIFICATION-STREAK-MAGAZINE-ERROR-CONTRACT-159 | Streak write contract drifted and magazine query errors could be skipped as partial success. | Align streak route state and fail magazine reads on row/iteration errors. | pending | RED/GREEN focused PostgreSQL route tests PASS. |

| MEDIA-LOCAL-SIGNED-UPLOAD-159 | Presign/complete returned 503 despite the configured LocalFS bucket; pending assets could otherwise be exposed if inserted active. | Add expiring owner-bound upload token, bounded same-origin PUT to LocalFS, verify blob metadata on completion, hide pending assets, and wire the three learner upload callers to send the token in a header. | pending | Focused PostgreSQL + LocalFS test PASS; web typecheck PASS. |

| PRIVACY-EXPORT-TTL-CLEANUP-159 | Expired artifacts stayed stored if the learner never downloaded again. | Hourly PostgreSQL cleanup removes expired artifact JSON while preserving request history. | pending | TestPrivacyExportArtifactCleanup PASS: expired removed, fresh retained. |
| GAMIFICATION-INERT-REWARD-OFFERING-159 | Freeze, bonus-review and other non-XP rewards had no consumer. | Login bonus now advertises XP only; mystery box draws only XP entries with implemented effects. | pending | Targeted PostgreSQL wave tests PASS; high-weight inactive-effect fixture cannot be selected. |

Wave 12 final verification: focused privacy/gamification PostgreSQL tests PASS; learner and Admin typecheck PASS; `pnpm prisma:validate` PASS; full `go test ./...` PASS. SQL conformance baseline was refreshed to remove 21 already-resolved drift records; no new drift was accepted. Next screen: learner settings.

Screen checkpoint: learner settings anonymous state opened in visible headed Chromium at 390x844; /vi/settings redirects to /vi/me?tab=settings and anonymous access redirects to localized login with returnTo. Screen remains REMAINING until authenticated rendering and interaction/persistence checks pass.


### Reading takeover checkpoint — 2026-10-15T09:03:00Z

Current headed Reading acceptance checks PASS: fresh anonymous redirect with returnTo; real UI login; visible save PUT 200; refresh restored full_furigana and preserved showRomaji; original preference restored through the UI; mobile width 390/390px; 59905ms with zero further document navigations and zero page/console errors. Separate original-profile Chrome tab also remained stable after recovery. Raw evidence: `tmp/local-audit/reading-final-browser-evidence.json`; screenshot: `tmp/local-audit/reading-final-mobile.png`.

Runtime recovery: learner requests initially timed out through both proxy and direct Next while Go stayed healthy. Supervisor restart alone failed. Preserving/regenerating `.next/dev` restored HTTP 200; restoring the old generated cache reproduced the compile hang, and returning to the fresh cache restored service. This establishes the cache-related compile failure; it does **not** identify the initiator of the historical 17/15 repeated document loads. LEARNER-READING-RELOAD-001 stays OPEN and Reading stays REMAINING. No speculative auth/HMR/service-worker code changes were made.

`READING-1` owns only the inherited save client patch and its existing regression. Harness VALID_RED replay and GREEN PASS; canonical frontend suite PASS (473 executed, 473 passed, 0 skipped; typecheck/build/debt ratchet, no new debt); independent review APPROVE; browser_e2e evidence exit 0. Task remains open despite mechanical READY_TO_CLOSE: historical root-cause acceptance is unresolved. No screen commit; HEAD remains `9a9db770`. Next item remains Reading. Totals: screens 70 PASS + 2 FAIL + 91 REMAINING = 163; APIs 630 PASS + 0 FAIL + 3 EXTERNAL_BLOCKED = 633; defects 414 found / 407 fixed / 7 open.

Generated cache snapshots were preserved outside the repository under `/tmp/kotoba-reading-20261015`; exact previous paths and recovery evidence are in `FULL_PRODUCT_AUDIT_STATE.json`. Existing application changes were not reset, cleaned, reverted or committed.

Methodology correction (2026-10-15T09:06:01Z): Historical 17/15 counts came from __auditNavigationProbe injected with Page.addScriptToEvaluateOnNewDocument and no window===window.top filter. That counts same-origin child frames too. Controlled current probe observed topLoads=1, childLoads=1 for a single Network Document request in main frame 5FE1BC9FD945FC6EC1A4308DB95DC5D8; child about:blank had only Page.frameRequestedNavigation. Therefore the historical values must not be called exact top-level document-load counts; actual historical main-frame rate and initiator remain unverified. Preserve the original observation, do not infer it was entirely an iframe artifact. The previous audit chat is now idle. Read-only inspection of its original tab found `chrome-error://chromewebdata/` with unreachable `/vi`; no navigation was issued to that shared tab. The temporary frame probe on this task's own tab was removed after measurement.

## Release handoff 2026-10-15T12:52:44.689076+00:00

Reading settings: **PASS** for current required anonymous/authenticated/mobile/save/refresh/stability states, with further historical reload attribution explicitly waived by the user. Initiator remains unknown. Original fix commit: `4c061281`. Screens: 163 = 71 PASS + 2 FAIL + 90 REMAINING. APIs: 633 = 630 PASS + 0 FAIL + 3 EXTERNAL_BLOCKED. Next audit: `learner:/:locale/share/:token`. Audit is paused for the requested Oracle release; remaining routes are unverified, not presumed defects.
