# Project State

## Latest Completed Cycle

- Cycle: `BJT-CYCLE-PROD-005`
- Date: 2026-04-29
- Task: `BJT-104 Legal consent API baseline`
- Mode: production implementation + specialist security review + QA/release gate

## Scope Reviewed

- Company operations docs and takeover guardrails.
- Spec navigation: index + boss digest + compact 00/03/05/10.
- Repository implementation snapshot: `apps/api`, `apps/admin`, `apps/web`, `packages/database`, Prisma migrations, docs, tests.

## Repository Snapshot

- Monorepo stack is active (NestJS API + Next.js web/admin + Prisma/PostgreSQL + Turborepo).
- Canonical v15 path families for dictionary/bookmarks/decks/review/auth profile and admin operations now exist in API controllers.
- Prisma schema includes key production models for bookmarks, admin audit, profile, monetization, l10n, feature flags, and dead-letter queue.
- Admin and learner apps expose broad route shells/modules, but admin parity to backend contracts is incomplete and now tracked by Admin 100% completion controls.
- Test coverage exists but is shallow for controller/integration/security scenarios; e2e currently smoke-level.

## Confirmed Gaps (Backlog Drivers)

- Legal consent baseline exists, but broader legal/privacy/cookie policy API family and policy lifecycle controls are incomplete.
- Upload security hardening baseline now exists, but malware scanning, stricter special-use IP coverage, and request-time outbound pinning remain incomplete.
- Critical controller/integration tests for auth/profile, bookmarks, operations audit, and monetized actions are insufficient.
- Admin 100 gate: **PASS for current launch cutline** + Reality Re-Audit Addendum (2026-04-30): **ship_with_risks**. 0 scaffold visible, 0 fake/missing-api blockers. Default-visible admin nav is now 43 items after hiding duplicate/stub user-ops, analytics drilldown, settings, prodGate, battle, and Phase-11 routes by default. This is not full admin production readiness against v15; `company/ADMIN_PRODUCTION_ORCHESTRATION.md` now directs human-proxy to continue admin-first until incomplete spec modules become real production slices. Feature-flagging or Phase 11 labeling is not completion for the current full-admin directive.

## Risk Summary

- Medium: false-negative readiness due to doc drift across multiple audit docs.
- Medium: release/compliance risk remains until broader legal/privacy contracts are complete.
- High: abuse/bypass risk until security hardening and enforcement tests are comprehensive.

## Cycle Outcome

- Added legal consent persistence baseline via `legal.consent_record` migration and service/controller contracts.
- Implemented `GET /api/legal/consent/status` and `POST /api/legal/consent/accept` with schema validation and Keycloak guard.
- Enforced legal consent prerequisite in monetization checkout on backend and added denial-path tests.
- Hardened legal/checkout sensitive paths to require authenticated user context.
- Regenerated OpenAPI artifacts to include legal consent endpoints.

## Next Cycle Recommendation

- Continue PHASE-04 via `.github/prompts/29_boss_run_phase_batch.prompt.md` with PH04-T02 only after the human clears the PH04-T01 checkpoint.

## PHASE-07 Mid-Phase Checkpoint Update

- Decision: `APPROVE_PHASE` (delegated unattended checkpoint after PH07-T03).
- Evidence status: diff/test/security/OpenAPI/no-fake/browser/rollback all pass.
- Hard-stop scan: no blocking condition found.
- Safe continuation: PHASE-07 completed_with_risks at phase-end under delegated unattended policy; next phase planning is allowed.

## Autopilot Mode

- Status: one-cycle run completed, waiting for human approval.
- Approval phrase: `approve, tiếp đi`.
- Boss must run implementation, review, and verification in one cycle, then stop for the next approval checkpoint.

## Phase Batch Mode

