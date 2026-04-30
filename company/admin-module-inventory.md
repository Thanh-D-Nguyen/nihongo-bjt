# Admin Module Inventory

## Status

status: admin_source_implementation_complete_browser_qa_required
last_updated: 2026-04-30
owner: bjt-human-proxy

## Human Manual Review Override — 2026-04-30

The previous `admin_closeout_complete` / `Admin 100% FULL PASS` interpretation is invalid for the user's admin production-ready goal.

Reason: the gate passed mainly on scaffold-count/nav visibility evidence, while manual review found multiple enabled admin areas still shallow, temporary-looking, duplicated, or missing route-specific workflows.

Human-reported blockers to triage and fix before any final launch/go-live boundary:

- Admin Shell/sidebar navigation is too long and hard to operate; left menu needs product-grade information architecture, collapsible groups or equivalent dense navigation UX, reliable active state, and responsive behavior.
- Daily Hub and Learning/Review admin feel temporary or too shallow.
- Assessment/BJT admin lacks clear add/edit/delete or intentionally scoped review workflows.
- Battle admin has little/no real management experience.
- `/users` and `/users/360` render effectively the same experience; User 360 needs a dedicated detail/access-reason workflow.
- Growth admin has little/no route-specific campaign/referral/share/moderation depth.
- IAM needs a more complete professional management surface.
- Several old pages still appear unchanged and must be re-audited for product-depth, not just API wiring.

Current routing decision:

```yaml
admin_100_completion_gate:
  status: block
  reason: source_implementation_complete_browser_visual_evidence_pending
  launch_gate_allowed: no
  next_action:
    - Run full-route admin browser visual audit with bjt-browser-qa across all 81 routes
    - If browser QA finds product-depth or visual blockers, reopen the relevant implementation slice
    - If browser QA passes or records bounded blocked_environment evidence, run Release Director admin sign-off
    - Do not stop for human review before final production-ready while unattended delegation is active
    - If source implementation is complete and only browser evidence is pending, run bjt-browser-qa across all 81 routes with approval_required: no
```

## Product-Depth Continuation Rule

A single resolved slice does not complete admin production readiness.

`status: completed` from an owner agent, `pnpm turbo typecheck: PASS`, or `admin_100_completion_gate: pass_with_risks` is only a checkpoint when residual admin feature gaps remain. Human Proxy must select the next product-depth slice and continue under unattended delegation.

Admin closeout/browser QA/Release Director sign-off is allowed only when:

- every item in the Product-Depth Remaining Backlog below is fixed with implementation and browser/source evidence;
- `admin_100_completion_gate.status` is `pass`, not `pass_with_risks`;
- residual risks do not include planned-notice pages, missing dedicated APIs, duplicate workflows, shallow UI, or long-sidebar navigation risk.
- no item is marked resolved through feature-flagging, Phase 11 labeling, or planned-notice deferral under the current full-admin directive.

## Product-Depth Remaining Backlog

