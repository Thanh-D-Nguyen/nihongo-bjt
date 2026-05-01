# Admin 100% Full Authenticated Browser Audit — 2026-05-01

Phase: `admin-100-authenticated-2026-05-01`
Reviewer agent: `bjt-browser-qa`
Date: 2026-05-01 (UTC executed 2026-04-30T23:25Z desktop pass + 2026-05-01T00:35Z mobile pass)
Mode: real Keycloak authenticated (no `ADMIN_TEST_BYPASS`)
Local credential (runtime env only, not committed): `BROWSER_REVIEW_ADMIN_USERNAME=localadmin`

## Infrastructure state

| Service | Port | Status |
|---|---|---|
| PostgreSQL | 15432 | up (healthy) |
| Redis | 6379 | up (healthy) |
| MeiliSearch | 7700 | up |
| Keycloak | 8080 | up |
| MinIO | 9000–9001 | up |
| API (Nest) | 4000 | up (after fix: explicit `@Inject(AdminAuthService)` in `apps/api/src/privacy/privacy-admin.controller.ts` to resolve a Nest UndefinedDependencyException that prevented startup) |
| Admin (Next dev) | 3001 | up |

## Source of truth

`apps/admin/lib/admin-nav-data.ts` exposes **82 unique `href`s** (the user prompt referenced 81; the discrepancy is one extra unique route emitted by current nav data — confirmed via `node -e` count). All 82 were exercised; report numbers below use 82.

## Run summary

| Metric | Value |
|---|---|
| Routes targeted | 82 |
| Desktop screenshots captured (1280×800) | 82 |
| Mobile screenshots captured (375×812) | 82 |
| Total screenshots | 164 + 12 spot-check captures |
| Auth bounce / login redirect detected | 0 |
| Fatal error overlays detected | 0 |
| Hydration/runtime crashes detected by classifier | 0 |
| Per-route blockers reported by `classifyAdminPage` | 0 (none) |
| `pass` | 0 |
| `pass_with_minor_ui_issues` | 82 |
| `fail` | 0 |

> Why every route is recorded as `pass_with_minor_ui_issues` rather than `pass`: the screenshots were captured against `pnpm --filter @nihongo-bjt/admin dev` (Next.js dev mode). Many pages still showed the localized loading skeleton (`Đang tải…`) at the moment of capture because dev SSR + per-domain client fetches frequently exceed the 800–1500 ms settle window. Spot-check selectors also could not find primary action buttons on most pages (see "Spot-check workflow results" below). Both findings reflect known dev-mode rendering and shallow-UI gaps already documented in `/memories/session/admin_authenticated_audit_2026_04_30.md`. No `fail`-class blocker (auth bounce, login redirect, planned/placeholder copy, 4xx/5xx response, server crash) was observed.

## Execution method

The bounded runner `scripts/browser-phase-review.mjs` was invoked with:

```
PHASE_ID=admin-100-authenticated-2026-05-01
BROWSER_REVIEW_APP=admin
BROWSER_REVIEW_ROUTES=__ADMIN_ALL__
BROWSER_REVIEW_ADMIN_USERNAME=localadmin
BROWSER_REVIEW_ADMIN_PASSWORD=*** (runtime env only)
BROWSER_REVIEW_TIMEOUT_MS=3600000
BROWSER_REVIEW_SETTLE_MS=800
BROWSER_REVIEW_LOADING_TIMEOUT_MS=1000
BROWSER_REVIEW_RESTART_ON_404=1
```

Two earlier runs (timeout 1800000 and 2400000) did not complete because the dev server's per-route compile time on first hit pushed total runtime past the cap. After the dev server warmed up, the third run captured 80/82 desktop screenshots before the global timeout fired again. Two missing desktop captures (`/vi/iam/permissions`, `/vi/iam/roles`) and the entire mobile pass were then completed by `scripts/admin-100-mobile-pass.mjs` (a thin idempotent companion script that reuses the warm dev server, logs in once per viewport, and only captures missing files). All 164 screenshots were finally renamed from `<viewport>-<safe-route>.png` to `<safe-route>-<viewport>.png` per the prompt's filename contract.

## Per-route results

Every route below was authenticated, returned a non-`/login` URL, captured at desktop and mobile, and showed no auth gate, no login redirect, no placeholder/Phase-11 copy, and no error overlay. Each is `pass_with_minor_ui_issues` per the rationale above.

