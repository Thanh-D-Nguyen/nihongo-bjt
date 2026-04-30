# Phase Risk Log

## Purpose

Track risks discovered during PHASE_BATCH execution and their current disposition.

## Risk Levels

- low
- medium
- high
- critical

## Risk Register

```yaml
risk_register:
  - id: PH00-R01
    phase_id: PHASE-00
    task_id: PH00-T01
    risk_level: low
    category: documentation_consistency
    description: Archived row-level tracker in BACKEND_API_REGISTRY may be misread if convergence rule is skipped.
    mitigation: Keep converged table as authoritative and schedule dedicated row-level cleanup in a later docs cycle.
    owner: bjt-boss
    status: accepted
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH00-R02
    phase_id: PHASE-00
    task_id: PH00-T02
    risk_level: medium
    category: runtime_enforcement_gap
    description: Feature flag and kill-switch runtime propagation/enforcement remains partial across runtime paths.
    mitigation: Schedule follow-up implementation and integration tests in next security/runtime cycle.
    owner: bjt-backend
    status: open
    opened_at: 2026-04-29
    closed_at: TBD
  - id: PH00-R03
    phase_id: PHASE-00
    task_id: PH00-T03
    risk_level: low
    category: state_sync
    description: Uppercase/lowercase state mirrors were temporarily out of sync during phase execution.
    mitigation: Updated backlog/project-state/handoff mirrors in PH00-T03 and verified alignment.
    owner: bjt-devops
    status: closed
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH01-R01
    phase_id: PHASE-01
    task_id: PH01-T01
    risk_level: low
    category: test_depth
    description: PH01-T01 validates controller-level denial paths only; no HTTP-level response contract assertion yet.
    mitigation: Keep as known low-risk gap and add integration-level denial check in later QA hardening if needed.
    owner: bjt-qa
    status: accepted
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH01-R02
    phase_id: PHASE-01
    task_id: PH01-T02
    risk_level: low
    category: rbac_test_scope
    description: Denial-path RBAC tests now cover sensitive routes, but allow-path and transport-layer guard wiring remain out of this task scope.
    mitigation: Track as non-blocking and schedule allow-path/integration assertions under broader controller integration testing scope.
    owner: bjt-qa
    status: accepted
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH01-R03
    phase_id: PHASE-01
    task_id: PH01-T03
    risk_level: medium
    category: audit_forensics_depth
    description: Admin audit schema and current write paths do not yet capture full request metadata such as IP and user agent beyond existing trace support.
    mitigation: Keep write-audit assertions in place for actor/action/target/before/after, and schedule follow-up schema/application hardening for richer forensic metadata.
    owner: bjt-security
    status: open
    opened_at: 2026-04-29
    closed_at: TBD
  - id: PH01-R04
    phase_id: PHASE-01
    task_id: PH01-T04
    risk_level: medium
    category: ssrf_hardening_followup
    description: DNS-aware SSRF baseline now blocks reproduced bypasses, but stricter special-use IP coverage and request-time DNS/IP pinning are not yet implemented.
    mitigation: Keep current DNS-aware deny baseline and schedule additional special-use range coverage plus outbound-client request-time pinning checks in a follow-up hardening cycle.
    owner: bjt-red-team
    status: open
    opened_at: 2026-04-29
    closed_at: TBD
  - id: PH02-R01
    phase_id: PHASE-02
    task_id: PH02-T01
    risk_level: low
    category: test_depth
    description: PH02-T01 parity evidence is controller/repository unit-level and does not yet prove full HTTP contract behavior against live Nest wiring.
    mitigation: Accept for narrow content parity slice; keep broader controller/integration and OpenAPI response-contract work scheduled in later QA/API cycles.
    owner: bjt-qa
    status: accepted
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH02-R02
    phase_id: PHASE-02
    task_id: PH02-T02
    risk_level: low
    category: dead_letter_deduplication
    description: Import-error escalation deduplicates dead-letter entries via service-level eventType convention rather than an explicit database uniqueness constraint.
    mitigation: Accept for this schema-free bridge slice; consider adding DB-backed uniqueness or replay state in a later import operations hardening cycle.
    owner: bjt-security
    status: accepted
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH02-R03
    phase_id: PHASE-02
    task_id: PH02-T02
    risk_level: medium
    category: worker_replay_gap
    description: PH02-T02 provides real import-error triage and DLQ escalation, but worker replay/re-drive semantics are still not implemented.
    mitigation: Carry this forward into PH02-T03/next import operations cycle; do not represent dead-letter escalation as automatic replay completion.
    owner: bjt-data-import
    status: open
    opened_at: 2026-04-29
    closed_at: TBD
  - id: PH02-R04
    phase_id: PHASE-02
    task_id: PH02-T03
    risk_level: medium
    category: rebuild_scale_limit
    description: Search rebuild currently caps each canonical content type at 5000 rows per run and does not yet paginate through larger corpora.
    mitigation: Accept for current data volume and track a paginated/batched rebuild follow-up before corpus growth exceeds this cap.
    owner: bjt-backend
    status: open
    opened_at: 2026-04-29
    closed_at: TBD
  - id: PH02-R05
    phase_id: PHASE-02
    task_id: PH02-T03
    risk_level: low
    category: permission_granularity
    description: Search rebuild currently relies on broad iam.manage permission rather than a search-specific least-privilege permission.
    mitigation: Accept for now because backend RBAC is enforced; refine to a narrower permission in a later IAM/admin hardening cycle.
    owner: bjt-security
    status: accepted
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH02-R06
    phase_id: PHASE-02
    task_id: PH02-T04
    risk_level: low
    category: ui_test_gap
    description: The new admin content quality review route has compile-time and reviewer evidence, but no dedicated automated UI test yet for review-kind switching or fallback behavior.
    mitigation: Accept for this slice and cover with a later admin UI/E2E expansion cycle.
    owner: bjt-qa
    status: accepted
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH02-R07
    phase_id: PHASE-02
    task_id: PH02-T04
    risk_level: low
    category: en_locale_partial
    description: The admin `en` locale still contains broader legacy Vietnamese strings outside the new quality review labels, so English editor UX remains partial.
    mitigation: Accept because `vi`/`ja` are the active editor locales in current flows; clean up `en` locale in a later localization pass.
    owner: bjt-localization-japan-vietnam
    status: accepted
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH02-R08
    phase_id: PHASE-02
    task_id: PH02-T05
    risk_level: low
    category: ui_workflow_gap
    description: New metadata integrity enforcement blocks flashcard linking, but learner has no built-in UI to complete the metadata workflow via the new endpoint.
    mitigation: Accept for this backend slice; learner UI for metadata entry can be added in a follow-up admin/learner UI cycle.
    owner: bjt-learner-ui
    status: accepted
    opened_at: 2026-04-29
    closed_at: TBD
  - id: PH02-R09
    phase_id: PHASE-02
    task_id: PH02-T05
    risk_level: low
    category: test_integration_gap
    description: PH02-T05 tests are controller/service unit-level and do not assert full HTTP contract behavior for the new rights-metadata endpoint.
    mitigation: Accept for this backend slice; add HTTP-level contract tests in a follow-up API integration cycle.
    owner: bjt-qa
    status: accepted
    opened_at: 2026-04-29
    closed_at: TBD
  - id: PH02-R10
    phase_id: PHASE-02
    task_id: PH02-T05
    risk_level: medium
    category: release_gate_typecheck_blocker
    description: Phase close typecheck failed at apps/api/src/operations/operations.controller.rbac.test.ts:107 (TS2345), causing QA block and Release Director no_ship.
    mitigation: Fix the test signature mismatch and rerun API/Admin typecheck before re-running Prompt 42 phase close gate.
    owner: bjt-backend
    status: closed
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH04-R04
    phase_id: PHASE-04
    task_id: PH04-T05
    risk_level: medium
    category: browser_runtime_visual_validation
    description: Initial browser phase review executed by bounded runner returned pass_with_risks with 404 findings on /vi for desktop and mobile in review environment.
    mitigation: Closed after frontend restart and bounded rerun for /vi and /vi/quiz returned pass with desktop/mobile screenshots. Evidence: company/reviews/browser-phase-review/phase-04-2026-04-29T15-01-30-257Z.md.
    owner: bjt-browser-qa
    status: closed
    opened_at: 2026-04-29
    closed_at: 2026-04-30
  - id: PH07-R03
    phase_id: PHASE-07
    task_id: PH07-T04
    risk_level: low
    category: analytics_data_hygiene
    description: Analytics payload boundary hardening now removes share tokens/referral codes for new events, but historical rows may still contain old payload fields.
    mitigation: Keep admin analytics responses aggregate-only and schedule optional scrub/backfill for historical payload keys before production release cut.
    owner: bjt-security
    status: open
    opened_at: 2026-04-30
    closed_at: TBD

  - id: PH08-R01
    phase_id: PHASE-08
    task_id: PH08-T02
    risk_level: low
    category: e2e_runtime_variance
    description: Authenticated-route UI assertions can vary in local runs without explicit session bootstrap.
    mitigation: Use deterministic auth-gate and privacy-negative assertions in smoke e2e; keep full authenticated-path browser review for dedicated release/browser gate.
    owner: bjt-qa
    status: accepted
    opened_at: 2026-04-30
    closed_at: TBD
  - id: PH08-R02
    phase_id: PHASE-08
    task_id: PH08-T05
    risk_level: medium
    category: backup_restore_drill_depth
    description: PH08-T05 verified backup/restore tooling and operational regression evidence, but did not execute a full production-like restore drill on a representative snapshot in this cycle.
    mitigation: Keep command-level readiness evidence as non-blocking for phase close; schedule dedicated restore drill rehearsal with timing/SLO evidence before final production release cut.
    owner: bjt-devops
    status: accepted
    opened_at: 2026-04-30
    closed_at: TBD
  - id: PH02-R11
    phase_id: PHASE-02
    task_id: PH02-T05
    risk_level: low
    category: openapi_contract_specificity
    description: OpenAPI endpoint exists for rights-metadata but contract specificity is weak for path/request/response typing, reducing client and review clarity.
    mitigation: Add explicit DTO/OpenAPI decorator mapping for rights-metadata endpoint and regenerate openapi artifacts.
    owner: bjt-backend
    status: closed
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH03-R01
    phase_id: PHASE-03
    task_id: PH03-T03
    risk_level: high
    category: exam_state_trust_model
    description: Initial PH03-T03 implementation trusted client-provided examContext, enabling potential meaning-visibility bypass.
    mitigation: Closed by server-authoritative quiz session binding (quizSessionId + DB session status + active-session replay guard) and integration tests for active/completed/warm-cache flows.
    owner: bjt-qa
    status: closed
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH03-R02
    phase_id: PHASE-03
    task_id: PH03-T03
    risk_level: low
    category: test_harness_warning_noise
    description: React act warnings persist in annotated-japanese-text a11y/network tests despite all assertions passing.
    mitigation: Accept as non-blocking for phase progression; schedule test harness cleanup in a later QA polish slice.
    owner: bjt-qa
    status: accepted
    opened_at: 2026-04-29
    closed_at: TBD
  - id: PH03-R03
    phase_id: PHASE-03
    task_id: PH03-T03
    risk_level: low
    category: protected_area_touch
    description: Root/locale layout changes were required for web build route stabilization and touched protected i18n/layout boundaries.
    mitigation: Keep change scoped and monitored; avoid additional layout churn outside explicit tasks.
    owner: bjt-boss
    status: accepted
    opened_at: 2026-04-29
    closed_at: TBD
  - id: PH03-R04
    phase_id: PHASE-03
    task_id: PH03-T04
    risk_level: low
    category: ui_test_depth
    description: Daily Hub comeback evidence block is validated by typecheck/build and backend unit tests, but has no dedicated component-level rendering test yet.
    mitigation: Closed in PH03-T05 by adding dedicated Daily Hub resilient-state component tests and localized comeback rating copy coverage.
    owner: bjt-qa
    status: closed
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH03-R05
    phase_id: PHASE-03
    task_id: PH03-T05
    risk_level: medium
    category: release_test_gate_gap
    description: Release gate command `pnpm -w exec turbo run test` fails because the workspace has no turbo `test` task, leaving monorepo test-gate evidence unresolved.
    mitigation: Closed. Root workspace `pnpm test` (vitest run) is the correct release-test command. Run result: 52 test files, 191 tests, all passed. Accepted as release test gate evidence.
    owner: bjt-qa
    status: closed
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH03-R06
    phase_id: PHASE-03
    task_id: PH03-T05
    risk_level: medium
    category: visual_review_evidence_gap
    description: Learner UI changed in PH03 but no concrete visual-review artifact path is recorded, so visual gate cannot be marked pass.
    mitigation: Closed. Visual review artifacts created for both changed learner routes: `company/reviews/ui-visual-review/ph03-learner-daily-hub-comeback.md` (PASS_WITH_RISKS) and `company/reviews/ui-visual-review/ph03-learner-quiz-reading-assist.md` (PASS_WITH_RISKS). Screenshot deferred to QA smoke cycle; all behavioral states verified by component tests.
    owner: bjt-learner-ui
    status: closed
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH04-R01
    phase_id: PHASE-04
    task_id: PH04-T01
    risk_level: medium
    category: review_gate_pending
    description: PH04-T01 is implemented and tested, but high-risk task gates (bjt-security and bjt-qa) have not been executed in this single-task cycle.
    mitigation: Closed. Specialist security and QA reviews were completed after additional sanitization and timeout/result guards; PH04-T02 remains held only for the explicit one-task approval checkpoint.
    owner: bjt-boss
    status: closed
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH04-R02
    phase_id: PHASE-04
    task_id: PH04-T01
    risk_level: medium
    category: integration_test_depth
    description: PH04-T01 relies on repository-level regression coverage for leak prevention and timeout guards; controller-level integration coverage was not added in this cycle.
    mitigation: Accept as non-blocking for PH04-T01 and schedule follow-up API/result-contract hardening in PH04-T04.
    owner: bjt-qa
    status: accepted
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH04-R03
    phase_id: PHASE-04
    task_id: PH04-T01
    risk_level: medium
    category: completed_results_payload_breadth
    description: The completed-session results path still returns a broad Prisma graph and should be narrowed to an explicit DTO before learner-facing results expansion.
    mitigation: Track as non-blocking follow-up under PH04-T04 Results API hardening and per-question breakdown.
    owner: bjt-backend
    status: accepted
    opened_at: 2026-04-29
    closed_at: 2026-04-29
  - id: PH05-R01
    phase_id: PHASE-05
    task_id: PH05-T04
    risk_level: medium
    category: analytics_integration_test_gap
    description: Admin analytics has repository/controller evidence and runtime usage, but no dedicated HTTP integration tests for contract-level regression detection.
    mitigation: Add API integration tests for GET /admin/analytics with RBAC, monetization gating, query validation, and degraded/freshness fields in next QA cycle.
    owner: bjt-qa
    status: open
    opened_at: 2026-04-30
    closed_at: TBD
  - id: PH07-R01
    phase_id: PHASE-07
    task_id: PH07-T02
    risk_level: medium
    category: media_accessibility_contract_gap
    description: Initial PH07 state lacked persisted accessibility metadata contract (alt/caption/transcript/reduced-motion) for upload lifecycle evidence.
    mitigation: Closed in PH07-T02 with DB migration + backend contract enforcement + targeted media/flashcard/shared test evidence.
    owner: bjt-backend
    status: closed
    opened_at: 2026-04-30
    closed_at: 2026-04-30
  - id: PH07-R02
    phase_id: PHASE-07
    task_id: PH07-T03
    risk_level: low
    category: share_revocation_followup
    description: PH07-T03 enforces create-time consent and privacy-safe summary rules, but learner self-serve revocation/list management for existing public share links is not implemented in this task.
    mitigation: Track revocation/list management as follow-up in PH07-T04/T05 growth safety hardening before final phase close.
    owner: bjt-growth-social
    status: accepted
    opened_at: 2026-04-30
    closed_at: TBD
  - id: PH07-R04
    phase_id: PHASE-07
    task_id: PH07-T05
    risk_level: low
    category: anti_abuse_threshold_tuning
    description: PH07-T05 introduces server-side invalid-answer strike enforcement (`anti_abuse_threshold`) with a fixed threshold and may require telemetry-guided tuning to minimize false positives under unstable client conditions.
    mitigation: Monitor `battle_answer_rejected` and `battle_abuse_detected` analytics rates by client/platform and tune threshold or add grace heuristics before production launch.
    owner: bjt-security
    status: accepted
    opened_at: 2026-04-30
    closed_at: TBD
```

