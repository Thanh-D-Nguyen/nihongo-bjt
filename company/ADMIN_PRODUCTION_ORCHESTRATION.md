# Admin Production Orchestration

## Purpose

Make `bjt-human-proxy` drive admin completion as a product-grade operating system, not just a scaffold-hiding exercise.

The target is world-class admin readiness: every enabled admin route must be useful, trustworthy, RBAC-enforced, audited where needed, connected to real APIs/provider abstractions, and verified through tests plus browser/UI review.

Admin production readiness is not the same as "no scaffold renderer remains". A route can still block admin production when it is shallow, duplicated from another route, missing the expected workflow, showing planned-notice content, or exposing only a read-only overview where the spec requires management operations.

For the current full-admin directive, "management" means route-specific operator workflows. A screen that only shows information is not enough unless the domain is intentionally immutable/read-only and the inventory records the reason plus search/filter/detail/export/audit evidence. Generic `AdminResourceTableClient` pages are blockers until upgraded into domain workflow components or accepted under the read-only exception in `company/ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md`.

Admin closeout is not allowed on `pass_with_risks` when the risks are unresolved admin feature depth, planned-notice pages, duplicated/shallow workflows, missing dedicated APIs, or Admin Shell navigation UX. Those risks mean "continue the admin loop", not "go to Release Director sign-off".

Admin closeout is also not allowed merely because the gate status changed. `admin_100_completion_gate status change requires human verification` and `Human review of admin product-depth resolution` are not hard stops while unattended delegation is active. They are prompts to run browser/source verification and continue unresolved slices.

## Canonical Inputs

- Full spec: `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md`, especially sections 14, 21.11, 26.10, 27.11, 28.12, 29.11, and 30.
- Admin nav: `apps/admin/lib/admin-nav-data.ts`.
- Admin API registry: `apps/api/src/admin/admin-openapi.schema.ts`.
- Admin inventory: `company/admin-module-inventory.md`.
- Admin management workflow standard: `company/ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md`.
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
   - Use `company/ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md` to decide whether the slice needs create/edit/enable-disable/publish/archive/retry/cancel/delete/moderate/assign/export workflows, or whether it is a justified read-only exception.
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
- any visible route only shows data in a generic table when the domain requires management actions;
- `AdminResourceTableClient` remains the primary experience for a management domain without a documented immutable/read-only exception;
- any visible admin route lacks browser/source evidence that the current UI is route-specific, polished, and not an old untouched screen;
- any route is a planned-notice, static header/back-link page, or information-only page for a spec-required management workflow;
- two nav items intentionally or accidentally render the same generic page without route-specific initial state or workflow;
- a route is marked implemented but lacks its route-specific API/client contract;
- admin areas named by the human as incomplete remain untriaged in the inventory;
- Open Design BJT five-dimension critique for a changed or questioned page has any score below `3/5`;
- browser QA has not produced visual/workflow/interaction evidence for the questioned routes.
- browser QA has not produced visual/workflow/interaction evidence across all 81 routes when full-admin closeout is pending.
- browser QA only verifies screenshots/rendering but does not exercise safe primary interactions and expected route-specific workflows.

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

- the route's intended admin decision and operational actions are documented;
- nav item status and feature flag state match reality;
- direct URL behavior matches nav state;
- page uses i18n copy, loading/error/empty/degraded/permission-denied states;
- read APIs are real and typed;
- write APIs have validation, backend RBAC, audit reason/log where required;
- data persists in PostgreSQL/approved provider abstraction;
- no fake charts, fake arrays, fake success states, or frontend-only enforcement;
- tests cover critical business/RBAC/error paths;
- browser or visual review evidence exists for changed admin UI;
- browser QA interaction evidence exists for the route's primary workflow: filters/search, tabs, detail links, modals/drawers, safe writes/dry-runs, confirmation/audit/RBAC states where applicable;
- create/edit/enable-disable/publish/archive/retry/cancel/delete/moderate/assign/export actions exist where the domain lifecycle requires them, or the inventory documents a valid immutable/read-only exception from `company/ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md`;
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

## Per-Screen Visit + Inline UI/UX Fix Rule

For every visible admin route, Human Proxy and admin owner agents must:

1. Open the route in a real authenticated browser session (Keycloak login flow, real cookies, real `/api/admin/*` data — not the bypass).
2. Capture or record actual rendered state: header, sidebar active item, primary content, loading→loaded transition, empty state, error state, RBAC-denied state where applicable.
3. Compare the rendered state against `company/ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md` and the BJT UI/UX standard.
4. If the rendered state has any of the following, fix it inline in the same loop before moving on:
   - generic `AdminResourceTableClient` shell where the domain requires a management workflow;
   - infinite loading because of API base URL, RBAC mismatch, or data shape;
   - duplicate visual experience across two distinct nav items;
   - shallow/temporary copy or layout that looks unfinished;
   - missing search/filter/sort/pagination/detail/action affordances expected by the domain;
   - layout broken on desktop or mobile (overflow, unreadable text, contrast issues);
   - i18n copy missing or rendering as keys;
   - login/auth redirect loop, token refresh failure, or auth-gate flash that ejects an authenticated admin back to `/login`.