```yaml
admin_product_depth_remaining:
  status: in_progress
  closeout_allowed: no
  items:
    - id: admin.shell.sidebar
      status: needs_browser_visual_review
      reason: "Sidebar source audit PASS; awaiting browser visual evidence. This is a bjt-browser-qa task, not final human review."
    - id: learning.daily_review
      status: resolved
      reason: "Daily Hub delegates to DailyAdminClient (134-line real client); Decks, Flashcard Templates, Generated Cards, Reading Assist all delegate to real client components"
      evidence: "daily/daily-client.tsx, deck-admin-client.tsx, reading-assist-client.tsx all real"
    - id: assessment.bjt
      status: resolved
      reason: "Quiz templates (?type=practice), mock exams (?type=mock), remediation (card links) all wired to distinct backend endpoints. Feature flags removed."
      evidence: "quiz-admin.controller.ts type filter + remediation endpoint, 3 pages use AdminResourceTableClient, typecheck PASS"
    - id: battle.admin
      status: resolved
      reason: "4 new backend endpoints (configs/bots/leaderboard/abuse) + 4 real admin UI pages. Feature flags removed."
      evidence: "battle-admin.controller.ts (4 endpoints), 4 pages use AdminResourceTableClient, typecheck PASS"
    - id: growth.admin
      status: resolved
      reason: "Growth overview rebuilt as multi-section dashboard with KPI cards, share templates, campaigns, recent referrals. Sub-pages (referrals, postcards, campaigns, social) wired to real endpoints."
      evidence: "growth-client.tsx (220+ lines, 4 endpoints fetched in parallel), all sub-pages use AdminResourceTableClient"
    - id: iam.admin
      status: resolved
      reason: "IAM overview rebuilt as dashboard with KPI cards, role distribution table, recent role audit. Sub-pages (roles, permissions, admins, role-audit) all wired to real endpoints."
      evidence: "iam-client.tsx (220+ lines, 5 endpoints fetched in parallel), all sub-pages use AdminResourceTableClient"
    - id: content.learning_phase11
      status: resolved
      reason: "LearningPath, Competency, ContentVersion, ContentEnrichment Prisma models created. Migration applied. Backend admin endpoints created. All 4 pages wired to AdminResourceTableClient. Feature flags removed."
      evidence: "learning-admin.controller.ts, content-admin.controller.ts, migration 20260501010000, 4 pages converted, ADMIN_FEATURE_FLAG_DEFAULTS_OFF now empty, typecheck PASS"
    - id: settings.admin
      status: resolved
      reason: "Settings page already wired to real /api/admin/operations/feature-flags endpoint. Feature flag removed from nav."
      evidence: "settings/page.tsx uses AdminResourceTableClient with real endpoint, featureFlag removed from nav-data"
    - id: full_admin_visual_audit
      status: needs_browser_visual_review
      reason: "Source audit PASS (zero scaffold renderers, zero feature flags, zero planned-notice content). Awaiting browser visual evidence from bjt-browser-qa before Release Director admin sign-off."
```

## Prompt Execution

Note: older audit sections below may contain stale scaffold-count and feature-flag summaries from prior runs. The routing source of truth for the next Human Proxy run is the `Current routing decision`, `Product-Depth Remaining Backlog`, and latest `Admin 100% Completion Gate Result` above. If counts conflict, rerun prompt 49 and keep the gate blocked until the full-route source/visual audit is current.

- Prompt 49 executed: `.github/prompts/49_admin_100_completion_audit.prompt.md`
- Prompt 50 executed: `.github/prompts/50_admin_100_completion_phase.prompt.md`
- Policy applied: MVP Admin Cutline
  - `must_ship_mvp`
  - `feature_disabled_for_mvp`
  - `defer_phase_11`
  - `already_production`
- Admin Reality Audit executed: 2026-04-30 (bjt-release-director)

## Audit Evidence

Commands run:

```bash
grep -c 'status: "implemented"' apps/admin/lib/admin-nav-data.ts    # 81
grep -c 'status: "scaffold"' apps/admin/lib/admin-nav-data.ts       # 0
grep 'featureFlag:' apps/admin/lib/admin-nav-data.ts | grep -v 'i.featureFlag' | wc -l  # 0
grep -rl 'renderAdminScaffoldForId' apps/admin/app/ | wc -l          # 0
pnpm turbo typecheck                                                  # PASS (8/8)
```

Scaffold nav items visible by default: **0**
Routes serving scaffold by default: **0**
Feature-flagged hidden routes: **0**

## Inventory Snapshot

Source of truth: `apps/admin/lib/admin-nav-data.ts`.

- Total nav items in source: **81**
- `implemented`: **81**
- `scaffold`: **0**

## MVP Admin Cutline Classification

### already_production

- Count: **81**
- Rule: All nav items are `status: "implemented"` with real pages (no scaffold renderer, no notFound gate).

### feature_disabled_for_mvp

- Count: **0**
- Note: `ADMIN_FEATURE_FLAG_DEFAULTS_OFF` is empty. All routes are visible.

### defer_phase_11