## PHASE-10 State Reconciliation Addendum

```yaml
phase_10_state_risks:
  - id: PH10-R01
    phase_id: PHASE-10
    task_id: PH10-STATE
    risk_level: high
    category: governance_state_drift
    description: PHASE_PLAN used a PHASE-10 header with stale PH09 task queue, while CURRENT_PHASE mixed PH10 remediation tasks with PH09 carryover and pending_approval statuses.
    mitigation: Replaced PHASE_PLAN and CURRENT_PHASE with coherent PH10 queue, set current task PH10-T04-P0-1 approval_required=no, and added no-instruction-only-stop rules.
    owner: bjt-boss
    status: mitigated
    opened_at: 2026-04-30
    closed_at: 2026-04-30
```

## PHASE-10 Close Addendum

```yaml
phase_10_close_risks:
  - id: PH10-R04
    phase_id: PHASE-10
    task_id: PH10-T08
    risk_level: low
    category: admin_100_gate_residual
    description: Admin 100 gate passes. 5 battle scaffold routes still render scaffold content when adminNav.battle=true (opt-in). 21 phase-11 routes return notFound(). No scaffold visible by default.
    mitigation: Battle routes remain scaffold until Phase-11 ships. Monitor for accidental flag enablement in production.
    owner: bjt-release-director
    status: accepted
    opened_at: 2026-04-30
    closed_at: TBD
  - id: PH10-R02
    phase_id: PHASE-10
    task_id: PH10-CLOSE
    risk_level: high
    category: final_launch_blocked_by_admin_100
    description: PHASE-10 closes with ship_with_risks at phase scope, but final production launch remains blocked until Admin 100 completion gate passes.
    mitigation: Run prompt 49 audit and prompt 50 completion cycle until enabled admin scaffold routes are fully closed or explicitly feature-disabled.
    owner: bjt-boss
    status: resolved
    resolved_by: PH10-T07 and PH10-T08 admin reality audit
    opened_at: 2026-04-30
    closed_at: 2026-04-30
  - id: PH10-R03
    phase_id: PHASE-10
    task_id: PH10-T07
    risk_level: high
    category: battle_admin_flag_default_enabled
    description: Battle admin scaffold routes are cutline-excluded, but `adminNav.battle` is visible by default when the feature flag key is omitted.
    mitigation: Added `adminNav.battle` to `ADMIN_FEATURE_FLAG_DEFAULTS_OFF`; now defaults OFF without explicit env opt-in.
    owner: bjt-release-director
    status: resolved
    resolved_by: admin-feature-flags.ts ADMIN_FEATURE_FLAG_DEFAULTS_OFF implementation
    opened_at: 2026-04-30
    closed_at: 2026-04-30
  - id: PH10-R05
    phase_id: PHASE-10
    task_id: PH10-T08-reality-audit
    risk_level: high
    category: connected_but_incomplete_p1_routes
    description: >
      Reality audit (2026-04-30) found 4 P1 connected_but_incomplete routes that show empty tables
      with no API call while appearing functional in the UI:
      - op.import (/import): missing endpoint prop
      - op.manifests (/import/manifests): wrong endpoint (shows import errors instead of manifests)
      - cm.media (/media): missing endpoint prop
      - as.bjt (/bjt): missing endpoint prop
    mitigation: >
      P1 routes were removed from default-visible admin scope using production-gate flags
      (`adminNav.prodGate.media`, `adminNav.prodGate.assessmentBjt`,
      `adminNav.prodGate.importOverview`, `adminNav.prodGate.importManifests`) and
      route-level `notFound()` guards to prevent direct incomplete access.
    owner: bjt-admin-ui
    status: resolved
    resolved_by: PH10 one-click loop fix iteration (prodGate hide + notFound for 4 P1 routes)
    opened_at: 2026-04-30
    closed_at: 2026-04-30
  - id: PH10-R06
    phase_id: PHASE-10
    task_id: PH10-T08-reality-audit
    risk_level: medium
    category: connected_but_incomplete_p2_routes
    description: >
      Reality audit found 8 P2 connected_but_incomplete routes previously labeled Phase-11:
      - u.360, u.notes, u.privacy, u.export: all render identical UsersConsoleClient, no dedicated workflow surfaced
      - an.learning, an.content, an.search: static stub pages (header + back-link only)
      - op.settings: missing endpoint prop
      - Monetization sub-pages: no initialTab prop; deep-link lands on overview tab
    mitigation: Superseded by the full-admin directive. These routes must be implemented as admin product-depth slices before full admin production-ready.
    owner: bjt-admin-ui
    status: accepted
    opened_at: 2026-04-30
    closed_at: TBD
```

