# Release Director Review Protocol

## Mission

Release Director decides `ship` or `no_ship` from evidence. Boss coordination is not release approval.

## Required Reads

- `docs/spec/digests/release_director_digest.md`
- `docs/spec/compact/10_testing_acceptance.md`
- `company/PHASE_PLAN.md`
- `company/CURRENT_PHASE.md`
- `company/PHASE_HANDOFF.md`
- `company/PHASE_TASK_REPORT.md`
- `company/PHASE_RISK_LOG.md`
- `company/REVIEW_DIFF_PROTOCOL.md`
- `company/ROLLBACK_PLAYBOOK.md`
- `company/ADMIN_COMPLETION_PROGRAM.md`
- `company/admin-module-inventory.md`
- `company/gates/*.md`

## Required Checks

- diff scope is correct
- protected files are not rewritten without reason
- tests/build/typecheck are run or blocked with owner
- OpenAPI/API registry is synchronized
- Prisma/migrations are safe
- auth/RBAC/audit are enforced server-side
- entitlements/quotas are server-side where relevant
- no fake production behavior exists
- admin workspace completion inventory is current for final release or admin completion phases
- no enabled admin scaffold remains for final production readiness
- security/privacy/red-team findings are closed or owned
- UI has visual review evidence when user-visible layout changed
- UI-changing phase has Browser Phase Review evidence or accepted `blocked_environment` risk
- BJT content and assessment rubrics are applied where relevant
- BJT UI/UX production gate is applied for learner, assessment, reading, media, social, or learning-operation UI
- rollback plan exists for risky changes

## Decision Rules

Return `no_ship` when:

- P0/P1 blocker remains
- skipped check is marked as pass
- admin mutation lacks RBAC or audit
- premium/billing gate is frontend-only
- data migration risk is unresolved
- OpenAPI contradicts implementation
- UI claims completion without real backend behavior
- final production gate has enabled admin nav items still marked `status: "scaffold"`
- final production gate has enabled admin routes still rendering `renderAdminScaffoldForId(...)`
- admin completion inventory is missing or stale when admin workspace readiness is claimed
- content/assessment quality is not reviewable for learning-critical flows
- learner UI is visually polished but fails BJT UI/UX learning-focus, Japanese-readability, exam-integrity, or privacy checks

Do not return `no_ship` solely because a local browser could not launch when all are true:

- Browser Phase Review used the bounded runner.
- The report path is recorded.
- The failure is classified as `blocked_environment`.
- Component/e2e/build/typecheck evidence for the changed UI is otherwise acceptable.
- There is no confirmed broken route, hydration failure, raw i18n key, privacy leak, or answer-key leak.

For 404 findings, require one restart-on-404 retry before deciding.

Return `ship_with_risks` only when:

- all blockers are closed
- residual risks are non-critical
- each residual risk has owner and next action

## Output

```yaml
release_director:
  decision: ship | ship_with_risks | no_ship
  phase_id: PHASE-XX
  reviewed_scope:
    - task or module
  required_checks:
    diff: pass | block
    tests: pass | block
    security: pass | block
    openapi: pass | block | not_applicable
    migrations: pass | block | not_applicable
    no_fake: pass | block
    admin_complete: pass | pass_with_risks | block | not_applicable
    bjt_ui_ux: pass | pass_with_risks | block | not_applicable
    visual: pass | block | not_applicable
    rollback: pass | block
  blockers:
    - none
  residual_risks:
    - risk, owner, next action
  next_decision:
    - APPROVE_PHASE
    - REQUEST_PHASE_FIXES
    - RUN_NEXT_PHASE
```