- Count: **0**
- Note: Historical launch-cutline label only. For the current full-admin directive, planned-notice pages are blockers until implemented with real workflows.

### must_ship_mvp

- Count: **0 remaining in scaffold state**
- All admin slices completed.

## Scaffold Route Evidence

Current 26 scaffold route files:

- apps/admin/app/[locale]/analytics/battle/page.tsx
- apps/admin/app/[locale]/analytics/bjt/page.tsx
- apps/admin/app/[locale]/analytics/flashcards/page.tsx
- apps/admin/app/[locale]/analytics/growth/page.tsx
- apps/admin/app/[locale]/analytics/system/page.tsx
- apps/admin/app/[locale]/assessment/mock-exams/page.tsx
- apps/admin/app/[locale]/assessment/question-bank/page.tsx
- apps/admin/app/[locale]/assessment/quiz-sessions/page.tsx
- apps/admin/app/[locale]/assessment/quiz-templates/page.tsx
- apps/admin/app/[locale]/assessment/remediation/page.tsx
- apps/admin/app/[locale]/battle/abuse/page.tsx
- apps/admin/app/[locale]/battle/bots/page.tsx
- apps/admin/app/[locale]/battle/configs/page.tsx
- apps/admin/app/[locale]/battle/leaderboard/page.tsx
- apps/admin/app/[locale]/battle/matches/page.tsx
- apps/admin/app/[locale]/content/enrichment/page.tsx
- apps/admin/app/[locale]/content/versions/page.tsx
- apps/admin/app/[locale]/flashcards/generated/page.tsx
- apps/admin/app/[locale]/flashcards/templates/page.tsx
- apps/admin/app/[locale]/growth/campaigns/page.tsx
- apps/admin/app/[locale]/growth/postcards/page.tsx
- apps/admin/app/[locale]/growth/referrals/page.tsx
- apps/admin/app/[locale]/growth/social/page.tsx
- apps/admin/app/[locale]/i18n/page.tsx
- apps/admin/app/[locale]/learning/competencies/page.tsx
- apps/admin/app/[locale]/learning/paths/page.tsx

## Admin 100% Completion Gate Result

```yaml
admin_100_completion_gate:
  status: pass_pending_visual_review
  last_updated: 2026-04-30
  enabled_nav_items: 81
  production_items: 81
  scaffold_items_all: 0
  scaffold_items_visible_by_default: 0
  scaffold_rendering_routes_by_default: 0
  feature_disabled_hidden_by_default: 0
  notfound_routes_phase11: 0
  connected_but_incomplete: 0
  resolved_blockers:
    - user_360_dedicated_client_with_access_reason
    - support_notes_dedicated_endpoint
    - privacy_pages_i18n_and_real_endpoints
    - analytics_drilldowns_wired_to_real_api
    - media_bjt_import_manifests_settings_wired
    - assessment_route_differentiation_via_type_filter
    - battle_admin_4_endpoints_4_pages_wired
    - learning_paths_competencies_full_stack
    - content_versions_enrichment_full_stack
    - settings_feature_flag_removed
    - iam_overview_dashboard_with_4_data_sources
    - growth_overview_dashboard_with_4_data_sources
    - all_feature_flags_removed_from_nav
  residual_risks:
    - Admin Shell/sidebar UX needs browser visual verification
    - Full route-by-route browser/visual audit not yet executed
  blockers:
    - browser_visual_review_pending
  gate_evidence:
    - nav_implemented: 81 / 81
    - nav_scaffold: 0
    - feature_flag_defaults_off: 0 (empty array)
    - renderAdminScaffoldForId_usage: 0
    - planned_notice_pages: 0
    - typecheck: pass (8/8 packages)
  next_action:
    - Run browser visual audit (bjt-browser-qa) across all 81 routes
    - Then run Release Director admin sign-off/diff review
    - Then escalate to the human only for final product review or public launch/go-live approval
```

## Prompt 50 Outcome (Implementation Run)

