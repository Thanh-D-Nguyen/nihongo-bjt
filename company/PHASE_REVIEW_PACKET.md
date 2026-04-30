# Phase Review Packet

## Purpose

Use this packet when a phase implementation appears complete but has not passed final review.

## PHASE-10 Close Evidence

- phase_status: implementation_complete
- review_scope: PH10-T01 through PH10-T06
- typecheck/tests: pass (carried from per-task evidence in `company/PHASE_TASK_REPORT.md`)
- browser_phase_review_admin: pass (`company/reviews/browser-phase-review/phase-10-2026-04-30T06-19-46-653Z.md`)
- browser_phase_review_web: pass (`company/reviews/browser-phase-review/phase-10-2026-04-30T06-19-59-933Z.md`)
- no_fake_production: pass for PHASE-10 launch cutline only. Superseding full-admin directive: previously deferred admin routes remain blockers until implemented.
- release_director_decision: ship_with_risks (phase scope only)
- final_launch: blocked (Admin 100 completion gate + residual risks)

## PHASE-10 Close Criteria

```yaml
phase_review:
  phase_id: PHASE-10
  status: completed_with_risks
  all_tasks_reviewed: true
  release_director_decision: ship_with_risks
  final_launch_decision: no_launch
  closed_at: 2026-04-30
  required_checks:
    diff: pass
    tests: pass
    security: pass
    openapi: pass_or_not_applicable_per_task
    migrations: pass_or_not_applicable_per_task
    no_fake: pass
    browser_phase_review: pass
    rollback: pass
    admin_100_completion_gate: block_for_final_launch
  residual_risks:
    - id: PH07-R02
      owner: bjt-growth-social
      next_action: add learner self-serve revoke/list management for existing public share links
    - id: PH07-R03
      owner: bjt-security
      next_action: optional scrub/backfill for historical analytics payload keys before production cut
    - id: PH08-R01
      owner: bjt-qa
      next_action: keep deterministic authenticated-route e2e bootstrap in dedicated browser/release gate
    - id: PH08-R02
      owner: bjt-devops
      next_action: run production-like restore drill rehearsal with timing/SLO evidence before production release cut
    - id: PH10-R01
      owner: bjt-boss
      next_action: execute Admin 100 audit/completion prompts 49 and 50 before final launch gate
  next_allowed_action:
    - RUN_NEXT_PHASE
```

## Current Reminder

PHASE-09 closed. Release Director decision `ship_with_risks`. All CI-truth blockers resolved after REQUEST_PHASE_FIXES applied. Residual risks PH07-R02, PH07-R03, PH08-R01, PH08-R02 carried forward with owners.

## PHASE-09 Close Evidence

- lint: pass (0 errors, 1 pre-existing warning) — eslint.config.mjs test-file override + quiz.repository.ts Prisma types fixed
- typecheck: pass (8/8 packages, `pnpm -w exec turbo run typecheck`)
- tests: pass (272/272, full vitest suite)
- build: pass (`pnpm --filter @nihongo-bjt/api run build` tsc --noEmit clean)
- openapi: pass (generated `docs/openapi.json` synchronized)
- migrations: pass (media.asset.provenance, media.asset.accessibility, growth.user_share_postcard_opt_in applied)
- security/privacy targeted suite: pass (13/13 — media rights + growth share privacy)
- no_fake_production: pass (all fixes are lint/type-only, no logic change)
- browser_phase_review: not_applicable (CI/QA truth gate phase, no UI changes)
- release_director_decision: ship_with_risks

## PHASE-09 Close Criteria