- Status: PHASE-10 completed_with_risks (PH10-T01..PH10-T06 and PH10-CLOSE passed).
- Release Director scope decision: ship_with_risks (no-launch).
- Admin launch blocker: Admin 100 completion gate still blocks final production launch.
- Use `.github/prompts/29_boss_run_phase_batch.prompt.md` for approved batch execution.
- Use `.github/prompts/41_phase_09_final_production_gate.prompt.md` for PHASE-09 final production gate planning.
- Do not use old phase prompt numbers 05/06/07; those numbers belong to database/test/security workflows.
- Required phase files: `company/PHASE_PLAN.md`, `company/CURRENT_PHASE.md`, `company/PHASE_HANDOFF.md`, `company/PHASE_TASK_REPORT.md`, `company/PHASE_RISK_LOG.md`.

## PHASE-02 Progress

- Phase: `PHASE-02 Content, Search, and Import`
- Task status: `PH02-T01 passed`, `PH02-T02 passed`, `PH02-T03 passed`, `PH02-T04 passed`, `PH02-T05 passed_release_gate`
- Latest outcome: REQUEST_PHASE_FIXES completed; typecheck + OpenAPI + targeted tests passed; Release Director recheck returned `ship`; human token `APPROVE_PHASE` received.
- Next action: start PHASE-03 planning gate.

## PHASE-03 Progress

- Phase: `PHASE-03 Learning, SRS, and Reading Assist`
- Task status: `PH03-T01 passed`, `PH03-T02 passed_with_risks`, `PH03-T03 pending`, `PH03-T04 pending`, `PH03-T05 pending`
- Latest outcome: PH03-T02 fully completed after needs-changes remediation (module resolution + shared standardization).
- Remediation scope: Fixed `Can't resolve './srs.js'`, standardized shared package layout to bridge pattern (eliminated TS/JS drift).
- Remediation evidence: 8/8 typecheck pass, 39/39 tests pass, OpenAPI generation pass.
- Next action: Approval checkpoint, then start PH03-T03 owner pass with learning-quality/content-quality/QA reviews.
- Phase: `PHASE-03 Learning, SRS, and Reading Assist`
- Task status: `PH03-T01 passed`, `PH03-T02 passed_with_risks`, `PH03-T03 needs_fixes`, `PH03-T04 pending`, `PH03-T05 pending`
- Latest outcome: PH03-T03 owner pass complete; specialist reviews identified 5 critical blockers (exam-state trust, integration tests, mobile/a11y, timeout/de-dup, error handling).
- Blocker severity: High (exam-safe enforcement cannot bypass; integration tests missing).
- Required fixes: Server-authoritative exam state, integration tests, mobile focus trap, request timeout/de-dup, error handling.
- Next action: Return to bjt-learner-ui for fixes, then re-submit to QA gate.
- Phase: `PHASE-03 Learning, SRS, and Reading Assist`
- Task status: `PH03-T01 passed`, `PH03-T02 passed_with_risks`, `PH03-T03 passed_with_risks`, `PH03-T04 pending`, `PH03-T05 pending`
- Latest outcome: PH03-T03 APPROVE_FIXES cycle closed all QA blockers and completed specialist re-review.
- Verification evidence: typecheck 8/8 pass, targeted tests 13/13 pass, web production build pass.
- Residual risk: non-blocking React act warning noise in one web test file.
- Next action: human approval checkpoint, then start PH03-T04.

## Production Review Controls

- Token budget: `company/TOKEN_BUDGET_PROTOCOL.md`
- Diff review: `company/REVIEW_DIFF_PROTOCOL.md`
- Rollback: `company/ROLLBACK_PLAYBOOK.md`
- Release Director: `company/RELEASE_DIRECTOR_REVIEW_PROTOCOL.md`
- Phase review packet: `company/PHASE_REVIEW_PACKET.md`
- Prompts: 42 phase review/close, 43 no-fake audit, 44 visual review, 45 release director diff gate.

## PHASE-10 Update

- Browser review pass evidence:
  - company/reviews/browser-phase-review/phase-10-2026-04-30T06-19-46-653Z.md
  - company/reviews/browser-phase-review/phase-10-2026-04-30T06-19-59-933Z.md