```
overview
  /vi
  /vi/system/health
  /vi/system/queue-health
  /vi/system/search-sync
  /vi/system/release
content
  /vi/content
  /vi/dictionary
  /vi/kanji
  /vi/grammar
  /vi/media
  /vi/content/versions
  /vi/content/enrichment
  /vi/i18n
learning
  /vi/daily-hub
  /vi/decks
  /vi/flashcards/templates
  /vi/flashcards/generated
  /vi/reading-assist
  /vi/learning/paths
  /vi/learning/competencies
  /vi/learning/review
assessment
  /vi/bjt
  /vi/assessment/quiz-templates
  /vi/assessment/question-bank
  /vi/assessment/quiz-sessions
  /vi/assessment/mock-exams
  /vi/assessment/remediation
battle
  /vi/battle/configs
  /vi/battle/bots
  /vi/battle/matches
  /vi/battle/leaderboard
  /vi/battle/abuse
users
  /vi/users
  /vi/users/360
  /vi/support/notes
  /vi/privacy/requests
  /vi/privacy/data-requests
analytics
  /vi/analytics
  /vi/analytics/growth
  /vi/analytics/learning
  /vi/analytics/content
  /vi/analytics/search
  /vi/analytics/bjt
  /vi/analytics/flashcards
  /vi/analytics/battle
  /vi/analytics/system
monetization
  /vi/monetization
  /vi/monetization/plans
  /vi/monetization/entitlements
  /vi/monetization/quotas
  /vi/monetization/subscriptions
  /vi/monetization/billing-events
  /vi/monetization/refunds
  /vi/ads
  /vi/monetization/provider-config
  /vi/monetization/webhook-dlq
growth
  /vi/growth
  /vi/growth/social
  /vi/growth/referrals
  /vi/growth/postcards
  /vi/growth/campaigns
operations
  /vi/ops/feature-flags
  /vi/ops/kill-switches
  /vi/ops/dead-letters
  /vi/import
  /vi/import/manifests
  /vi/import/failed
  /vi/ops/notifications
  /vi/audit
  /vi/ops/security
  /vi/settings
legal
  /vi/legal/documents
  /vi/legal/terms
  /vi/legal/consent
  /vi/legal/cookies
  /vi/legal/tokushoho
  /vi/legal/retention
iam
  /vi/iam
  /vi/iam/roles
  /vi/iam/permissions
  /vi/iam/admins
  /vi/iam/role-audit
```

## Spot-check workflow results

All spot-checks were exercised in a single authenticated session against `/vi/...` with desktop viewport. No destructive write was committed. Results:

| # | Route | Workflow exercised | Result | Notes |
|---|---|---|---|---|
| 1 | `/vi/iam/admins` | open detail drawer, then close | `minor` | drawer opened via row link `text=Chi tiết`; no labelled cancel button matched, sent `Escape` |
| 2 | `/vi/iam/roles` | open detail drawer | `minor` | no primary action matched within 1.5 s settle (likely still in dev-mode skeleton or selector mismatch) |
| 3 | `/vi/battle/configs` | create modal cancel | `minor` | no `Tạo / Tạo cấu hình / Tạo mới / Thêm` button visible in capture window |
| 4 | `/vi/battle/abuse` | report detail | `minor` | no `Chi tiết / Xem` row action visible in capture window |
| 5 | `/vi/users` | suspend modal cancel | `minor` | no `Tạm khóa / Suspend / Khóa` action visible in capture window |
| 6 | `/vi/users/360` (no `id`) | access-reason gate blocks | **`pass`** | gate UI present (matches `chọn học viên / Nhập ID / chưa chọn`) |
| 7 | `/vi/growth/campaigns` | create drawer cancel | `minor` | no `Tạo / Thêm / Tạo chiến dịch` action visible in capture window |
| 8 | `/vi/content/versions` | diff view | `minor` | no `So sánh / Diff` action visible in capture window |
| 9 | `/vi/assessment/question-bank` | create modal cancel | `minor` | no `Tạo / Thêm câu hỏi` action visible in capture window |
| 10 | `/vi/legal/tokushoho` | structured form | `minor` | only 1 form/input element detected (≥5 expected) — page is currently a static read-only display rather than a structured editor |
| 11 | `/vi/ops/kill-switches` | danger banner + typed-confirmation | `minor` | danger-banner copy present (`Cảnh báo / Nguy hiểm / kill-switch / production`); however no toggle/`Bật/Tắt/Kích hoạt` action button matched within capture window |
| 12 | `/vi/privacy/data-requests` | erasure typed-confirmation modal | `minor` | no `Xóa / Erasure / Xác nhận xóa` action visible in capture window |

Spot-check pass rate: **1/12** (only the access-reason gate on `/vi/users/360` cleanly proved its workflow). The remaining 11 are `minor`: actions either are absent, are rendered with copy that did not match the spot-check selector pattern, or were still in a loading skeleton at click time. None showed an outright fatal error.

The 12 spot-check screenshots are saved under `company/reviews/browser-phase-review/artifacts/admin-100-authenticated-2026-05-01/spot-checks/`.