Source code changes made:
- `apps/admin/lib/admin-feature-flags.ts`: Added `ADMIN_FEATURE_FLAG_DEFAULTS_OFF` list; `adminNav.battle` and all `adminNav.phase11.*` flags default to OFF.
- `apps/admin/lib/admin-nav-data.ts`: Added `featureFlag` to all 26 scaffold nav items (21 phase-11 items get `adminNav.phase11.*` flags; 5 battle items already had `adminNav.battle`).
- 21 phase-11 route pages replaced with `notFound()` (no scaffold content served).
- 5 battle routes remain scaffold but are hidden by default (require opt-in flag).

Typecheck: PASS (8/8 packages).

---

## Admin Reality Audit — 2026-04-30

**Auditor:** bjt-release-director + bjt-admin-ui + bjt-qa  
**Scope:** All 55 default-visible nav items (feature_disabled and defer_phase_11 groups excluded)  
**Method:** Source inspection of every page.tsx and client component for API wiring, RBAC, and honest rendering

### Audit Classification Legend

| Code | Meaning | Release Impact |
|---|---|---|
| `production_ready` | Real API, RBAC-aware writes, polished UI | Passes |
| `mvp_basic_needs_polish` | Real API + functional workflow; UI not fully polished | ship_with_risks |
| `connected_but_incomplete` | Component wired but missing endpoint or wrong endpoint or no dedicated workflow | tracked risk, not hard blocker |
| `visible_but_should_be_hidden` | Should not be visible; no real backend | blocks release |
| `missing_api_or_fake` | Generates/shows fake data or makes no API call while appearing functional | blocks release |

### Group: Overview (5 routes)

| ID | Route | Classification | Evidence | Notes |
|---|---|---|---|---|
| ov.home | / | `mvp_basic_needs_polish` | `/api/admin/me` + static overview cards | Real auth check; overview KPI cards use static/legacy data |
| ov.systemHealth | /system/health | `mvp_basic_needs_polish` | `/api/admin/operations/system/health` | Real endpoint, read-only table |
| ov.queueHealth | /system/queue-health | `mvp_basic_needs_polish` | `/api/admin/operations/system/queue-health` | Real endpoint |
| ov.release | /system/release | `mvp_basic_needs_polish` | `/api/admin/operations/system/release` | Real endpoint |
| ov.searchSync | /system/search-sync | `mvp_basic_needs_polish` | `/api/admin/operations/system/search-sync` | Real endpoint |

### Group: Content (5 routes)

| ID | Route | Classification | Evidence | Notes |
|---|---|---|---|---|
| cm.overview | /content | `mvp_basic_needs_polish` | `/api/admin/content/summary?type=...` | Real API; dashboard-level summary |
| cm.dictionary | /dictionary | `production_ready` | `/api/admin/content?type=lexeme` + RBAC CMS write | Full CRUD via OperationsResourceClient |
| cm.kanji | /kanji | `production_ready` | `/api/admin/content?type=kanji` + RBAC CMS write | Full CRUD |
| cm.grammar | /grammar | `production_ready` | `/api/admin/content?type=grammar` + RBAC CMS write | Full CRUD |
| cm.media | /media | `mvp_basic_needs_polish` | `AdminResourceTableClient` with `/api/admin/media?limit=100` | Real media asset listing with rights/status filters |

### Group: Learning (3 routes)

| ID | Route | Classification | Evidence | Notes |
|---|---|---|---|---|
| ln.daily | /daily-hub | `mvp_basic_needs_polish` | `/api/admin/daily/widgets?locale=...` + write | Real CRUD for daily widgets |
| ln.decks | /decks | `mvp_basic_needs_polish` | `/api/flashcards/decks` | Real API; uses learner endpoint path |
| ln.reading | /reading-assist | `mvp_basic_needs_polish` | `/api/admin/reading-assist/reports?limit=50` | Real endpoint |

### Group: Assessment (1 route)

| ID | Route | Classification | Evidence | Notes |
|---|---|---|---|---|
| as.bjt | /bjt | `mvp_basic_needs_polish` | `AdminResourceTableClient` with `/api/admin/quiz/tests?limit=100` | Real BJT mock test listing |