5. Record the per-route observation and fix in `company/admin-module-inventory.md` and the active phase report. Do not advance to the next slice without the inline fix or an explicit blocker classification with owner and concrete next action.

A route is not "visited" by passing a 200 status check or a single screenshot. Visiting means: real session + interaction with the primary workflow + UI/UX comparison + inline fix on regression.

## Anti Scope-Too-Big Stop Rule

A turn must never stop with reasoning equivalent to "the remaining work is too large for one cycle" while admin production readiness is incomplete and no hard stop exists.

Forbidden stop reasons under unattended/admin delegation:

- "scope exceeds single cycle"
- "multi-cycle work, cannot finish in single proxy turn"
- "30-75 cycles of focused work"
- "stopping to let the human pick the next domain"

Required behavior instead:

- pick exactly one slice that fits the current turn budget (one route or one tightly-scoped backend extension per turn is allowed and expected);
- ship that slice end-to-end (typecheck/test/live API verify);
- update inventory with concrete progress;
- continue to the next slice in the same loop until a real hard stop or end-of-turn token budget is reached;
- if end-of-turn token budget is the only blocker, hand off the next slice with concrete file paths and the exact next prompt — but do not classify that as a project-level hard stop.

The fact that admin production readiness needs many slices is acknowledged. That is exactly why the loop must keep running. Each turn must close at least one slice with green typecheck and at least one piece of live-runtime evidence whenever an API or UI changed.

## Known Auth Regression: Admin Login Redirect Loop

Open known issue (top priority for the next admin loop turn):

- after a successful Keycloak login, the admin app sometimes redirects the just-authenticated admin back to `/login`.
- symptoms reported by the human: `login admin xong vào trang admin sau đó lại bị quay lại trang login`.
- likely candidates to investigate first:
  - `apps/admin/app/_components/admin-keycloak-session-gate.tsx` (initialAuthed handling, cookie names, refresh path);
  - `apps/admin/app/api/auth/keycloak/session/route.ts` (refresh_failed branch deleting cookies);
  - `apps/admin/app/[locale]/layout.tsx` (server cookie read for `kc_access_token`/`kc_refresh_token`);
  - any middleware/redirect rewriting the path on 401 from `/api/admin/me`;
  - `tryRefreshAccessToken` returning `refresh_failed` when the access token is still valid but expired soon (over-eager refresh).
- this regression must be reproduced and fixed before broader per-domain workflow slices resume, because every admin slice depends on a stable authenticated session.

## Admin Login Screen UI/UX

The admin login screen (`apps/admin/app/[locale]/login/page.tsx` + `apps/admin/app/[locale]/login/_components/admin-login-form-client.tsx`) is part of the admin production surface and must pass the same UI/UX gates as the rest of the admin shell:

- `company/gates/admin-page-production-gate.md`
- `company/gates/bjt-ui-ux-production-gate.md`
- `company/gates/open-design-bjt-ui-gate.md`

Required for production-ready login:

- visual language and tokens consistent with the admin shell (paper/ink/accent, spacing, typography);
- brand header, eyebrow, title, subtitle, and locale switcher;
- accessible form: labelled inputs, `aria-describedby` for error messages, focus ring, keyboard navigation, password visibility toggle with screen-reader label, capslock detection hint;
- submit button busy state with spinner and disabled guard while the password-login POST is in flight;
- inline server-side error rendering with no flash before hydration; auth-error query param mapping must remain;
- `returnTo` validation already present — add a unit test for malicious returnTo rejection (`//evil.example`, scheme-relative, absolute external);
- social provider buttons (Google/Apple) only when `NEXT_PUBLIC_AUTH_*_IDP_HINT` is configured; consistent button styling and accessible names;
- locale parity across vi/ja/en for every visible string, including provider button labels and error messages;
- responsive layout from 360px to desktop; no horizontal scroll;
- works without JavaScript (form-encoded POST already in place) and remains polished after hydration;
- after a successful login, the just-authenticated admin lands on `returnTo` or `/{locale}` and stays there; the auth gate must not eject back to `/login` (see "Known Auth Regression" above — fix in the same slice).

The login screen slice and the login redirect-loop slice should ship together when possible, because both require the same authenticated browser test path.