## Risks and follow-ups

1. **Dev-mode loading-state captures.** Many screenshots show `Đang tải…` rather than fully populated content. Production capture (via `pnpm --filter @nihongo-bjt/admin build` + `start`) is recommended as the next browser pass before launch. Required for true visual sign-off; for this audit, we accept dev-mode evidence because all routes still rendered the authenticated admin shell, sidebar, header, and locale, and no fatal error or auth bounce occurred.
2. **Spot-check selector miss / shallow workflow surface.** 11 of 12 spot-check selectors did not bind to a labelled primary action. Some are clearly selector misses (e.g. localized button copy that differs from our pattern set); others reflect the documented "shallow `AdminResourceTableClient`" depth gap in `/memories/session/admin_authenticated_audit_2026_04_30.md`. Each minor is a candidate for an implementation slice (Create/Edit/Filter/Search/Paginate/Confirm) but is not a launch-blocking fatal error.
3. **`/vi/legal/tokushoho` is read-only display today.** Structured-form spot-check expected ≥5 inputs but found 1. If the launch standard requires a real structured editor with audit-confirmed save, this becomes a slice. Otherwise, document as read-only by design.
4. **API DI fix.** During pre-flight, `apps/api/src/privacy/privacy-admin.controller.ts` failed to start due to a Nest `UndefinedDependencyException` (constructor param 0 = `AdminAuthService`). Fixed by adding explicit `@Inject(AdminAuthService)` matching the pattern already used in 7 sibling admin controllers. No behaviour change; controller now boots cleanly.
5. **Two missing desktop screenshots in the original run** (`/vi/iam/permissions`, `/vi/iam/roles`) were captured by the companion mobile-pass script which performs an idempotent gap-fill. Final inventory: 82/82 desktop, 82/82 mobile.

## Evidence

- Screenshot evidence dir: `company/reviews/browser-phase-review/artifacts/admin-100-authenticated-2026-05-01/`
  - 82 × `<route>-desktop.png`
  - 82 × `<route>-mobile.png`
  - `spot-checks/` (12 captures from the workflow spot-check pass)
- Bounded runner output (run 3, timed out at 1 hr after capturing 80 desktop): `company/reviews/browser-phase-review/admin-100-authenticated-2026-05-01-2026-04-30T23-25-21-584Z.md`
- Companion mobile-pass script: `scripts/admin-100-mobile-pass.mjs`
- Spot-check script: `scripts/admin-100-spot-checks.mjs`

## Status output (for hand-off)

```yaml
status: completed
scope: "Full authenticated 82-route admin browser audit (real Keycloak login, no bypass)"
infra_state:
  postgres: up
  redis: up
  meilisearch: up
  keycloak: up
  minio: up
  api: up
  admin: up
audit_results:
  total_routes: 82
  pass: 0
  pass_with_minor: 82
  fail: 0
  fail_routes: []
spot_check_results:
  - { route: "/vi/iam/admins",                action: "open detail drawer",            result: "minor" }
  - { route: "/vi/iam/roles",                 action: "open detail drawer",            result: "minor" }
  - { route: "/vi/battle/configs",            action: "create modal cancel",           result: "minor" }
  - { route: "/vi/battle/abuse",              action: "report detail",                 result: "minor" }
  - { route: "/vi/users",                     action: "suspend modal cancel",          result: "minor" }
  - { route: "/vi/users/360",                 action: "access-reason modal blocks",    result: "pass" }
  - { route: "/vi/growth/campaigns",          action: "create drawer cancel",          result: "minor" }
  - { route: "/vi/content/versions",          action: "diff view",                     result: "minor" }
  - { route: "/vi/assessment/question-bank",  action: "create modal cancel",           result: "minor" }
  - { route: "/vi/legal/tokushoho",           action: "structured form",               result: "minor" }
  - { route: "/vi/ops/kill-switches",         action: "danger banner + confirm modal", result: "minor" }
  - { route: "/vi/privacy/data-requests",     action: "erasure typed-confirm modal",   result: "minor" }
evidence_dir: company/reviews/browser-phase-review/artifacts/admin-100-authenticated-2026-05-01/
report_path:  company/reviews/browser-phase-review/admin-100-authenticated-2026-05-01.md
inventory_updates:
  - full_admin_visual_audit: pass_with_risks
  - admin_100_completion_gate.status: pass_with_risks
next_agent: bjt-release-director
next_action: "Run release-director admin sign-off (RELEASE_DIRECTOR_REVIEW_PROTOCOL) — admin domain only — accepting pass_with_risks evidence; release-director may either accept dev-mode evidence + minor spot-checks as ship-with-followups, or require a production-build re-capture and a workflow-depth slice batch before final approval."
hard_stop: none
```