Status values:

- open
- mitigated
- accepted
- blocked
- closed

## Mandatory Escalation

Boss must stop phase execution and request decision when risk is:

1. critical and unresolved
2. high with security/billing/auth/privacy ambiguity
3. related to destructive migration possibility
4. related to DO_NOT_TOUCH production-ready module boundary
5. above the phase max risk threshold in `company/PHASE_PLAN.md`

## Per-Task Update Rule

After each PHASE_BATCH task, append or update relevant risk entries and reference affected files/checks.

## PHASE-06 Close Addendum

```yaml
phase_06_residual_risks:
  - id: PH06-R01
    phase_id: PHASE-06
    task_id: PH06-T03
    risk_level: medium
    category: webhook_rate_limit_hardening
    description: Admin webhook ingest endpoint has RBAC and idempotency but still lacks gateway/API rate limiting controls.
    mitigation: Add rate-limit policy at gateway or service middleware before external billing provider go-live.
    owner: bjt-platform
    status: open
    opened_at: 2026-04-30
    closed_at: TBD
  - id: PH06-R02
    phase_id: PHASE-06
    task_id: PH06-T03
    risk_level: medium
    category: webhook_payload_encryption
    description: BillingWebhookEvent.rawPayload is stored plain JSON and should be field-encrypted before production billing rollout.
    mitigation: Implement field-level encryption and key management for raw webhook payload storage.
    owner: bjt-platform
    status: open
    opened_at: 2026-04-30
    closed_at: TBD
  - id: PH06-R03
    phase_id: PHASE-06
    task_id: PH06-T05
    risk_level: medium
    category: privacy_export_download_url_security
    description: Privacy export download URL generation is still a documented stub pending async processor wiring.
    mitigation: Replace stub with expiring signed URL generation when BullMQ privacy export processor is implemented.
    owner: bjt-backend
    status: open
    opened_at: 2026-04-30
    closed_at: TBD
```

