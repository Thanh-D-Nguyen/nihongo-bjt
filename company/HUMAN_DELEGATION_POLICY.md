# Human Delegation Policy

## Purpose

Define what the human owner may pre-authorize `bjt-human-proxy` to approve while driving the project toward production readiness.

## Default

Without explicit delegation, Human Proxy must stop for:

- `APPROVE_PHASE`
- `RUN_NEXT_PHASE`
- `RUN_RELEASE_GATE`
- production release
- destructive migration
- security/privacy/legal/billing risk acceptance
- external provider/secret decision

## Standing Delegation

The human may issue a standing delegation phrase:

`DELEGATE_PHASE_APPROVAL_UNTIL_PRODUCTION_READY`

For deeper unattended execution, use:

`DELEGATE_UNATTENDED_UNTIL_PRODUCTION_READY`

See `company/UNATTENDED_RUN_POLICY.md`.

When active, Human Proxy may approve and continue through non-release phase boundaries only if all conditions are true:

- Release Director decision is `ship` or `ship_with_risks`.
- No P0/P1 blocker remains.
- No destructive migration or data deletion risk exists.
- No unresolved security/privacy/legal/billing blocker exists.
- No external provider/secret decision is needed.
- All remaining risks are explicitly non-blocking, accepted, and have owner/next action.
- Required tests/build/OpenAPI/migration/no-fake/rollback gates have evidence.
- Current phase docs are synchronized.

## Still Requires Real Human Approval

Even with standing delegation, Human Proxy must stop for:

- final production launch approval
- public release announcement
- payment provider live-mode rollout
- destructive migration or irreversible data operation
- accepting security/privacy/legal/billing risk
- changing real secrets or production provider configuration
- Release Director `no_ship`
- any P0/P1 blocker
- ambiguous spec conflict

## Allowed Auto Decisions

With standing delegation active and all conditions passing, Human Proxy may choose:

- `APPROVE_PHASE`
- `RUN_NEXT_PHASE`
- next phase planning prompt
- next approved phase execution prompt

With unattended delegation active, Human Proxy may also continue safe task checkpoints inside a phase without asking the human after every task.

Human Proxy must record the delegated decision in:

- `company/CURRENT_PHASE.md`
- `company/PHASE_HANDOFF.md`
- `company/PROJECT_STATE.md`
- `company/project-state.md`
- `company/DECISION_LOG.md`

## Output

```yaml
delegated_approval:
  active: yes | no
  decision: APPROVE_PHASE | RUN_NEXT_PHASE | none
  allowed_by_policy: yes | no
  hard_stop_checked: yes | no
  reason: short reason
```
