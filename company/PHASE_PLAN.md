# Phase Plan

## Phase ID

PHASE-10

## Mode

PHASE_BATCH

## Phase Title

Admin 100% Completion + BJT UI/UX Production Hardening

## Scope

PHASE-10 exists because PHASE-09 closed the prior release gate with risks, but final production launch is still blocked by:

- enabled admin scaffold routes
- learner UI/UX blockers found by BJT-specific review
- battle feature flag/share/privacy gaps
- remaining launch-quality visual/browser evidence gaps

This phase must not run the final production launch gate. It prepares the product for a later final release gate.

Scoped cutline for PHASE-10 execution:

- Execute only `must_ship_mvp` admin scaffold groups from `company/PHASE_10_T02_PLAN.md`.
- Keep battle admin routes disabled for MVP via feature flags.
- Defer non-MVP admin scaffold groups to PHASE-11.
- Continue learner P1 hardening using existing UI loading/panel patterns (no new skeleton library dependency).

## Approval

approval_status: approved
approved_by: human_directive_2026_04_30_RUN_NEXT_PHASE
approved_at: 2026-04-30
approval_token: HUMAN_APPROVE_PHASE10_REMEDIATION_2026_04_30

Allowed approval status values:

- pending
- approved
- rejected
- paused

## Phase Budget

max_tasks_this_run: 10
max_files_changed_this_run: 120
max_risk_level_without_stop: high
requires_mid_phase_approval_after_tasks: 0

Boss must stop when a budget is exceeded unless the human explicitly approves continuation.

## Required Human Approval Points

- phase_start: approved
- mid_phase: none
- blocker_override: required
- phase_end: required_or_delegated_if_policy_conditions_pass
- final_production_launch: required

## Required Agents

- owners:
  - bjt-boss
  - bjt-admin-ui
  - bjt-learner-ui
  - bjt-backend
  - bjt-qa
- reviewers:
  - bjt-learning-science
  - bjt-media-experience
  - bjt-security
  - bjt-release-director
  - bjt-browser-qa

## Task Queue