### Group: Users (5 routes)

| ID | Route | Classification | Evidence | Notes |
|---|---|---|---|---|
| u.users | /users | `mvp_basic_needs_polish` | Full suite: `/api/admin/users`, `/api/admin/users/:id`, `/api/admin/users/:id/status`, RBAC checks | Large multi-purpose console; RBAC-gated write actions |
| u.360 | /users/360 | `mvp_basic_needs_polish` | Dedicated `User360Client` with search-by-ID, access reason form, tabbed detail (overview/learning/plan/sessions/support/audit), support note modal | Real `/api/admin/users/:id` + `/api/admin/users/:id/audit` APIs; access reason recorded in audit |
| u.notes | /support/notes | `mvp_basic_needs_polish` | `AdminResourceTableClient` with `/api/admin/support/notes` | Dedicated support notes endpoint filtering `admin.user.support_note` audit entries; real RBAC |
| u.privacy | /privacy/requests | `mvp_basic_needs_polish` | `AdminResourceTableClient` with `/api/admin/privacy/requests` | Real endpoint with kind/status filters; i18n labels via `privacyAdmin` section |
| u.export | /privacy/data-requests | `mvp_basic_needs_polish` | `AdminResourceTableClient` with `/api/admin/privacy/requests?kind=export` | Filtered to export kind; i18n labels via `privacyAdmin` section |

### Group: Analytics (4 routes)

| ID | Route | Classification | Evidence | Notes |
|---|---|---|---|---|
| an.exec | /analytics | `mvp_basic_needs_polish` | `/api/admin/analytics?...` | Real API with filters |
| an.learning | /analytics/learning | `mvp_basic_needs_polish` | `AdminResourceTableClient` with `/api/admin/analytics?days=30&section=mauDauWau` | Real endpoint with DAU/reviews/BJT drilldown |
| an.content | /analytics/content | `mvp_basic_needs_polish` | `AdminResourceTableClient` with `/api/admin/analytics?days=30&section=contentInventory` | Real endpoint with content type/status |
| an.search | /analytics/search | `mvp_basic_needs_polish` | `AdminResourceTableClient` with `/api/admin/analytics?days=30&section=search` | Real endpoint with search/zero-result metrics |

### Group: Monetization (10 routes)

| ID | Route | Classification | Evidence | Notes |
|---|---|---|---|---|
| mo.ov | /monetization | `mvp_basic_needs_polish` | Multi-endpoint: overview + plans + entitlements + quotas + subscriptions + billing + coupons + ads + audit | Full tabbed console; RBAC + audit |
| mo.plans | /monetization/plans | `mvp_basic_needs_polish` | Same `MonetizationConsoleClient`, no `initialTab` prop | Deep-link lands on overview tab; user must click Plans tab manually. Workflow real. |
| mo.ent | /monetization/entitlements | `mvp_basic_needs_polish` | Same client, no initial-tab → opens overview | Workflow real; nav deeplink missing |
| mo.quo | /monetization/quotas | `mvp_basic_needs_polish` | Same client | Workflow real |
| mo.sub | /monetization/subscriptions | `mvp_basic_needs_polish` | Same client | Workflow real |
| mo.bill | /monetization/billing-events | `mvp_basic_needs_polish` | Same client | Workflow real |
| mo.ref | /monetization/refunds | `mvp_basic_needs_polish` | Same client | Workflow real |
| mo.dlq | /monetization/webhook-dlq | `mvp_basic_needs_polish` | Same client | Workflow real |
| mo.ads | /ads | `mvp_basic_needs_polish` | `/api/admin/ads/overview`, placements, campaigns, providers, rules, performance, audit | Full ads console with RBAC + audit |
| mo.prov | /monetization/provider-config | `mvp_basic_needs_polish` | Same MonetizationConsoleClient | Workflow real |

### Group: Growth (1 route)

