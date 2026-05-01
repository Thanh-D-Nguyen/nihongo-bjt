# Admin 100 Completion — Browser Visual Audit (2026-04-30)

Phase ref: ADMIN-100-AUDIT
Reviewer agent: bjt-browser-qa
Policy: `company/BROWSER_PHASE_REVIEW_POLICY.md` (Full Admin Visual Audit)
Spec: `.github/prompts/48_browser_phase_review.prompt.md`
Inventory ref: `company/admin-module-inventory.md` (81 implemented routes, 0 scaffold renderers, 0 disabled flags, 0 planned-notice)

## Executable command

Admin dev server was already running on `http://127.0.0.1:3001` (PID 12126, `pnpm --filter @nihongo-bjt/admin run dev`). Audit reused the live server.

```bash
mkdir -p test-results/admin-100-browser-audit
PHASE_ID=ADMIN-100-AUDIT \
BROWSER_REVIEW_APP=admin \
BROWSER_REVIEW_LOCALE=vi \
BROWSER_REVIEW_ROUTES=__ADMIN_ALL__ \
BROWSER_REVIEW_TIMEOUT_MS=900000 \
BROWSER_REVIEW_SERVER_TIMEOUT_MS=10000 \
BROWSER_REVIEW_RESTART_ON_404=0 \
BROWSER_REVIEW_OUT_DIR=test-results/admin-100-browser-audit \
node scripts/browser-phase-review.mjs
```

Runner expansion: `__ADMIN_ALL__` resolved to **81 admin routes** from `apps/admin/lib/admin-nav-data.ts`.

## Runner result

- Bounded runner status: **PASS** (no 4xx, 5xx, route timeouts, or navigation errors).
- Screenshots captured: **162** (81 routes × {desktop 1440×1000, mobile 390×844}).
- Artifacts: `test-results/admin-100-browser-audit/artifacts/ADMIN-100-AUDIT-2026-04-30T11-32-18-119Z/`.
- Report: `test-results/admin-100-browser-audit/admin-100-audit-2026-04-30T11-32-18-119Z.md`.
- HTTP spot-check (curl, all 200): `/vi`, `/vi/system/health`, `/vi/content`, `/vi/dictionary`, `/vi/learning/paths`, `/vi/learning/competencies`, `/vi/assessment/quiz-templates`, `/vi/assessment/mock-exams`, `/vi/assessment/remediation`, `/vi/battle/configs`, `/vi/battle/bots`, `/vi/battle/leaderboard`, `/vi/battle/abuse`, `/vi/users`, `/vi/users/360`, `/vi/analytics`, `/vi/monetization`, `/vi/iam`, `/vi/legal/consent`, `/vi/settings`.
- Placeholder text scan (`planned notice|will be implemented|Phase 11|coming soon|renderAdminScaffold|under construction`) on 23 representative routes: **0 hits** in HTML payload.

## Visual evidence verdict — auth blocker

Inspection of captured PNGs and SSR HTML shows every admin route renders the same authenticating-session loading state, not the actual admin UI:

- Visible body text (server-rendered, locale `vi`): `Đang xác thực phiên quản trị…`
- Source: `apps/admin/app/[locale]/layout.tsx` wraps every admin page in `AdminKeycloakSessionGate` (`apps/admin/app/_components/admin-keycloak-session-gate.tsx`).
- Gate behavior in headless mode:
  - `isAdminKeycloakEnabled()` returns `true` because `NEXT_PUBLIC_*KEYCLOAK*` env vars are set.
  - Gate calls `/api/admin/session` via `adminApiFetch`, which first hits `/api/auth/keycloak/session`.
  - Without a Keycloak SSO cookie the upstream session endpoint returns **401** (verified: `curl /api/auth/keycloak/session → 401`, `curl /api/admin/session → 404` — gateway only mounts when an authenticated session token is supplied).
  - On 401 the gate calls `router.replace(/${locale}/login?returnTo=…)`. Playwright captures the pre-redirect busy state at `domcontentloaded` (15 s default), so all 162 screenshots are essentially identical loading screens.
- Net: the bounded runner technically passes (no errors, no 4xx, screenshots captured), but the screenshots are **not visual evidence of the actual admin pages**; they are evidence of the auth gate.

Sample screenshots viewed: `desktop-vi.png`, `desktop-vi-dictionary.png` — both show the centered busy label on the paper background, no nav, no content.

## Per-route status (representative sample, locale `vi`)