```yaml
task_queue:
  - id: PH10-T01
    title: Admin 100 audit and inventory reconciliation
    status: passed
    owner_agent: bjt-boss
    reviewer_agents:
      - bjt-release-director
    dependency_on: none
    risk_level: high
    required_gates:
      - admin_100_completion_gate
      - no_fake_production
    evidence:
      - company/ADMIN_COMPLETION_PROGRAM.md
      - company/admin-module-inventory.md
      - company/PHASE_10_T02_PLAN.md
    notes: |
      Audit found 59 enabled admin scaffold routes. Admin 100 remains a final-launch blocker.

  - id: PH10-T02
    title: Admin completion strategy and MVP battle flag decision
    status: passed
    owner_agent: bjt-boss
    reviewer_agents:
      - bjt-admin-ui
      - bjt-release-director
    dependency_on: PH10-T01
    risk_level: high
    required_gates:
      - admin_100_completion_gate
      - ui_production_gate
    evidence:
      - company/PHASE_10_T02_PLAN.md
    notes: |
      MVP path is to keep admin completion moving group-by-group and disable incomplete battle admin in production unless completed.

  - id: PH10-T03
    title: BJT learner UI/UX production review
    status: passed
    owner_agent: bjt-learner-ui
    reviewer_agents:
      - bjt-learning-science
      - bjt-media-experience
      - bjt-qa
    dependency_on: PH10-T02
    risk_level: high
    required_gates:
      - bjt_ui_ux_production_gate
      - learner_page_production_gate
    evidence:
      - company/PHASE_10_T03_REMEDIATION_TASKS.md
      - company/PHASE_10_T04_REMEDIATION_TASK_BREAKDOWN.md
    notes: |
      Review completed and produced P0/P1 remediation queue. The review task is complete; remediation tasks remain.

  - id: PH10-T04-P0-1
    title: Flashcard remediation plus comeback mode persistence
    status: passed
    owner_agent: bjt-learner-ui
    secondary_agent: bjt-backend
    reviewer_agents:
      - bjt-learning-science
      - bjt-qa
    dependency_on: PH10-T03
    risk_level: high
    required_gates:
      - bjt_ui_ux_production_gate
      - learning_quality_gate
      - learner_page_production_gate
      - typecheck
      - targeted_tests
    notes: |
      Implement post-failure flashcard remediation, verify comeback persistence, remove unsafe casts, and add targeted evidence.

  - id: PH10-T04-P0-2
    title: Battle share UI, privacy preview, and production feature flag guard
    status: passed
    owner_agent: bjt-learner-ui
    secondary_agent: bjt-backend
    reviewer_agents:
      - bjt-media-experience
      - bjt-security
      - bjt-qa
      - bjt-browser-qa
    dependency_on: PH10-T04-P0-1
    risk_level: high
    required_gates:
      - bjt_ui_ux_production_gate
      - media_quality_gate
      - growth_ethics_gate
      - privacy_review
      - browser_phase_review
    notes: |
      Either complete privacy-safe battle share/postcard flow or hard-disable incomplete battle surfaces for production.

  - id: PH10-T04-P1-1
    title: Daily Hub skeleton states, comeback link, and mobile 375px hardening
    status: passed
    owner_agent: bjt-learner-ui
    reviewer_agents:
      - bjt-learning-science
      - bjt-qa
    dependency_on: PH10-T04-P0-2
    risk_level: medium
    required_gates:
      - bjt_ui_ux_production_gate
      - learner_page_production_gate
      - visual_review
    notes: |
      Add honest loading states and a clear comeback resume action without increasing cognitive load.
      Use existing UI patterns in repository (cards/spinners/placeholder blocks), not a new skeleton component library.

  - id: PH10-T04-P1-2
    title: Quiz mode badge, estimated score caveat, and mobile layout hardening
    status: passed
    owner_agent: bjt-learner-ui
    reviewer_agents:
      - bjt-assessment-psychometrics
      - bjt-learning-science
      - bjt-qa
    dependency_on: PH10-T04-P1-1
    risk_level: medium
    required_gates:
      - bjt_ui_ux_production_gate
      - assessment_quality_gate
      - learner_page_production_gate
      - visual_review
    notes: |
      Estimated score must be visibly estimated and quiz mode must be clear on desktop/mobile.

  - id: PH10-T04-P1-3
    title: Reading Assist retry/error states and dynamic weak-skill progress
    status: passed
    owner_agent: bjt-learner-ui
    secondary_agent: bjt-backend
    reviewer_agents:
      - bjt-learning-science
      - bjt-qa
    dependency_on: PH10-T04-P1-2
    risk_level: medium
    required_gates:
      - bjt_ui_ux_production_gate
      - learning_quality_gate
      - learner_page_production_gate
      - targeted_tests
    notes: |
      Reading support failures must be visible/retryable, and progress weak skills must come from real data or be honestly unavailable.

  - id: PH10-T05
    title: Admin must-ship MVP groups execution (scoped cutline)
    status: passed
    owner_agent: bjt-admin-ui
    secondary_agent: bjt-backend
    reviewer_agents:
      - bjt-security
      - bjt-qa
      - bjt-release-director
    dependency_on: PH10-T04-P0-2
    risk_level: high
    required_gates:
      - admin_100_completion_gate
      - admin_page_production_gate
      - no_fake_production
      - targeted_tests
    notes: |
      Execute only must_ship_mvp groups from company/PHASE_10_T02_PLAN.md:
      System, Operations, IAM, Users/Privacy, Legal, Monetization, Import.
      Historical PHASE-10 scope excluded PHASE-11-labeled admin groups; the current full-admin directive supersedes that cutline and requires implementing them as production slices.

  - id: PH10-T06
    title: PHASE-10 review packet, browser evidence, and Release Director no-launch decision
    status: passed
    owner_agent: bjt-release-director
    reviewer_agents:
      - bjt-qa
      - bjt-security
      - bjt-browser-qa
    dependency_on: PH10-T05
    risk_level: high
    required_gates:
      - diff_review
      - rollback_safety
      - no_fake_production
      - browser_phase_review
      - release_director_gate
    notes: |
      Close PHASE-10 only. Do not approve public production launch in this phase.
```

Allowed status values:

- pending
- in_progress
- passed
- failed
- blocked
- skipped

## Stop Conditions

Boss must stop immediately if any condition occurs:

1. destructive migration or irreversible data operation risk
2. unresolved security/privacy/legal/billing ambiguity
3. build/typecheck cannot be restored after 2 targeted fixes
4. tests fail after 2 targeted fixes
5. fake success would be required
6. admin write lacks backend RBAC or audit path
7. exam/quiz flow leaks answer keys or forbidden help
8. browser review confirms broken route after bounded restart retry
9. Release Director returns `no_ship`
10. final production launch decision is requested

## No Instruction-Only Stop

Because this phase is already approved and unattended continuation is active, Boss/Human Proxy must not stop with text such as:

- `Now run Boss Phase Batch execution`
- `Handoff ready to Boss`
- `Run prompt 29 next`

If the selected action is `.github/prompts/29_boss_run_phase_batch.prompt.md` and no stop condition exists, execute or inline the phase batch action in the same run.

## Definition of Done

- P0 learner UI/UX blockers are closed or explicitly blocked with owner and evidence.
- P1 learner UI/UX risks are fixed or accepted with owner and next action.
- Admin 100 first production slice reduces enabled scaffold count or records a concrete backend blocker.
- Browser/visual evidence exists for user-visible changes.
- Release Director closes PHASE-10 with `ship_with_risks` or `no_ship` for the phase scope only.
- Final production launch remains a separate human decision.