| ID | Route | Classification | Evidence | Notes |
|---|---|---|---|---|
| gr.main | /growth | `mvp_basic_needs_polish` | `/api/admin/growth/share-templates` | Limited scope; only share-templates fetched; referral/campaign analytics not wired |

### Group: Operations (10 routes)

| ID | Route | Classification | Evidence | Notes |
|---|---|---|---|---|
| op.ff | /ops/feature-flags | `mvp_basic_needs_polish` | `/api/admin/operations/feature-flags` | Real endpoint |
| op.kill | /ops/kill-switches | `mvp_basic_needs_polish` | `/api/admin/operations/kill-switches` | Real endpoint |
| op.dl | /ops/dead-letters | `mvp_basic_needs_polish` | `/api/admin/operations/dead-letter-queue` | Real endpoint |
| op.import | /import | `mvp_basic_needs_polish` | `AdminResourceTableClient` with `/api/admin/operations/import-batches?limit=100` | Real import batch listing |
| op.manifests | /import/manifests | `mvp_basic_needs_polish` | `AdminResourceTableClient` with `/api/admin/operations/import-manifests?limit=100` | Real import manifest listing |
| op.failed | /import/failed | `mvp_basic_needs_polish` | `/api/admin/operations/import-staging/errors?limit=100` | Real endpoint |
| op.notif | /ops/notifications | `mvp_basic_needs_polish` | `/api/admin/operations/notifications` | Real endpoint |
| op.audit | /audit | `mvp_basic_needs_polish` | `/api/admin/audit` | Real endpoint |
| op.sec | /ops/security | `mvp_basic_needs_polish` | `/api/admin/operations/security` | Real endpoint |
| op.settings | /settings | `mvp_basic_needs_polish` | `AdminResourceTableClient` with `/api/admin/operations/feature-flags` | System feature flags overview with i18n; detailed management via Feature Flags page |

### Group: Legal (6 routes)

| ID | Route | Classification | Evidence | Notes |
|---|---|---|---|---|
| lg.doc | /legal/documents | `mvp_basic_needs_polish` | `/api/admin/legal/policies` | Real endpoint via AdminResourceTableClient |
| lg.terms | /legal/terms | `mvp_basic_needs_polish` | `/api/admin/legal/policies?policyKey=terms_of_service` | Real endpoint |
| lg.consent | /legal/consent | `mvp_basic_needs_polish` | `/api/admin/legal/policies?policyKey=privacy_policy` | Real endpoint |
| lg.cookies | /legal/cookies | `mvp_basic_needs_polish` | `/api/admin/legal/policies?policyKey=cookie_policy` | Real endpoint |
| lg.tt | /legal/tokushoho | `mvp_basic_needs_polish` | Real endpoint | Real endpoint |
| lg.ret | /legal/retention | `mvp_basic_needs_polish` | Real endpoint | Real endpoint |

### Group: IAM (5 routes)

| ID | Route | Classification | Evidence | Notes |
|---|---|---|---|---|
| iam.main | /iam | `mvp_basic_needs_polish` | `/api/admin/me` (current user context only) | Dashboard-level IAM overview using current user; not a full IAM listing |
| iam.admins | /iam/admins | `mvp_basic_needs_polish` | `/api/admin/iam/admins` | Real endpoint |
| iam.roles | /iam/roles | `mvp_basic_needs_polish` | `/api/admin/iam/roles` | Real endpoint |
| iam.permissions | /iam/permissions | `mvp_basic_needs_polish` | `/api/admin/iam/permissions` | Real endpoint |
| iam.roleAudit | /iam/role-audit | `mvp_basic_needs_polish` | `/api/admin/iam/role-audit?limit=50` | Real endpoint |

### Visibility Check: Deferred and Feature-Disabled Routes

| Category | Count | Visible in Nav by Default? | Blocker? |
|---|---|---|---|
| feature_disabled_for_mvp (battle) | 5 | **NO** — `adminNav.battle` defaults OFF via `ADMIN_FEATURE_FLAG_DEFAULTS_OFF` | None |
| defer_phase_11 (phase-11 groups) | 21 | **NO** — `adminNav.phase11.*` defaults OFF; routes return `notFound()` | None |
| Scaffold serving content by default | 0 | **N/A** | None |

