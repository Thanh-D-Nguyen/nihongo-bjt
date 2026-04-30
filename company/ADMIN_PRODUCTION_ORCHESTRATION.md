# Admin Production Orchestration

## Purpose

Make `bjt-human-proxy` drive admin completion as a product-grade operating system, not just a scaffold-hiding exercise.

The target is world-class admin readiness: every enabled admin route must be useful, trustworthy, RBAC-enforced, audited where needed, connected to real APIs/provider abstractions, and verified through tests plus browser/UI review.

Admin production readiness is not the same as "no scaffold renderer remains". A route can still block admin production when it is shallow, duplicated from another route, missing the expected workflow, showing planned-notice content, or exposing only a read-only overview where the spec requires management operations.

Admin closeout is not allowed on `pass_with_risks` when the risks are unresolved admin feature depth, planned-notice pages, duplicated/shallow workflows, missing dedicated APIs, or Admin Shell navigation UX. Those risks mean "continue the admin loop", not "go to Release Director sign-off".

Admin closeout is also not allowed merely because the gate status changed. `admin_100_completion_gate status change requires human verification` and `Human review of admin product-depth resolution` are not hard stops while unattended delegation is active. They are prompts to run browser/source verification and continue unresolved slices.

## Canonical Inputs

- Full spec: `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md`, especially sections 14, 21.11, 26.10, 27.11, 28.12, 29.11, and 30.
- Admin nav: `apps/admin/lib/admin-nav-data.ts`.
- Admin API registry: `apps/api/src/admin/admin-openapi.schema.ts`.
- Admin inventory: `company/admin-module-inventory.md`.
- Admin gates:
  - `company/gates/admin-100-completion-gate.md`
  - `company/gates/admin-page-production-gate.md`
  - `company/gates/ui-production-gate.md`
  - `company/gates/open-design-bjt-ui-gate.md`
- Agent/design quality skills:
  - `company/skills/agent-quality/00-karpathy-production-agent-skill.md`
  - `company/skills/open-design-bjt/00-open-design-bjt-adaptation.md`
- Agent roles:
  - backend/API: `.github/agents/bjt.backend.agent.md`
  - admin UI: `.github/agents/bjt.admin-ui.agent.md`
  - QA: `.github/agents/bjt.qa.agent.md`
  - security/privacy/RBAC: `.github/agents/bjt.security.agent.md`
  - release decision: `.github/agents/bjt.release-director.agent.md`

## Current Admin API Coverage Snapshot

Implemented admin API groups visible in source:

- Admin core: session, me, module contracts.
- CMS: content summary, list, create, patch, status transitions, lexeme examples.
- Users/support: KPIs, user list, detail, audit, status, plan, support notes, invite/create.
- IAM: roles, permissions, admins, role audit.
- Audit: global admin audit log.
- Reading Assist: reports.
- Operations: feature flags, kill switches, DLQ, import-staging errors, search rebuild.
- Analytics: executive aggregate endpoint.
- Daily: widget read/update.
- Legal: policy list/create/publish/archive.
- Growth: share templates, referral/share analytics, preview.
- Monetization: summary, overview, analytics, audit, plans, entitlements, quotas, overrides, subscriptions, coupons, dev plan assignment.
- Ads: overview, placements, campaigns, providers, rules, performance, audit.
- Billing webhook: ingest/list/raw inspection.

## Spec Gap Snapshot

These admin areas are not yet world-class production-ready even if currently hidden, default-off, or partially wired:

- Media Library: asset listing, provenance/license moderation, rights filters, audited moderation actions.
- Import Center: import overview, manifests, dry-run diff, canonical import controls, retry/cancel, reindex status.
- BJT/Quiz Admin: templates, question bank, mock exams, sessions, remediation links, psychometric diagnostics.
- Learning Paths/Competencies: path builder, stages/units/content links, competency admin, graph/analytics.
- User 360/Support/Privacy: dedicated User 360 route with explicit access reason, support note queues, privacy/export/delete request workflows.
- Admin Analytics Drilldowns: learning, content, search, flashcards, BJT, battle, growth, platform ops, export/audit/freshness.
- Content Extended: media links, content versions/restore, enrichment queue, i18n center.
- Battle Admin: configs, bots, seasons/leaderboard, match monitor, abuse signals.
- Settings/Auth Providers: provider diagnostics, social auth provider settings, login events, feature/provider status.
- Growth Extended: referral campaigns, share templates/campaigns, moderation, share analytics.

## Human Proxy Admin-First Rule

When the human asks for admin production readiness, `bjt-human-proxy` must prioritize this loop before broader release readiness:

1. Refresh admin audit:
   - run or inline `.github/prompts/49_admin_100_completion_audit.prompt.md`;
   - reconcile nav, routes, API registry, inventory, feature flags, and direct URL behavior.
