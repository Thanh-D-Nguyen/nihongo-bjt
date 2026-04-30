# BJT AI Company Operating Mode

## Mission

Take over the partially implemented NihonGo BJT project and deliver production-grade increments aligned to the canonical spec:

`docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md`

Use minimal context by default: spec index, digest, then compact files.

## Takeover baseline

1. Verify company operating files and structure.
2. Normalize company operating documents.
3. Pick exactly one backlog item for each cycle.
4. Run one task as one PR-equivalent cycle.
5. Produce handoff evidence and stop.

## Execution modes

Two valid operating modes:

1. `CYCLE_MODE` (default): one backlog task per run, then approval checkpoint.
2. `PHASE_BATCH`: one approved phase contains multiple related tasks; Boss continues task-by-task and stops only at phase gates or serious blockers.
3. `HUMAN_PROXY_LOOP`: Program Director selects the next safe Boss prompt/action and continues until a hard approval boundary.

Mode selection is explicit in `company/PHASE_PLAN.md` and reflected live in `company/CURRENT_PHASE.md`.

## Canonical operations files

Primary files:

- `company/OPERATING_MODE.md`
- `company/AUTOPILOT_MODE.md`
- `company/AUTOPILOT_STATE.md`
- `company/HUMAN_PROXY_MODE.md`
- `company/HUMAN_DELEGATION_POLICY.md`
- `company/UNATTENDED_RUN_POLICY.md`
- `company/BROWSER_PHASE_REVIEW_POLICY.md`
- `company/ADMIN_COMPLETION_PROGRAM.md`
- `company/admin-module-inventory.md`
- `company/CURRENT_CYCLE.md`
- `company/PHASE_PLAN.md`
- `company/PHASE_ROADMAP.md`
- `company/CURRENT_PHASE.md`
- `company/PHASE_HANDOFF.md`
- `company/PHASE_TASK_REPORT.md`
- `company/PHASE_RISK_LOG.md`
- `company/PHASE_REVIEW_PACKET.md`
- `company/TOKEN_BUDGET_PROTOCOL.md`
- `company/REVIEW_DIFF_PROTOCOL.md`
- `company/ROLLBACK_PLAYBOOK.md`
- `company/RELEASE_DIRECTOR_REVIEW_PROTOCOL.md`
- `company/DO_NOT_TOUCH.md`
- `company/skills/ui-production/`
- `company/skills/bjt-ui-ux/`
- `company/COMPANY_BACKLOG.md`
- `company/PROJECT_STATE.md`
- `company/DECISION_LOG.md`
- `company/AGENT_HANDOFF.md`

Compatibility aliases:

- `company/backlog.md`
- `company/project-state.md`
- `company/decision-log.md`
- `company/handoff.md`

## Default cycle

1. Read project state and current cycle.
2. Select one highest-value P0/P1 backlog item.
3. Assign minimal agents required.
4. Implement only scoped files.
5. Run gates/verification commands.
6. Apply diff review and rollback-safety checks when files changed.
7. Update backlog, decision log, and handoff.
8. Stop after one completed cycle.

## PHASE_BATCH mode

Use when human approves a phase-level plan and wants faster delivery of related tasks.

### Start conditions

Boss may start PHASE_BATCH only when:

1. `company/PHASE_PLAN.md` exists and includes approved task queue.
2. `approval_status` for the phase is approved.
3. `approval_token` is non-empty.
4. max task/file/risk budget is defined.
5. `company/CURRENT_PHASE.md` is initialized.

### Run behavior

Boss runs tasks in dependency order and does not stop after every small task when all of the following are true:

- task passes implementation review
- tests/checks are acceptable
- no migration danger
- no security/billing/RBAC blocker
- no spec conflict
- no `company/DO_NOT_TOUCH.md` violation

### Mandatory task order constraints

1. database/schema before backend
2. backend/API before UI
3. feature flags before gated UI
4. RBAC before admin pages
5. tests before release gate
6. docs/handoff last

### Immediate stop conditions