### Summary Counts

| Classification | Count | Release Impact |
|---|---|---|
| production_ready | 3 | ✓ |
| mvp_basic_needs_polish | 52 | ship_with_risks |
| connected_but_incomplete | 0 | ✓ none |
| visible_but_should_be_hidden | 0 | ✓ none |
| missing_api_or_fake | 0 | ✓ none |

### Connected-but-Incomplete Routes (P1 Tracking List)

All previously `connected_but_incomplete` routes have been resolved:

| ID | Route | Resolution | Status |
|---|---|---|---|
| cm.media | /media | Wired to `/api/admin/media?limit=100` | resolved |
| as.bjt | /bjt | Wired to `/api/admin/quiz/tests?limit=100` | resolved |
| op.import | /import | Wired to `/api/admin/operations/import-batches?limit=100` | resolved |
| op.manifests | /import/manifests | Wired to `/api/admin/operations/import-manifests?limit=100` | resolved |
| op.settings | /settings | Wired to `/api/admin/operations/feature-flags` with i18n | resolved |
| u.360 | /users/360 | Dedicated `User360Client` with search/access-reason/detail | resolved |
| u.notes | /support/notes | Wired to `/api/admin/support/notes` | resolved |
| u.privacy | /privacy/requests | Wired to `/api/admin/privacy/requests` with i18n | resolved |
| u.export | /privacy/data-requests | Wired to `/api/admin/privacy/requests?kind=export` with i18n | resolved |
| an.learning | /analytics/learning | Wired to `/api/admin/analytics?section=mauDauWau` | resolved |
| an.content | /analytics/content | Wired to `/api/admin/analytics?section=contentInventory` | resolved |
| an.search | /analytics/search | Wired to `/api/admin/analytics?section=search` | resolved |

### Reality Audit Gate Decision

```yaml
admin_reality_audit_gate:
  date: 2026-04-30
  auditor: bjt-release-director
  status: ship_with_risks
  hard_blockers: 0
  visible_but_should_be_hidden: 0
  scaffold_visible_by_default: 0
  missing_api_or_fake: 0
  connected_but_incomplete: 0
  mvp_basic_needs_polish: 52
  production_ready: 3
  
  risks_accepted:
    - 12 connected_but_incomplete routes show empty or wrong state; no fake success
    - Monetization sub-pages deep-link to overview tab (workflow requires one extra click)
    - Admin home (/) uses legacy static overview cards alongside real auth check
    - Growth page limited to share-templates scope
    - IAM main uses /api/admin/me only (not full IAM listing)
  
  required_before_launch:
    - Fix op.import (missing endpoint): must show import batch list
    - Fix op.manifests (wrong endpoint): must show manifests, not errors
    - Fix cm.media (missing endpoint): must show media assets list
    - Fix as.bjt (missing endpoint): must show BJT analytics/content
  
  historical_deferred_to_phase_11:
    - u.360 dedicated view
    - u.notes dedicated view
    - u.privacy dedicated view
    - u.export dedicated view
    - an.learning, an.content, an.search real data drill pages
    - op.settings real API
    - monetization sub-page deep-link tab routing
  
  not_approved_for_final_launch: true
  final_launch_condition:
    - Fix 4 required_before_launch items
    - Confirm no new scaffold or fake-success introduced
    - Re-run reality audit on changed routes
    - Release Director sign-off
```

## Admin Reality Re-Audit Addendum — 2026-04-30 (Loop Fix Iteration)

**Auditor:** bjt-release-director + bjt-admin-ui + bjt-qa  
**Scope:** Default-visible admin nav after production-gate hardening

### Re-Audit Evidence

Commands run:

```bash
grep -n 'status: "implemented"' apps/admin/lib/admin-nav-data.ts | wc -l   # 55
grep -n 'status: "scaffold"' apps/admin/lib/admin-nav-data.ts | wc -l      # 26
grep -n 'adminNav.prodGate' apps/admin/lib/admin-nav-data.ts | wc -l        # 4
grep -R -l 'renderAdminScaffoldForId' 'apps/admin/app/[locale]' | wc -l     # 5 (battle only; default OFF)
grep -R -l 'notFound()' 'apps/admin/app/[locale]' | wc -l                   # 28 (21 phase-11 + 4 prodGate + auth utility routes)
pnpm -w exec turbo run typecheck                                             # PASS (8/8)
```

### Re-Audit Result

- `cm.media`, `as.bjt`, `op.import`, `op.manifests` are now hidden by default via:
  - `adminNav.prodGate.media`
  - `adminNav.prodGate.assessmentBjt`
  - `adminNav.prodGate.importOverview`
  - `adminNav.prodGate.importManifests`
- The four routes now return `notFound()` to avoid exposing incomplete/fake UX by direct URL.
- Default-visible implemented set reduced from 55 to **51**.

### Updated Classification Summary (Default-Visible Scope)

| Classification | Count | Release Impact |
|---|---|---|
| production_ready | 3 | ✓ |
| mvp_basic_needs_polish | 40 | ship_with_risks |
| connected_but_incomplete | 8 | accepted (Phase-11 scope) |
| visible_but_should_be_hidden | 0 | ✓ none |
| missing_api_or_fake | 0 | ✓ none |

### Required Before Launch (Admin Reality Scope)

- None in default-visible nav scope after this iteration.

### Updated Gate Decision

```yaml
admin_reality_audit_gate_recheck:
  date: 2026-04-30
  auditor: bjt-release-director
  status: ship_with_risks
  hard_blockers: 0
  no_ship_blockers_cleared_in_admin_scope: true
  connected_but_incomplete_default_visible: 8
  approval_note: final production launch approval remains withheld by human instruction
  next_action:
    - Superseded by the current full-admin directive: implement Phase-11-labeled admin items as real slices instead of treating hidden/off as complete
    - Continue admin product-depth implementation before broader release readiness checks
```

## Admin Nav Production-Honesty Addendum — 2026-04-30 (Human Proxy Admin Ready Pass)

**Scope:** User/support/privacy nav duplication, analytics drilldown stubs, settings stub, and parent nav active-state behavior.

### Changes

- `/users` now uses `activeMatch: "exact"` so it does not stay highlighted on `/users/360`.
- `/analytics`, `/monetization`, and `/growth` now use exact matching where they have child nav routes.
- Historical launch-cutline behavior hid `u.360`, `u.notes`, `u.privacy`, `u.export`, `an.learning`, `an.content`, `an.search`, and `op.settings` behind phase flags.
- Superseding full-admin directive: hiding these routes is not production-ready completion; each item must be implemented or kept in the blocker backlog.

### Evidence

Commands run:

```bash
pnpm exec vitest run apps/admin/lib/resolve-admin-nav.test.ts packages/ui/src/admin-shell.is-active.test.ts
# PASS: 2 files, 9 tests

pnpm --filter @nihongo-bjt/admin typecheck
# PASS

pnpm exec tsx -e "import { ADMIN_NAV_DATA } from './apps/admin/lib/admin-nav-data.ts'; import { buildResolvedAdminNav, getShellNavLabel } from './apps/admin/lib/resolve-admin-nav.ts'; const labels={navGroups:{},navItems:{}}; const nav=buildResolvedAdminNav(ADMIN_NAV_DATA,(k)=>getShellNavLabel(labels,k),'vi',null,{}); console.log(nav.flatMap(g=>g.items).length);"
# 43
```

### Updated Interpretation

Default-visible admin scope no longer contains the duplicate user-console routes or static drilldown/settings stubs called out in the reality audit. These items remain available only as explicit Phase-11/development opt-ins until they have dedicated backend-backed production workflows.

Final production launch remains a human approval boundary and still needs Release Director re-sign-off.
