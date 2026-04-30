# 32 — Phase 00 Truth and Foundation

<context-hint>
Use first when docs/API truth, backlog, feature flag baseline, or CI evidence is still drifting.
</context-hint>

<task>
Act as `bjt-boss`. Prepare `company/PHASE_PLAN.md` for PHASE-00 Truth and Foundation. Do not implement until human approves the phase.
</task>

<instructions>
1. Read `company/OPERATING_MODE.md`, `company/PHASE_ROADMAP.md`, `company/backlog.md`, `company/PROJECT_STATE.md`, `company/project-state.md`, and `docs/spec/index.md`.
2. Create/update `company/PHASE_PLAN.md` for:
   - Phase ID: `PHASE-00`
   - Mode: `PHASE_BATCH`
   - Phase Title: `Truth and Foundation`
   - `approval_status: pending`
   - `approval_token: TBD`
3. Include only related P0/P1 tasks for:
   - API truth docs/API registry convergence
   - backend runtime feature flags and kill-switch baseline
   - CI/test command truth
   - current backlog/project-state/handoff synchronization
4. Use owners/reviewers:
   - owner: `bjt-backend`, `bjt-devops`, or `bjt-docs`
   - reviewer: `bjt-release-director` or `bjt-qa`
5. Set budget:
   - max_tasks_this_run: 3
   - max_files_changed_this_run: 25
   - max_risk_level_without_stop: medium
6. End by asking human to approve or edit the phase plan.
</instructions>

<definition-of-done>
- API truth docs are not misleading.
- Feature flag/kill-switch baseline is real or explicitly tracked.
- CI/test command truth is documented.
- Backlog/state/handoff files agree on next task.
- No product code is changed by this planning prompt.
</definition-of-done>
