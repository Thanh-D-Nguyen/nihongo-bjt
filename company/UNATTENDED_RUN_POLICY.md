# Unattended Run Policy

## Purpose

Allow `bjt-human-proxy` to keep the AI company moving through safe task and phase checkpoints when the human cannot approve every step in real time.

## Activation Phrase

The human may activate unattended mode with:

`DELEGATE_UNATTENDED_UNTIL_PRODUCTION_READY`

This includes `DELEGATE_PHASE_APPROVAL_UNTIL_PRODUCTION_READY`.

## What Human Proxy May Auto-Approve

When active, Human Proxy may auto-approve and continue:

- owner-agent handoffs for the next safe task
- completed task checkpoints inside an approved phase
- `REQUEST_PHASE_FIXES` follow-up when fixes are scoped and non-destructive
- `APPROVE_PHASE` for non-release phases with green Release Director evidence
- `RUN_NEXT_PHASE` planning for the next roadmap phase
- next phase planning prompt from 32-41
- next phase execution only when the phase plan is approved by policy and does not cross hard-stop boundaries
- admin closeout verification after all admin routes are wired and product-depth blockers are cleared, including browser QA and Release Director admin sign-off/diff review, as long as it does not request final public launch/go-live

## No Manual Checkpoint Question Rule

When unattended mode is active and required conditions pass, Human Proxy must not ask:

- "Continue or hold?"
- "Approve next task?"
- "Manual checkpoint?"
- "Should I proceed?"

It must choose the next safe task/prompt itself and continue until a hard stop is reached.

If a state file says `approval_required: no`, that is an execution instruction, not a reason to ask the human.

## No Agent Handoff Stop Rule

When unattended mode is active and required conditions pass, Human Proxy must not stop only because the next task needs a specialist owner such as:

- `bjt-learner-ui`
- `bjt-admin-ui`
- `bjt-backend`
- `bjt-qa`
- `bjt-browser-qa`

It must choose the required owner agent and execute/inline the owner pass, or report a concrete platform limitation with `boss_action_executed: no`.

Forbidden unless a hard stop exists:

- "Stopping for agent handoff"
- "Handoff ready to Boss"
- "Requires bjt-learner-ui owner"
- "Awaiting owner selection"
- "Now run Boss Phase Batch execution"
- "Run prompt 29 next"

## Required Conditions

All must be true:

- Release Director is `ship` or `ship_with_risks` when a release/phase gate is involved.
- No P0/P1 blocker remains.
- Tests/build/typecheck/OpenAPI evidence exists or an accepted non-blocking gap is documented.
- No destructive migration or irreversible data operation exists.
- No unresolved security/privacy/legal/billing blocker exists.
- No external live provider/secret decision is required.
- No `company/DO_NOT_TOUCH.md` violation remains unresolved.
- Residual risks are accepted non-blocking with owner and next action.
- State files are synchronized enough for the next action.
- Browser Phase Review is scheduled or executed for phase close when UI changed. If it is the only remaining admin closeout blocker, Human Proxy must execute `bjt-browser-qa` / prompt 48 instead of stopping.
- If browser launch fails, bounded browser review logs `blocked_environment` and the production loop continues to Release Director.
- For admin or learner UI work, Open Design BJT UI gate is scheduled or passed, and any five-dimension critique score below `3/5` is treated as a blocker.
- For final production readiness, Admin 100 gate is current and not blocked.

## Still Requires Real Human

Human Proxy must stop for:

- final production launch / go-live
- production payment/live provider activation
- destructive migration or data deletion
- accepting security/privacy/legal/billing risk
- changing production secrets
- Release Director `no_ship`
- Admin 100 gate blocked by unresolved product/security/data blockers during final production readiness. If the gate is blocked only because browser visual evidence is pending, run browser QA first.
- P0/P1 blocker
- unclear spec conflict
- rollback that may affect unrelated user changes

## Not Human Stops

When unattended mode is active, these are continuation checkpoints, not human approval boundaries:

- all admin routes are production-wired
- browser QA needs to run for changed admin routes
- browser visual evidence needs to run across all 81 admin routes
- Release Director admin sign-off/diff gate needs to run before final launch approval
- admin_100_completion_gate status change requires human verification
- human review of admin product-depth resolution before final production-ready
- "all product-depth blockers resolved" status pending human verification
- "pass_with_risks" gate result pending human review
- single slice PASS without continuing to next incomplete slice

These are not continuation-to-closeout signals when residual admin product-depth risks remain. Planned-notice pages, Admin Shell/sidebar UX blockers, missing dedicated APIs, and battle/growth/learning/content/IAM depth gaps require continuing implementation first.

Only the final production launch/go-live decision requires the real human after those checks.

If a run says "source implementation loop is done" and "only browser visual evidence remains", the next unattended action is browser QA, not `stopped_for_approval`.

## Feature-Flag Off Is Not Resolution

Feature-flagging an admin route off (`ADMIN_FEATURE_FLAG_DEFAULTS_OFF`) is not a resolution. It does not satisfy a product-depth blocker for the current full 100% admin functionality directive.

A blocker may be marked `resolved` only when:
- real backend API + admin UI workflow + audit/RBAC/tests exist; OR
- the route was already wired and browser visual evidence confirms production depth.

Only a later explicit human instruction can change the target from full implementation to a scoped exclusion. Until then, feature-flagged or planned-notice admin modules remain blockers.

If the chosen action is feature-flagging only, record it as `blocked_requires_real_implementation` and keep the gate `block`. Continue to the next slice.

## 100% Admin Completion Loop

When the human asks for admin 100% production-ready, the unattended loop must not stop until:
1. Every backlog item has `status: resolved` AND browser visual evidence; OR
2. A genuine hard stop triggers; OR
3. The real human writes a new explicit stop or scope-change instruction after this directive.

Single-slice PASS, typecheck PASS, scaffold-count PASS, and `pass_with_risks` are NOT stop conditions. They are continuation checkpoints.

## Output

```yaml
unattended_run:
  active: yes | no
  auto_decision: task_continue | approve_phase | run_next_phase | request_fixes | none
  allowed_by_policy: yes | no
  hard_stops_checked: yes | no
  asked_manual_checkpoint: no
  stopped_for_agent_handoff: no
  next_action: prompt or task
```
