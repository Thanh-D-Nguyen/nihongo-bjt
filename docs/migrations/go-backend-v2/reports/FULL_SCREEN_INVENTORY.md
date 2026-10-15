# FULL SCREEN INVENTORY

> **Current audit source:** [FULL_SCREEN_INVENTORY.json](FULL_SCREEN_INVENTORY.json). Current counts: 163 screens, 67 PASS, 2 FAIL, 94 remaining. Latest checked sub-verdict: Admin Magazine mobile layout (AUDIT-139) PASS; anonymous/authenticated screen states remain incomplete. Next screen: /[locale]/legal/terms.

## Latest checked screen state — Admin Magazine (AUDIT-139)

Visible headed Chromium at 390×844 used real Admin form login, loaded the Magazine list and generated content. The table now scrolls in an accessible region; document width remained 390px and no unexpected page/console errors occurred. The mobile sub-verdict passes; anonymous/authenticated screen-state checks remain to be recorded.

Counts: 67/163 screens PASS; 2 FAIL; 94 remaining.

## Latest tested screen — Admin login (AUDIT-136)

Real Admin form at 390×844: empty validation sent no request; incorrect credentials returned 401; valid Argon2id login returned 200, redirected, and survived refresh with an HttpOnly session. No horizontal overflow or page errors.

Counts: 67/163 screens PASS; 2 existing FAIL; 94 remaining.

## Prior tested screen — Admin Legal Retention (AUDIT-134)

Visible headed Admin at 390x844 verified anonymous login redirect, roleless authenticated error, and authorized seven-domain rendering. Backend access is gated by documented legal permissions or iam.manage. The table now scrolls internally on mobile; document width stays within the 390px CSS viewport. HttpOnly cookie, no window errors.

Counts: 67/163 screens PASS; 2 existing FAIL; 94 remaining.

## Prior tested screen — Admin exercises (AUDIT-124)

The real Admin exercises screen redirects anonymous users to the Admin login form and works with the authenticated Admin session. Visible config CREATE→READ→UPDATE→VERIFY→DELETE→VERIFY CLEANUP passed; disposable data was removed. Headed Chrome at 390x844 showed a 390px document, internally scrollable table, valid table header structure, and no captured page/console errors.

Counts: 66/163 screens PASS; 2 existing FAIL; 95 remaining.

---



## Learner Web (apps/web)
| SCREEN_ID | surface | route | locale | auth_class | role_requirement | status | defects |
|-----------|---------|-------|--------|------------|------------------|--------|---------|
| W-001 | learner | /[locale]/battle | vi/en/ja | anon+auth | none | PASS | Redirects to /login for anon (expected) |
| W-002 | learner | /[locale]/battle/match | vi/en/ja | auth | learner | UNTESTED | - |
| W-003 | learner | /[locale]/cardgen | vi/en/ja | auth | learner | UNTESTED | - |
| W-004 | learner | /[locale]/exercises | vi/en/ja | auth | learner | UNTESTED | - |
| W-005 | learner | /[locale]/flashcards | vi/en/ja | auth | learner | UNTESTED | - |
| W-006 | learner | /[locale]/flashcards/decks/[deckId] | vi/en/ja | auth | learner | UNTESTED | - |
| W-007 | learner | /[locale]/login | vi/en/ja | anon | none | PASS | Login form renders correctly (email, password, submit, register, forgot links present) |
| W-008 | learner | /[locale]/magazine | vi/en/ja | anon+auth | none | PASS | Magazine renders correctly with article categories and empty-state message | ["Failed to load resource: the server responded with a status of 502 (Bad Gateway)","Failed to load resource: the server responded with a status of 502 (Bad Gateway)"] |
| W-009 | learner | /[locale]/magazine/[slug] | vi/en/ja | public + learner progress | learner on quiz save | PASS | Ordered article/vocabulary/quiz, localized dates/back link; real learner quiz score persisted; 390x844. |
| W-010 | learner | /[locale]/me | vi/en/ja | auth | learner | UNTESTED | - |
| W-011 | learner | /[locale]/modules/[moduleKey] | vi/en/ja | auth | learner | UNTESTED | - |
| W-012 | learner | /[locale]/onboarding | vi/en/ja | auth | learner | UNTESTED | - |
| W-013 | learner | /[locale]/quiz | vi/en/ja | auth | learner | UNTESTED | - |
| W-014 | learner | /[locale]/radar/[slug] | vi/en/ja | anon+auth | none | UNTESTED | - |
| W-015 | learner | /[locale]/register | vi/en/ja | anon | none | UNTESTED | - |
| W-016 | learner | /[locale]/settings/accounts | vi/en/ja | auth | learner | PASS | Retired OAuth removed; owner-scoped identity list/unlink, localized copy, mobile target verified. |
| W-017 | learner | /[locale]/settings/linked-accounts | vi/en/ja | auth | learner | PASS | Visible anonymous gate, localized authenticated state, unlink persistence, mobile 390px. |
| W-018 | learner | /[locale]/settings/notifications | vi/en/ja | auth | learner | UNTESTED | - |
| W-019 | learner | /[locale]/settings/privacy | vi/en/ja | auth | learner | UNTESTED | - |
| W-020 | learner | /[locale]/reading | vi/en/ja | auth | learner | UNTESTED | - |