## PHASE-09 Final Gate Addendum

```yaml
phase_09_residual_risks:
  - id: PH09-R01
    phase_id: PHASE-09
    task_id: PH09-T01
    risk_level: high
    category: ci_truth_lint_red
    description: Workspace lint gate is red (`pnpm lint`) with 290 issues (289 errors, 1 warning), blocking production release approval.
    mitigation: Closed after REQUEST_PHASE_FIXES; lint rerun passed with 0 errors and 1 pre-existing warning.
    owner: bjt-qa
    status: closed
    opened_at: 2026-04-30
    closed_at: 2026-04-30
  - id: PH09-R02
    phase_id: PHASE-09
    task_id: PH09-T02
    risk_level: high
    category: schema_drift_and_unapplied_migrations
    description: Full test suite failed with missing `asset.provenance` column and migration status shows two unapplied migrations.
    mitigation: Closed after REQUEST_PHASE_FIXES; additive migrations applied locally, schema parity restored, and full vitest suite passed.
    owner: bjt-backend
    status: closed
    opened_at: 2026-04-30
    closed_at: 2026-04-30
  - id: PH09-R03
    phase_id: PHASE-09
    task_id: PH09-T07
    risk_level: medium
    category: backup_restore_drill_depth
    description: Backup/restore readiness has command-level evidence, but full production-like restore drill is still pending from PH08.
    mitigation: Run production-like restore drill before final production launch sign-off.
    owner: bjt-devops
    status: accepted
    opened_at: 2026-04-30
    closed_at: TBD
  - id: PH09-R04
    phase_id: PHASE-09
    task_id: PH09-T07
    risk_level: high
    category: admin_workspace_completion
    description: Admin workspace still has enabled scaffold modules after PHASE-09 evidence; refreshed snapshot shows 26 nav scaffold entries and 26 scaffold route pages.
    mitigation: Run Admin 100 audit and completion prompts, then require admin-100-completion-gate pass before final production launch.
    owner: bjt-boss
    status: open
    opened_at: 2026-04-30
    closed_at: TBD
```