- Current user-directed next action: run `human-proxy continue admin production loop` before broader release readiness. Final production launch remains a human approval boundary.
- Latest admin loop checkpoint: the previously hidden prodGate routes `cm.media`, `op.import`, `op.manifests`, and `as.bjt` are now reported visible with real PostgreSQL/Prisma-backed endpoints and monorepo typecheck PASS. Human Proxy should not stop there; under unattended delegation it should continue to the next incomplete admin production slice from `company/ADMIN_PRODUCTION_ORCHESTRATION.md`.
- If all admin routes are now production-wired but product-depth risks remain, Human Proxy must continue implementation instead of closeout. Closeout/browser QA/Release Director admin sign-off is only valid after Admin Shell/sidebar UX, planned-notice pages, missing dedicated APIs, and battle/growth/learning/content/IAM depth blockers are cleared with implementation and browser/source evidence.

## UI Production Skill System

- Skills: `company/skills/ui-production/00-ui-production-principles.md` through `14-production-ui-done-definition.md`
- Gates: `company/gates/ui-production-gate.md`, `company/gates/admin-page-production-gate.md`, `company/gates/learner-page-production-gate.md`
- Visual review template: `company/reviews/ui-visual-review/_template.md`
- Admin UI phase prompt: `.github/prompts/46_admin_ui_phase_with_skills.prompt.md`

## BJT UI/UX Production Layer

- Standard: `docs/design/bjt-ui-ux-production-standard.md`
- Skills: `company/skills/bjt-ui-ux/00-bjt-ui-ux-principles.md` through `08-bjt-ui-ux-review-rubric.md`
- Gate: `company/gates/bjt-ui-ux-production-gate.md`
- Review template: `company/reviews/bjt-ui-ux/_template.md`
- Prompt: `.github/prompts/51_bjt_ui_ux_production_review.prompt.md`
- Rule: external UI trends are inspiration only; learner UI must optimize focus, Japanese readability, remediation, exam trust, accessibility, and privacy.

## PHASE-10 State Reconciliation

- PHASE-10 is approved and ready to execute.
- `company/PHASE_PLAN.md` now contains PH10 task queue instead of stale PH09 release tasks.
- `company/CURRENT_PHASE.md` points to `PH10-T04-P0-1` with `approval_required: no`.
- Human Proxy/Boss must execute `.github/prompts/29_boss_run_phase_batch.prompt.md` or inline the next task; it must not stop with `Now run Boss Phase Batch execution`.

## PHASE-10 Wave-A Execution Update (2026-04-30)

- Completed `PH10-T05-A` within constrained scope lock:
  - System routes: `/system/health`, `/system/queue-health`, `/system/search-sync`, `/system/release`
  - Operations routes: `/ops/feature-flags`, `/ops/kill-switches`, `/ops/dead-letters`, `/ops/notifications`, `/ops/security`
  - IAM routes: `/iam/roles`, `/iam/permissions`, `/iam/admins`, `/iam/role-audit`
- All above routes no longer render `renderAdminScaffoldForId`.
- Added RBAC-protected backend summary/list endpoints for these routes, plus targeted RBAC tests.
- Completed `PH10-T04-P1-1`: Daily Hub loading/comeback/mobile hardening using existing card/placeholder patterns (no new skeleton dependency).
- Historical PHASE-10 note: production battle feature flag behavior remained unchanged and PHASE-11-labeled routes were untouched. Current full-admin directive supersedes this; they remain blockers until implemented.
- Next action: continue `PH10-T05-B` pending must_ship_mvp routes (users/privacy/legal/monetization/import).

## Admin 100% Completion

- Program: `company/ADMIN_COMPLETION_PROGRAM.md`
- Admin production orchestration: `company/ADMIN_PRODUCTION_ORCHESTRATION.md`
- Inventory: `company/admin-module-inventory.md`
- Gate: `company/gates/admin-100-completion-gate.md`
- Audit prompt: `.github/prompts/49_admin_100_completion_audit.prompt.md`
- Execution prompt: `.github/prompts/50_admin_100_completion_phase.prompt.md`
- Current snapshot: Admin 100 gate PASS for the current launch cutline. 55 implemented items in source; 43 default-visible after prodGate + user-ops/analytics/settings hardening; duplicate/stub admin routes are feature-flagged OFF and direct URLs return `notFound()` by default. For the user's admin production-ready goal, hidden/default-off modules are still admin backlog, not complete.