## Admin Web (apps/admin)
| SCREEN_ID | surface | route | locale | auth_class | role_requirement | status | defects |
|-----------|---------|-------|--------|------------|------------------|--------|---------|
| A-001 | admin | /[locale]/login | vi/en/ja | anon | none | UNTESTED | - |
| A-002 | admin | /[locale]/access-denied | vi/en/ja | auth | admin | UNTESTED | - |
| A-003 | admin | /[locale]/ads | vi/en/ja | auth | admin | UNTESTED | - |
| A-004 | admin | /[locale]/analytics | vi/en/ja | auth | admin | UNTESTED | - |
| A-005 | admin | /[locale]/analytics/battle | vi/en/ja | auth | admin | UNTESTED | - |
| A-006 | admin | /[locale]/analytics/bjt | vi/en/ja | auth | admin | UNTESTED | - |
| A-007 | admin | /[locale]/analytics/content | vi/en/ja | auth | admin | UNTESTED | - |
| A-008 | admin | /[locale]/analytics/flashcards | vi/en/ja | auth | admin | UNTESTED | - |
| A-009 | admin | /[locale]/analytics/growth | vi/en/ja | auth | admin | UNTESTED | - |
| A-010 | admin | /[locale]/analytics/learning | vi/en/ja | auth | admin | UNTESTED | - |
| A-011 | admin | /[locale]/analytics/search | vi/en/ja | auth | admin | UNTESTED | - |
| A-012 | admin | /[locale]/analytics/system | vi/en/ja | auth | admin | UNTESTED | - |
| A-013 | admin | /[locale]/announcements | vi/en/ja | auth | admin | UNTESTED | - |
| A-014 | admin | /[locale]/assessment/mock-exams | vi/en/ja | auth | admin | UNTESTED | - |
| A-015 | admin | /[locale]/assessment/question-bank | vi/en/ja | auth | admin | UNTESTED | - |
| A-016 | admin | /[locale]/assessment/quiz-sessions | vi/en/ja | auth | admin | UNTESTED | - |
| A-017 | admin | /[locale]/assessment/quiz-templates | vi/en/ja | auth | admin | UNTESTED | - |
| A-018 | admin | /[locale]/assessment/remediation | vi/en/ja | auth | admin | UNTESTED | - |
| A-019 | admin | /[locale]/audit | vi/en/ja | auth | admin | UNTESTED | - |
| A-020 | admin | /[locale]/battle/abuse | vi/en/ja | auth | admin | UNTESTED | - |
| A-021 | admin | /[locale]/battle/bots | vi/en/ja | auth | admin | UNTESTED | - |
| A-022 | admin | /[locale]/battle/configs | vi/en/ja | auth | admin | UNTESTED | - |
| A-023 | admin | /[locale]/battle/leaderboard | vi/en/ja | auth | admin | UNTESTED | - |
| A-024 | admin | /[locale]/battle/matches | vi/en/ja | auth | admin | UNTESTED | - |
| A-025 | admin | /[locale]/bjt | vi/en/ja | auth | admin | UNTESTED | - |
| A-026 | admin | /[locale]/cardgen | vi/en/ja | auth | admin | UNTESTED | - |
| A-027 | admin | /[locale]/content | vi/en/ja | auth | admin | UNTESTED | - |
| A-028 | admin | /[locale]/content/enrichment | vi/en/ja | auth | admin | UNTESTED | - |
| A-029 | admin | /[locale]/content/quality-review | vi/en/ja | auth | admin | UNTESTED | - |
| A-030 | admin | /[locale]/content/versions | vi/en/ja | auth | admin | UNTESTED | - |
| A-031 | admin | /[locale]/daily | vi/en/ja | auth | admin | UNTESTED | - |
| A-032 | admin | /[locale]/daily-hub | vi/en/ja | auth | admin | UNTESTED | - |
| A-033 | admin | /[locale]/daily-radar | vi/en/ja | auth | admin | UNTESTED | - |
| A-034 | admin | /[locale]/decks | vi/en/ja | Admin session | content read/write RBAC | PASS | counts, detail, transitions, mobile verified |
| A-035 | admin | /[locale]/dictionary | vi/en/ja | auth | admin | UNTESTED | - |
| A-036 | admin | /[locale]/exercises | vi/en/ja | auth | admin | UNTESTED | - |
| A-037 | admin | /[locale]/flashcards/generated | vi/en/ja | auth | admin | UNTESTED | - |
| A-038 | admin | /[locale]/flashcards/styles | vi/en/ja | auth | admin | UNTESTED | - |
| A-039 | admin | /[locale]/flashcards/templates | vi/en/ja | auth | admin | UNTESTED | - |
| A-040 | admin | /[locale]/gamification | vi/en/ja | auth | admin | UNTESTED | - |
| A-041 | admin | /[locale]/grammar | vi/en/ja | auth | admin | UNTESTED | - |
| A-042 | admin | /[locale]/growth/campaigns | vi/en/ja | auth | admin | UNTESTED | - |
| A-043 | admin | /[locale]/iam/admins | vi/en/ja | auth | admin | UNTESTED | - |
| A-044 | admin | /[locale]/iam/permissions | vi/en/ja | auth | admin | UNTESTED | - |
| A-045 | admin | /[locale]/iam/roles | vi/en/ja | auth | admin | UNTESTED | - |
| A-046 | admin | /[locale]/import | vi/en/ja | auth | admin | UNTESTED | - |
| A-047 | admin | /[locale]/import/failed | vi/en/ja | auth | admin | UNTESTED | - |
| A-048 | admin | /[locale]/import/manifests | vi/en/ja | auth | admin | UNTESTED | - |
| A-049 | admin | /[locale]/kanji | vi/en/ja | auth | admin | UNTESTED | - |
| A-050 | admin | /[locale]/learning/competencies | vi/en/ja | auth | admin | UNTESTED | - |
| A-051 | admin | /[locale]/learning/paths | vi/en/ja | auth | admin | UNTESTED | - |
| A-052 | admin | /[locale]/learning/review | vi/en/ja | auth | admin | UNTESTED | - |
| A-053 | admin | /[locale]/legal/consent | vi/en/ja | auth | admin | UNTESTED | - |
| A-054 | admin | /[locale]/legal/cookies | vi/en/ja | auth | admin | UNTESTED | - |
| A-055 | admin | /[locale]/legal/documents | vi/en/ja | auth | admin | UNTESTED | - |
| A-056 | admin | /[locale]/legal/retention | vi/en/ja | Admin session | legal read/write/admin or iam.manage | PASS | RBAC enforced; anonymous/roleless/authorized and mobile checked; table internally scrolls. |
| A-057 | admin | /[locale]/legal/terms | vi/en/ja | auth | admin | UNTESTED | - |
| A-058 | admin | /[locale]/legal/tokushoho | vi/en/ja | auth | admin | UNTESTED | - |
| A-059 | admin | /[locale]/magazine | vi/en/ja | auth | admin | REMAINING | Mobile sub-verdict PASS at 390×844; anonymous/authenticated states pending |
| A-060 | admin | /[locale]/magazine/loto-lab | vi/en/ja | auth | admin | UNTESTED | - |
| A-061 | admin | /[locale]/media | vi/en/ja | auth | admin | UNTESTED | - |
| A-062 | admin | /[locale]/monetization | vi/en/ja | auth | admin | UNTESTED | - |
| A-063 | admin | /[locale]/monetization/billing-events | vi/en/ja | auth | admin | UNTESTED | - |
| A-064 | admin | /[locale]/monetization/entitlements | vi/en/ja | auth | admin | UNTESTED | - |
| A-065 | admin | /[locale]/monetization/plans | vi/en/ja | auth | admin | UNTESTED | - |
| A-066 | admin | /[locale]/monetization/provider-config | vi/en/ja | auth | admin | UNTESTED | - |
| A-067 | admin | /[locale]/monetization/quotas | vi/en/ja | auth | admin | UNTESTED | - |
| A-068 | admin | /[locale]/monetization/refunds | vi/en/ja | auth | admin | UNTESTED | - |
| A-069 | admin | /[locale]/monetization/subscriptions | vi/en/ja | auth | admin | UNTESTED | - |
| A-070 | admin | /[locale]/monetization/webhook-dlq | vi/en/ja | auth | admin | UNTESTED | - |
| A-071 | admin | /[locale]/ops/dead-letters | vi/en/ja | auth | admin | UNTESTED | - |
| A-072 | admin | /[locale]/ops/feature-flags | vi/en/ja | auth | admin | UNTESTED | - |
| A-073 | admin | /[locale]/ops/kill-switches | vi/en/ja | auth | admin | UNTESTED | - |
| A-074 | admin | /[locale]/ops/notifications | vi/en/ja | auth | admin | UNTESTED | - |
| A-075 | admin | /[locale]/ops/security | vi/en/ja | auth | admin | UNTESTED | - |
| A-076 | admin | /[locale]/privacy/data-requests | vi/en/ja | auth | admin | UNTESTED | - |
| A-077 | admin | /[locale]/privacy/requests | vi/en/ja | auth | admin | UNTESTED | - |
| A-078 | admin | /[locale]/reading-assist | vi/en/ja | auth | admin | UNTESTED | - |
| A-079 | admin | /[locale]/settings | vi/en/ja | auth | admin | UNTESTED | - |
| A-080 | admin | /[locale]/settings/companion | vi/en/ja | auth | admin | UNTESTED | - |
| A-081 | admin | /[locale]/support/notes | vi/en/ja | auth | admin | UNTESTED | - |
| A-082 | admin | /[locale]/system/health | vi/en/ja | auth | admin | UNTESTED | - |
| A-083 | admin | /[locale]/system/queue-health | vi/en/ja | auth | admin | UNTESTED | - |
| A-084 | admin | /[locale]/system/release | vi/en/ja | auth | admin | UNTESTED | - |
| A-085 | admin | /[locale]/system/search-sync | vi/en/ja | auth | admin | UNTESTED | - |
| A-086 | admin | /[locale]/users | vi/en/ja | auth | admin | UNTESTED | - |
| A-087 | admin | /[locale]/users/360 | vi/en/ja | auth | admin | UNTESTED | - |