| HTTP | Route | Placeholder text | Visual content |
|---|---|---|---|
| 200 | /vi | none | auth gate (busy) |
| 200 | /vi/system/health | none | auth gate (busy) |
| 200 | /vi/content | none | auth gate (busy) |
| 200 | /vi/dictionary | none | auth gate (busy) |
| 200 | /vi/learning/paths | none | auth gate (busy) |
| 200 | /vi/learning/competencies | none | auth gate (busy) |
| 200 | /vi/assessment/quiz-templates | none | auth gate (busy) |
| 200 | /vi/assessment/mock-exams | none | auth gate (busy) |
| 200 | /vi/assessment/remediation | none | auth gate (busy) |
| 200 | /vi/battle/configs | none | auth gate (busy) |
| 200 | /vi/battle/bots | none | auth gate (busy) |
| 200 | /vi/battle/leaderboard | none | auth gate (busy) |
| 200 | /vi/battle/abuse | none | auth gate (busy) |
| 200 | /vi/users | none | auth gate (busy) |
| 200 | /vi/users/360 | none | auth gate (busy) |
| 200 | /vi/analytics | none | auth gate (busy) |
| 200 | /vi/monetization | none | auth gate (busy) |
| 200 | /vi/growth | none | auth gate (busy) |
| 200 | /vi/iam | none | auth gate (busy) |
| 200 | /vi/content/versions | none | auth gate (busy) |
| 200 | /vi/content/enrichment | none | auth gate (busy) |
| 200 | /vi/settings | none | auth gate (busy) |
| 200 | /vi/legal/consent | none | auth gate (busy) |
| 200 | /vi/login | n/a | renders public login route (no admin chrome) |

Same pattern holds for the remaining 58 routes captured by the runner (all reachable, all gated).

## Blockers

1. **Headless authentication unavailable** — the Playwright runner has no Keycloak realm/user/cookie to satisfy `AdminKeycloakSessionGate`. This is the standard production posture; admin is correctly locked behind Keycloak. Without test credentials or a documented bypass, no headless agent can capture authenticated admin chrome/content for any of the 81 routes.
2. **No browser-evidence path was provided in the task** — the prompt notes this scenario explicitly: "If you cannot authenticate easily in headless mode, document the auth blocker."

## Source-side completion signals (cross-check)

These are evidence-of-completion that do not require a browser session:

- 81/81 nav items implemented (per `company/admin-module-inventory.md`).
- 0 routes route to `renderAdminScaffoldForId(...)`; 0 enabled nav items have `status: "scaffold"`.
- 0 occurrences of placeholder strings (`planned notice`, `will be implemented`, `Phase 11`, `coming soon`, `under construction`) in served HTML across the 23 sampled routes.
- Typecheck: 8/8 PASS, build: 6/6 PASS (per upstream phase report).
- All 81 routes return HTTP 200 (no 404/500 from missing route segments).
- Auth gate itself is functioning correctly (401 → redirect-to-login flow), which is itself a positive finding for IAM hardening.

## Recommendation

**`auth_unavailable_needs_authenticated_rerun`** — do not accept source-only review as full admin production-ready evidence.

Source-level Admin 100 gate criteria (no scaffolds, all nav implemented, all routes 200, no placeholder copy, typecheck/build green) are met. Browser visual confirmation of authenticated admin chrome/content for the 81 routes cannot be produced in this environment without one of:

- a Keycloak test user (realm + username + password) and a one-time login script that captures storageState for Playwright reuse, or
- a documented `ADMIN_TEST_BYPASS` env flag wired into the admin app and API, or
- a seeded admin session cookie injected at runner start.

Resolution added after this audit:

- `ADMIN_TEST_BYPASS=1` on the API and `NEXT_PUBLIC_ADMIN_TEST_BYPASS=1` on the admin app now provide a local/test-only authenticated browser QA path.
- The bypass is disabled in `NODE_ENV=production` and only accepts local API requests (`localhost`, `127.0.0.1`, `::1`).
- The backend still requires a real seeded `authz.admin_actor` through `x-admin-actor-id`, so internal RBAC remains active.

Next action:

1. Restart API with `ADMIN_TEST_BYPASS=1`.
2. Restart admin app with `NEXT_PUBLIC_ADMIN_TEST_BYPASS=1` and `NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID=00000000-0000-4000-8000-000000000001`.
3. Rerun the same `__ADMIN_ALL__` browser audit.
4. If screenshots show admin chrome/content and workflows pass, continue to Release Director admin sign-off. If not, reopen the failed admin slice.

## Artifacts

- Findings file: `company/admin-100-browser-audit-2026-04-30.md` (this file)
- Runner report: `test-results/admin-100-browser-audit/admin-100-audit-2026-04-30T11-32-18-119Z.md`
- Screenshots (162): `test-results/admin-100-browser-audit/artifacts/ADMIN-100-AUDIT-2026-04-30T11-32-18-119Z/`
- Auth gate source: `apps/admin/app/_components/admin-keycloak-session-gate.tsx`, `apps/admin/app/[locale]/layout.tsx`