2. Select one admin production slice from the priority queue below.
3. If backend/API is missing, route first to `bjt-backend`.
4. Route UI implementation to `bjt-admin-ui`.
5. Require the admin UI owner to apply the Karpathy production-agent skill, Open Design BJT adaptation, and Open Design BJT UI gate.
6. Route RBAC/privacy/billing/upload-sensitive review to `bjt-security` when applicable.
7. Route verification to `bjt-qa`.
8. Update inventory, project state, risk log, and admin navigation docs.
9. Repeat until all target admin modules are production-ready and enabled. For the current full-admin directive, feature-flag exclusion is not a completion path.
10. Only then run broader final release readiness.

Human Proxy must not interpret “hidden/off by default” or “Phase 11 scope” as “done” when the human has requested admin production-ready. For the current full 100% admin functionality directive, hidden/off is not an acceptable completion path. Only a later explicit human instruction can change that mission.

When one admin slice passes, Human Proxy must immediately select the next incomplete slice and execute or inline the Boss/owner-agent pass if no hard stop exists. A PASS summary is a checkpoint, not a stop condition.

When one product-depth group passes, Human Proxy must not select `Admin closeout verification` unless the Product-Depth Priority Override is fully cleared. The next action must be the next blocker from the override queue.

When all admin routes are production-wired, Human Proxy must not stop for a generic “human review before release gate”. That state triggers the admin closeout verification sequence below. The real human approval boundary is final production launch/go-live, not admin verification.

When the source implementation loop is complete and the only remaining admin inventory items are `needs_browser_visual_review` or `browser_visual_review_pending`, Human Proxy must run Browser QA across all 81 routes. "Browser visual evidence pending" is not a hard human-review boundary and must not produce `stopped_for_approval`.

If the human or browser QA reports that admin pages are still temporary-looking, duplicate another route, lack expected CRUD/review workflows, or expose planned-notice screens, Human Proxy must treat the report as new admin evidence. It must reopen the admin production loop, update `company/admin-module-inventory.md`, and route the next product-depth slice instead of stopping at launch approval.

## Admin Closeout Verification Sequence

When the admin loop reports that all admin routes are production-wired:

1. Re-run or inline the Admin 100 audit against nav, routes, feature flags, direct URLs, inventory, product-depth, and visual/workflow quality.
2. Run targeted verification evidence:
   - monorepo typecheck;
   - targeted admin/API tests changed by the last slice;
   - OpenAPI generation if backend contracts changed;
  - browser/runtime review for changed admin routes, and for full admin closeout all 81 visible admin routes, via `.github/prompts/48_phase_browser_runtime_review.prompt.md` or equivalent bounded runner.
3. Update `company/admin-module-inventory.md`, `company/project-state.md`, `company/PROJECT_STATE.md`, and handoff files with admin closeout status.
4. Run Release Director admin sign-off/diff gate (`.github/prompts/45_release_director_diff_gate.prompt.md`) as a review, not as go-live approval.
5. Stop only if:
   - Release Director returns `no_ship`;
   - a P0/P1 blocker remains;
   - verification fails beyond retry budget;
   - final production launch/go-live approval is requested;
   - another hard stop in policy applies.

Closeout verification cannot pass while any of these are true:

- Admin Shell/sidebar navigation is too long, lacks clear information architecture, or has confusing active/focus behavior;
- any visible admin route lacks browser/source evidence that the current UI is route-specific, polished, and not an old untouched screen;
- any route is a planned-notice, static header/back-link page, or information-only page for a spec-required management workflow;
- two nav items intentionally or accidentally render the same generic page without route-specific initial state or workflow;
- a route is marked implemented but lacks its route-specific API/client contract;
- admin areas named by the human as incomplete remain untriaged in the inventory;
- Open Design BJT five-dimension critique for a changed or questioned page has any score below `3/5`;
- browser QA has not produced visual/workflow evidence for the questioned routes.
- browser QA has not produced visual/workflow evidence across all 81 routes when full-admin closeout is pending.

Forbidden stop reason:

- `All admin routes wired — needs human review before release gate`

Allowed next action in that state:

- `Run admin closeout verification: prompt 48 browser QA, then prompt 45 Release Director admin sign-off`
- `Run full admin browser visual audit: prompt 48 / bjt-browser-qa across all 81 routes, then prompt 45 Release Director admin sign-off`

## Priority Queue

Use this order unless dependency evidence says another slice is safer:

1. Media Library.
2. Import Center.
3. BJT/Quiz Admin.
4. User 360, Support Notes, Privacy Requests, Account Export/Deletion.
5. Admin Analytics drilldowns.
6. Learning Paths and Competencies.
7. Content Versions, Enrichment, i18n.
8. Settings/Auth Provider Diagnostics.
9. Growth/Social Sharing admin.
10. Battle Admin.

## Product-Depth Priority Override

The human's latest manual admin review is authoritative evidence that the previous closeout was false-positive. Until the inventory records real fixes, Human Proxy must prioritize these product-depth slices before any final release/launch gate:

0. Admin Shell/sidebar navigation UX: the left menu is too long. Implement product-grade navigation IA: collapsible groups or equivalent, persistent active state, clear focus/selected state, scroll affordance, pinned critical items, responsive behavior, and no double-highlight.
1. Daily Hub and Learning/Review admin depth: avoid temporary-looking screens; expose real management workflows for daily content, decks/presets, learning paths, and competencies.
2. Assessment/BJT admin: decide and implement the correct management actions. Question bank/templates/mock exams usually require create/edit/archive/delete or publish workflows; quiz sessions and psychometrics may be read-only/review-oriented with export/audit, but the route must make that intentional.
3. Battle Admin: configs, bots, matches, leaderboard/seasons, and abuse signals must have real backend-backed workflows.
4. Users/User 360/Support/Privacy/Export: `/users` and `/users/360` must not be identical. User 360 needs a dedicated detail/access-reason workflow; support/privacy/export routes need their own queue/review surfaces.
5. Growth/Social Sharing: referral campaigns, share templates/postcards, moderation, analytics, and growth campaign management need real route-specific workflows.
6. IAM: roles, permissions, admins, and role audit need professional management surfaces, not shallow overview-only pages.
7. Analytics drilldowns and Operations/Settings: no static back-link stubs; each visible route needs data, freshness, filters, and next actions.
8. Frontend/admin visual polish pass: after functional slices pass, run a full admin UI/UX sweep with Browser QA screenshots across desktop and mobile before Release Director sign-off.
9. Full-route source/visual audit: every visible admin route must have a current inventory row with route-specific purpose, API/workflow evidence, visual quality status, and whether it was newly implemented, intentionally reused, or still old/needs redesign.

Do not mark `admin_closeout_complete` while any item in this override is still classified as `temporary_ui`, `duplicate_route`, `planned_notice`, `missing_workflow`, `read_only_when_management_required`, `connected_but_incomplete`, or `needs_product_depth`.

Do not mark closeout complete while `company/admin-module-inventory.md` has `admin_product_depth_remaining.closeout_allowed: no`, `status: block`, or `status: pass_with_risks` with residual admin feature-depth risks.

Do not mark closeout complete when inventory says `all_resolved` but still lists `pass_with_risks`, planned-notice pages, feature-flag deferrals, old/untouched screens, or any `needs_visual_product_depth_audit` item.

## Current Progress Override

As of the latest local state reported by the admin loop:

- `company/admin-module-inventory.md` reports 81 implemented admin routes, 0 scaffold nav items, 0 feature flags, 0 planned-notice pages, and typecheck PASS.
- Source/product-depth implementation is reported complete.
- Remaining blockers are browser visual verification for Admin Shell/sidebar and full route-by-route browser/visual audit.

Therefore the next admin production action is:

1. Run full admin browser visual audit via `.github/prompts/48_phase_browser_runtime_review.prompt.md` / `bjt-browser-qa` across all 81 routes.
2. If browser QA finds route-specific UI/product-depth regressions, reopen the relevant implementation slice.
3. If browser QA passes or records bounded `blocked_environment` evidence, run Release Director admin sign-off/diff gate.

Do not stop to ask the human to approve this next slice when unattended delegation is active and hard stops are absent.

## Slice Definition Of Done

One admin slice is production-ready only when:

- nav item status and feature flag state match reality;
- direct URL behavior matches nav state;
- page uses i18n copy, loading/error/empty/degraded/permission-denied states;
- read APIs are real and typed;
- write APIs have validation, backend RBAC, audit reason/log where required;
- data persists in PostgreSQL/approved provider abstraction;
- no fake charts, fake arrays, fake success states, or frontend-only enforcement;
- tests cover critical business/RBAC/error paths;
- browser or visual review evidence exists for changed admin UI;
- Open Design BJT UI gate passes, including a five-dimension critique with no score below `3/5`;
- the page has route-specific purpose and workflow; it is not a duplicated generic console unless route-specific initial state, filters, tabs, copy, and actions make the workflow distinct;
- required management operations are present or intentionally omitted with documented domain reason, RBAC/audit behavior, and Release Director acceptance;
- planned-notice/info-only screens are implemented or classified as blockers for the human's admin production-ready goal;
- Admin Shell navigation remains usable with all 81 nav items: grouped, collapsible or otherwise compact, active state exact, keyboard/focus accessible, and not visually overwhelming;
- every visible admin route has current browser/source evidence; old or untouched screens are upgraded or listed as blockers;
- `company/admin-module-inventory.md` records the final classification.

## Hard Stops

Stop for real human approval when:

- production release approval is requested;
- destructive migration/data deletion is needed;
- external provider secrets/config decisions are needed;
- privacy/legal/billing/security risk requires acceptance;
- Release Director returns `no_ship`;
- tests/build fail after the documented retry budget.

## Recommended Invocation

Use:

`human-proxy continue admin production loop`

Expected behavior:

- choose the next admin slice;
- execute or inline the required Boss/owner-agent pass;
- after a slice passes, auto-continue to the next incomplete slice under unattended delegation;
- after all admin slices pass, auto-run full admin browser visual audit, admin closeout verification, and Release Director admin sign-off;
- do not stop with `next_agent` / `next_action` only unless a hard stop exists.