## Human Proxy Production Loop

- Agent: `.github/agents/bjt.human-proxy.agent.md`
- Mode: `company/HUMAN_PROXY_MODE.md`
- Prompt: `.github/prompts/47_human_proxy_production_loop.prompt.md`
- Admin-first contract: `company/ADMIN_PRODUCTION_ORCHESTRATION.md`
- Use when the human wants the proxy to select the next safe Boss action toward production.
- Unattended proxy must not stop at routine owner-agent handoff when policy passes.
- For admin production readiness, recommended invocation is `human-proxy continue admin production loop`; proxy should choose one admin slice, route owner agents, verify, update state, and continue until a hard stop.

## Agent/Design Quality Upgrade

- Karpathy-style production-agent skill is now part of the agent guardrails: explicit assumptions, simple vertical slices, surgical diffs, and verifiable acceptance criteria.
- Open Design BJT adaptation is now part of UI/admin guardrails: design-system-first work, pre-flight skill loading, anti AI-slop checks, and five-dimension critique before UI is marked production-ready.
- Canonical files:
  - `company/skills/agent-quality/00-karpathy-production-agent-skill.md`
  - `company/skills/open-design-bjt/00-open-design-bjt-adaptation.md`
  - `company/gates/open-design-bjt-ui-gate.md`

## Admin False-Closeout Correction

- Latest human manual review found that the previous Admin 100/FULL PASS was too shallow: several admin pages still look temporary, duplicate other routes, or lack expected route-specific workflows.
- Treat `company/admin-module-inventory.md` status as `admin_product_depth_in_progress`, not launch-ready.
- Human Proxy must not stop at Release Director production launch/go-live boundary yet.
- Next route: reopen admin audit with product-depth classifications, then run prompt 50 on the first blocker from `company/ADMIN_PRODUCTION_ORCHESTRATION.md` Product-Depth Priority Override.
- User 360/Support/Privacy/Analytics/Settings had one resolution slice, but the admin loop must continue. Known remaining blockers: Admin Shell/sidebar left menu is too long, Daily Hub/Learning Review depth, Assessment/BJT CRUD/review workflows, Battle admin, Growth admin depth, IAM management depth, visible planned-notice learning/content pages, and dedicated settings/auth-provider diagnostics.
- Latest stop reason `admin_100_completion_gate status change requires human verification` is not a hard stop under unattended admin production readiness. Continue with full-route source/visual audit for old or untouched screens before any final production-ready review.
- Latest stop reason "only browser visual evidence remains" is not a hard stop. Browser QA across all 81 admin routes is an executable unattended task; after it finishes, continue to Release Director admin sign-off before asking the real human for final product review or go-live approval.

## Browser QA Phase Review

- Agent: `.github/agents/bjt.browser-qa.agent.md`
- Policy: `company/BROWSER_PHASE_REVIEW_POLICY.md`
- Gate: `company/gates/browser-phase-review-gate.md`
- Prompt: `.github/prompts/48_phase_browser_runtime_review.prompt.md`
- Required before approving UI-changing phases.

## PHASE-03 Progress Update

- Phase: `PHASE-03 Learning, SRS, and Reading Assist`
- Task status: `PH03-T01 passed`, `PH03-T02 passed_with_risks`, `PH03-T03 passed_with_risks`, `PH03-T04 passed_with_risks`, `PH03-T05 passed_with_risks`
- Latest outcome: PHASE-03 approved by human token APPROVE_PHASE. Release Director decision: ship_with_risks. All blockers closed.
- Next action: Plan PHASE-04 Assessment, BJT Mock Exam.

## PHASE-04 Progress Update

- Phase: `PHASE-04 Assessment and BJT Mock`
- Task status: `PH04-T01 passed_with_risks`, `PH04-T02 passed`, `PH04-T03 passed`, `PH04-T04 passed`, `PH04-T05 passed`
- Latest outcome: PH04 implementation scope completed. Browser phase review rerun passed for `/vi` and `/vi/quiz` with desktop/mobile screenshots.
- Browser evidence: `company/reviews/browser-phase-review/phase-04-2026-04-29T15-01-30-257Z.md`
- Next action: rerun PHASE-04 Release Director gate.