Boss must stop immediately if any condition occurs:

1. database migration may delete or rewrite existing data
2. auth/RBAC/security/billing/privacy logic is ambiguous
3. tests fail after 2 targeted repair attempts
4. build/typecheck cannot be restored
5. required external secret/provider is not configured
6. changes would touch production-ready modules listed in `company/DO_NOT_TOUCH.md`
7. fake success would be required to continue
8. spec conflict cannot be resolved from compact docs
9. explicit user approval is required by `company/PHASE_PLAN.md`
10. max task count, max file count, or max risk threshold is exceeded

### Per-task required updates inside PHASE_BATCH

After each task, Boss must update:

- `company/CURRENT_PHASE.md`
- `company/PHASE_HANDOFF.md`
- `company/PHASE_TASK_REPORT.md`
- `company/PHASE_RISK_LOG.md`
- `company/backlog.md`
- `company/project-state.md`

Boss should also synchronize uppercase mirrors (`COMPANY_BACKLOG.md`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`) when feasible.

### Phase review requirement

Owner implementation pass is not phase approval.

Before a phase can be marked completed, Boss must run:

- `company/PHASE_REVIEW_PACKET.md`
- `company/REVIEW_DIFF_PROTOCOL.md`
- `company/gates/diff-review-gate.md`
- `company/gates/no-fake-production-gate.md`
- `company/gates/rollback-safety-gate.md`
- `company/gates/visual-review-gate.md` when UI changed
- `company/gates/browser-phase-review-gate.md` when phase UI changed
- `company/gates/bjt-content-assessment-rubrics.md` when learning content or assessment changed
- `company/gates/ui-production-gate.md` when UI changed
- `company/gates/bjt-ui-ux-production-gate.md` when learner, assessment, reading, media, social, or learning-operations UI changed
- `company/gates/admin-page-production-gate.md` when admin UI changed
- `company/gates/open-design-bjt-ui-gate.md` when admin or learner UI changed
- `company/gates/admin-100-completion-gate.md` when admin workspace completion or final release is evaluated
- `company/gates/learner-page-production-gate.md` when learner UI changed
- `company/RELEASE_DIRECTOR_REVIEW_PROTOCOL.md`

If a phase changed UI, Browser Phase Review must run before final phase approval unless recorded as `not_applicable`.

## UI Skill Loading Rule

For any admin UI task, Boss must load:

- `company/skills/agent-quality/00-karpathy-production-agent-skill.md`
- `company/skills/ui-production/00-ui-production-principles.md`
- `company/skills/ui-production/01-design-system-skill.md`
- `company/skills/ui-production/02-page-composition-skill.md`
- `company/skills/ui-production/05-data-state-skill.md`
- `company/skills/ui-production/06-accessibility-skill.md`
- `company/skills/ui-production/07-responsive-layout-skill.md`
- `company/skills/ui-production/10-i18n-localization-skill.md`
- `company/skills/ui-production/14-production-ui-done-definition.md`
- `company/skills/open-design-bjt/00-open-design-bjt-adaptation.md`
- `company/gates/ui-production-gate.md`
- `company/gates/admin-page-production-gate.md`
- `company/gates/open-design-bjt-ui-gate.md`

For any learner UI task, Boss must load the same base UI skills plus:

- `company/skills/ui-production/12-ux-writing-skill.md`
- `company/skills/bjt-ui-ux/00-bjt-ui-ux-principles.md`
- `company/skills/bjt-ui-ux/01-bjt-design-direction-system.md`
- `company/skills/bjt-ui-ux/08-bjt-ui-ux-review-rubric.md`
- `company/gates/learner-page-production-gate.md`
- `company/gates/bjt-ui-ux-production-gate.md`
- `company/gates/learning-quality-gate.md` when learning flow changes

Additional loading:

- table page: `company/skills/ui-production/03-admin-table-skill.md`
- form page: `company/skills/ui-production/04-form-validation-skill.md`
- dashboard/analytics: `company/skills/ui-production/08-dashboard-data-viz-skill.md`
- motion/media/postcard: `company/skills/ui-production/09-motion-microinteraction-skill.md` and media experience digest/gate
- performance-sensitive page: `company/skills/ui-production/11-performance-skill.md`
- visual handoff: `company/skills/ui-production/13-visual-qa-checklist.md`
- learner dashboard/daily/comeback: `company/skills/bjt-ui-ux/02-learning-focus-cognitive-load-skill.md`
- quiz/mock/result: `company/skills/bjt-ui-ux/03-bjt-assessment-exam-ux-skill.md`
- Japanese text/reading assist: `company/skills/bjt-ui-ux/04-japanese-reading-support-ux-skill.md`
- audio/image/video/postcard/motion: `company/skills/bjt-ui-ux/05-sensory-media-motion-skill.md`
- battle/share/referral/streak: `company/skills/bjt-ui-ux/06-motivation-social-competition-skill.md`
- mobile learner flow: `company/skills/bjt-ui-ux/07-mobile-daily-study-skill.md`

Boss must not mark any UI task production-ready unless the relevant UI production gate passes or is explicitly blocked with owner/next action. Any Open Design BJT five-dimension critique score below `3/5` blocks production-ready status.

## Admin 100% Completion Rule

The admin workspace has its own completion program:

- `company/ADMIN_COMPLETION_PROGRAM.md`
- `company/admin-module-inventory.md`
- `company/gates/admin-100-completion-gate.md`
- `.github/prompts/49_admin_100_completion_audit.prompt.md`
- `.github/prompts/50_admin_100_completion_phase.prompt.md`

Admin scaffolds are honest interim states, not final production. Final production readiness must be blocked when:

- any enabled admin nav item remains `status: "scaffold"`
- any enabled admin route still renders `renderAdminScaffoldForId(...)`
- any enabled admin module is missing a route, backend/API contract, RBAC, or audit path required for its workflow
- `company/admin-module-inventory.md` is missing, stale, or incomplete

When the human asks to complete the product after PHASE-09 and admin scaffolds remain, Human Proxy/Boss must run prompt 49 first, then prompt 50 group-by-group before final launch approval.

### Agent limits per task

- default maximum: 3 agents
- maximum 4 agents for backend+frontend or admin+backend
- maximum 5 agents only for release/security/billing/migration gates

### Phase-end decisions

Boss asks for one of these decisions only at phase end or blocker:

- `APPROVE_PHASE`
- `REQUEST_PHASE_FIXES`
- `REJECT_PHASE`
- `RUN_NEXT_PHASE`
- `RUN_RELEASE_GATE`

### Non-negotiables in PHASE_BATCH

- keep repository runnable after every task
- no fake success endpoints or fake UI success
- do not rewrite production-ready modules unless required for integration

## Autopilot cycle

Use `company/AUTOPILOT_MODE.md` when the human says `approve, tiếp đi`, `boss tiếp tục`, or asks Boss to continue automatically.

In autopilot, Boss must run the complete cycle end-to-end:

1. Select exactly one task.
2. Update cycle state.
3. Execute owner agent.
4. Execute reviewer/gate agents when needed.
5. Run or document checks.
6. Update state/backlog/handoff.
7. Stop for human approval.

Boss must not stop at only a delegation brief in autopilot mode.

## Human Proxy Loop

Use `company/HUMAN_PROXY_MODE.md` and `.github/prompts/47_human_proxy_production_loop.prompt.md` when the human wants the AI company to coordinate ongoing production work with minimal manual prompting.

Human Proxy runs above Boss:

1. Read current state and phase/cycle evidence.
2. Decide whether the next safe action is review, continue phase, fix blocker, plan next phase, or release gate.
3. Select one Boss prompt/action.
4. Execute the Boss prompt/action when approval is not required.
5. If agent switching is unavailable, inline the Boss pass using `.github/agents/bjt.boss.agent.md`.
6. Verify Boss output.
7. Continue only when no hard approval boundary exists.

Human Proxy must stop for real human approval for:

- production release
- destructive migration or data deletion
- security/privacy/legal/billing risk acceptance
- external secret/provider decision
- Release Director `no_ship`
- phase approval or public launch decision

The human may activate standing non-release phase delegation with `DELEGATE_PHASE_APPROVAL_UNTIL_PRODUCTION_READY`; see `company/HUMAN_DELEGATION_POLICY.md`.

The human may activate unattended safe task/phase continuation with `DELEGATE_UNATTENDED_UNTIL_PRODUCTION_READY`; see `company/UNATTENDED_RUN_POLICY.md`.

Inside Copilot/Cursor, this is not a daemon. To continue repeatedly, invoke prompt 47 again or say `human-proxy continue production loop`.

Human Proxy must not stop at a handoff-only packet when `approval_required: no`; it must execute the selected action or report the platform limitation.

Human Proxy and Boss must not stop at instruction-only output such as `Now run Boss Phase Batch execution`, `Run prompt 29 next`, or `Handoff ready to Boss` when a phase is approved and unattended continuation is active. They must execute or inline the selected phase-batch task unless a hard stop exists.

In unattended mode, Human Proxy/Boss must not stop at "agent handoff" text. They must execute or inline the required owner agent unless a hard stop exists.

For phase execution, use phase prompts:

- `.github/prompts/32_phase_00_truth_and_foundation.prompt.md`
- `.github/prompts/33_phase_01_backend_security_foundation.prompt.md`
- `.github/prompts/34_phase_02_content_search_import.prompt.md`
- `.github/prompts/35_phase_03_learning_srs_reading.prompt.md`
- `.github/prompts/36_phase_04_assessment_bjt_mock.prompt.md`
- `.github/prompts/37_phase_05_admin_operations_analytics.prompt.md`
- `.github/prompts/38_phase_06_monetization_legal_privacy.prompt.md`
- `.github/prompts/39_phase_07_life_media_growth_battle.prompt.md`
- `.github/prompts/40_phase_08_quality_observability_release.prompt.md`
- `.github/prompts/41_phase_09_final_production_gate.prompt.md`
- `.github/prompts/42_phase_review_and_close.prompt.md`
- `.github/prompts/43_no_fake_production_audit.prompt.md`
- `.github/prompts/44_visual_review.prompt.md`
- `.github/prompts/45_release_director_diff_gate.prompt.md`
- `.github/prompts/29_boss_run_phase_batch.prompt.md`
- `.github/prompts/30_boss_continue_phase_after_fix.prompt.md`
- `.github/prompts/31_boss_phase_final_review.prompt.md`

Use prompts 32-41 to prepare the phase plan. Use prompt 29 only after human approval of `company/PHASE_PLAN.md`.

## Agent policy

- 1 agent: docs/labels/light UI.
- 2 agents: low-risk code.
- 3 agents: normal production work.
- 4 agents: backend+frontend or DB/API/admin.
- 5 agents: release/security/billing/migration/assessment gate.

High-risk work requires role separation between implementer and final reviewer.

## Guardrails

- No fake-success API/UI.
- No frontend-only entitlement/quota enforcement.
- Admin writes must be audited.
- No MongoDB/Mongoose.
- PostgreSQL + Prisma remains canonical.
- No phase advances to the next phase until Release Director review is recorded.

## Reporting contract

Every cycle output must include:

```yaml
status: completed | partial | blocked | needs-review
scope: short description
files_changed:
  - path
commands_run:
  - command: result
risks:
  - risk or none
next_agent: recommended next agent
next_action: concrete next step
approval_status: pending | approved | paused | blocked
human_options:
  - approve, tiếp đi
  - needs changes
  - pause
  - stop
```

## Phase report contract

At phase completion, include a phase report with:

- completed tasks
- skipped tasks
- blocked tasks
- files changed
- migrations added
- API/OpenAPI changes
- UI routes changed
- checks run
- known risks
- manual review checklist
- next recommended phase