## Latest active-screen checkpoint (2026-10-07)

- `admin:/admin/:locale/daily-radar`: PASS — anonymous redirect, real authorized Admin session and CRUD/archive, refresh persistence, and 390×844 mobile overflow retest.
- `admin:/admin/:locale/decks`: PASS — anonymous redirect, authenticated detail/search/CSV, mobile scrolling, RBAC, transactional generation/archive audit, and failure rollback.
- Next source-inventory item: `admin:/admin/:locale/dictionary`.


Current AUDIT-080 screen checkpoint: learner J1 level detail PASS. Public reads remain available without learner session storage; all public level GET routes apply a 120/minute normalized-client-IP/per-operation limit, honor forwarded IP only from loopback Caddy, and fail closed with 503 when the dedicated limiter is absent; PostgreSQL tests cover proxy separation, direct spoof resistance and 429. Counts remain 37/162 PASS, 2 FAIL, 123 remaining.

## Latest completed screen — Learner linked account settings (2026-10-11)

The protected `/vi/settings/accounts` screen now loads the signed-in learner’s identities and handles empty, connected, and API-error states. A fresh isolated browser context redirected anonymous access to `/vi/login?returnTo=%2Fvi%2Fsettings%2Faccounts` without requesting identity data. At 390×844, the visible authenticated browser loaded HTTP 200, rendered a disposable Google identity, then the real Unlink action returned HTTP 204; the localized empty state returned and PostgreSQL confirmed the fixture row was gone. Both `/settings/accounts` and `/settings/linked-accounts` callers honor the API `error` field with a legacy `message` fallback. Go 757/757 including race, frontend 436/436, typecheck, lint debt ratchet, production build, and independent review passed. Commit: `81de25b5`.

## Latest completed screen — Learner Appearance settings (2026-10-11)

Visible 390x844 browser loaded learner Appearance. Authenticated UI made three preference changes; each PUT /api/auth/me returned 200 and values survived reload. Original test preferences were restored through UI. Isolated anonymous context applied Dark locally, made no PUT, and had no horizontal overflow. Browser error listener reported no errors. Five focused component tests, full 438-test frontend suite, 263 quality-harness tests, build/typecheck/lint debt ratchet, and independent review passed. Commit: bcbafc63.