## PHASE-05 Progress Update

- Phase: `PHASE-05 Admin, Operations, and Analytics`
- Task status: `PH05-T01 passed`, `PH05-T02 passed`, `PH05-T03 passed`, `PH05-T04 passed_with_risks`, `PH05-T05 passed`
- Latest outcome: PHASE-05 task queue executed under approved batch budget. Browser phase review passed for `/vi`, `/vi/users/360`, `/vi/ops/feature-flags`, `/vi/ops/dead-letters`, `/vi/analytics`.
- Browser evidence: `company/reviews/browser-phase-review/phase-05-2026-04-30T02-19-25-724Z.md`
- Residual risk: `PH05-R01` (missing dedicated HTTP integration tests for admin analytics contract).
- Next action: run `.github/prompts/42_phase_review_and_close.prompt.md` and request phase decision token.

## PHASE-07 Progress Update

- Phase: `PHASE-07 Daily Life, Growth Sharing, and Battle Integrity`
- Task status: `PH07-T01 passed`, `PH07-T02 passed`, `PH07-T03 passed`, `PH07-T04 passed`, `PH07-T05 passed`
- Latest outcome: PH07-T05 completed battle fairness/anti-cheat/anti-abuse hardening with learning-focused remediation payload and targeted gateway/orchestrator regression tests.
- Migration evidence: `packages/database/prisma/migrations/20260430052000_share_postcard_opt_in/migration.sql`.
- Verification evidence: API typecheck pass, targeted growth analytics/privacy tests pass (9/9), OpenAPI generation pass, targeted battle tests pass (6/6).
- Browser evidence: `company/reviews/browser-phase-review/phase-07-2026-04-30T03-18-03-476Z.md`
- Residual risks: `PH07-R02` accepted (share revocation/list management follow-up), `PH07-R03` open (historical analytics payload hygiene before production cut).
- Next action: run `.github/prompts/40_phase_08_quality_observability_release.prompt.md`.

## PHASE-08 Progress Update

- Phase: `PHASE-08 Quality, Observability, and Release Readiness`
- Task status: `PH08-T01 passed`, `PH08-T02 passed`, `PH08-T03 passed`, `PH08-T04 passed`, `PH08-T05 passed`, `PH08-T06 passed`
- Latest outcome: PH08 implementation queue completed with T05/T06 evidence for backup/restore readiness, observability/DLQ behavior, and abuse-focused red-team regression checks.
- Verification evidence: `pnpm prisma:validate` pass, `pnpm -w exec turbo run typecheck` pass, targeted backend regression `29/29` pass, e2e smoke `6/6` pass, health/readiness tests `3/3` pass, observability/privacy/ops/billing suite `31/31` pass, abuse suite `21/21` pass.
- Files changed in PH08 so far: `e2e/smoke.spec.ts`, `playwright.config.ts`, `apps/api/openapi/openapi.json`, `docs/openapi.json`, `apps/api/src/health/health.service.ts`, `apps/api/src/health/health.service.test.ts`, `apps/api/src/main.ts`.
- Residual risks: `PH07-R02` accepted and `PH07-R03` open are carried; `PH08-R01` accepted for session-less e2e variance; `PH08-R02` accepted for restore-drill depth follow-up.
- Next action: PHASE-09 queue execution (start PH09-T01) under final production gate workflow.

## PHASE-09 Close Update

- Phase: `PHASE-09 Final Production Gate`
- Task status: all 7 tasks passed (T01–T07)
- Release Director decision: `ship_with_risks`
- Fix evidence: lint 0 errors (eslint.config.mjs + quiz.repository.ts fixes), tests 272/272, typecheck 8/8, build clean, openapi synced, migrations applied (provenance/accessibility/share_opt_in), security/privacy suite 13/13 pass
- Residual risks carried: PH07-R02 (growth-social), PH07-R03 (security), PH08-R01 (qa), PH08-R02 (devops) — all forward-fixable, documented, owned
- Next action: `RUN_NEXT_PHASE` (PHASE-10) or `RUN_RELEASE_GATE` for production launch decision