```yaml
phase_review:
  phase_id: PHASE-09
  status: completed_with_risks
  all_tasks_reviewed: true
  release_director_decision: ship_with_risks
  closed_at: 2026-04-30
  residual_risks:
    - id: PH07-R02
      owner: bjt-growth-social
      next_action: add learner self-serve revoke/list management for existing public share links
    - id: PH07-R03
      owner: bjt-security
      next_action: optional scrub/backfill for historical analytics payload keys before production release cut
    - id: PH08-R01
      owner: bjt-qa
      next_action: keep deterministic authenticated-route e2e bootstrap in dedicated browser/release gate
    - id: PH08-R02
      owner: bjt-devops
      next_action: run production-like restore drill rehearsal with timing/SLO evidence before production release cut
  next_allowed_action:
    - RUN_NEXT_PHASE
    - RUN_RELEASE_GATE
```

## PHASE-08 Close Evidence

- specialist reviews: pass (red-team + release-director inline review)
- typecheck: pass (`pnpm --filter @nihongo-bjt/api typecheck`)
- tests: pass (`pnpm vitest` targeted packs: 31/31 + 21/21)
- openapi: pass (generated in PH08-T03 and synchronized)
- no_fake_production: pass (no fake readiness/ops evidence)
- browser_phase_review: not_applicable (backend-only phase)
- security_review: pass
- migrations: not_applicable for PH08-T05/T06
- rollback: pass (no destructive changes; forward-fixable)

## PHASE-08 Close Criteria

```yaml
phase_review:
  phase_id: PHASE-08
  status: completed_with_risks
  all_tasks_reviewed: true
  release_director_decision: ship_with_risks
  closed_at: 2026-04-30
  residual_risks:
    - id: PH07-R02
      owner: bjt-growth-social
      next_action: add learner self-serve revoke/list management for existing public share links
    - id: PH07-R03
      owner: bjt-security
      next_action: optional scrub/backfill for historical analytics payload keys (`publicToken`/`code`) before production release cut
    - id: PH08-R01
      owner: bjt-qa
      next_action: keep deterministic authenticated-route e2e bootstrap in dedicated browser/release gate
    - id: PH08-R02
      owner: bjt-devops
      next_action: run production-like restore drill rehearsal with timing/SLO evidence before production release cut
  next_allowed_action:
    - RUN_NEXT_PHASE
    - RUN_RELEASE_GATE
```

## Required Review Order

1. Specialist review for any task still marked `awaiting_specialist_review`.
2. QA evidence review.
3. Diff review.
4. No-fake-production audit.
5. Security/privacy review if routes, media, imports, admin actions, or external URLs changed.
6. Visual review if admin/learner UI changed.
7. Release Director phase gate.
8. Update handoff, risk log, project state, and backlog.

## PHASE-06 Close Evidence

- specialist reviews: pass (security + red-team)
- typecheck: pass (`pnpm --filter @nihongo-bjt/api typecheck`, `pnpm -w exec turbo run typecheck`)
- tests: pass (targeted PH06/API suites and previously recorded PH06 test packs)
- openapi: not_applicable (no PH06 contract-regeneration requirement evidenced)
- no_fake_production: pass (all completed tasks wired to real backend contracts/provider interfaces)
- browser_phase_review: not_applicable (backend-only phase)
- growth_ethics_gate: pass (no manipulative growth/pay-to-win behavior added in scope)
- migrations: pass (additive schema changes, no destructive migration evidence)
- rollback: pass (Level 2/4 forward-fixable via provider gating + RBAC deny-by-default)

## Close Criteria

```yaml
phase_review:
  phase_id: PHASE-06
  status: completed
  all_tasks_reviewed: true
  release_director_decision: ship_with_risks
  closed_at: 2026-04-30
  residual_risks:
    - id: PH06-R01
      owner: bjt-platform
      next_action: add gateway/API rate limit for admin webhook ingest
    - id: PH06-R02
      owner: bjt-platform
      next_action: add field-level encryption for billing webhook raw payload before production provider rollout
    - id: PH06-R03
      owner: bjt-backend
      next_action: replace privacy export downloadUrl stub with expiring signed URL in async processor
  next_allowed_action:
    - RUN_RELEASE_GATE
```
