# Rollback Playbook

## Goal

Keep phase execution reversible without destructive commands or hidden state loss.

## Ground Rules

- Never use destructive rollback commands without explicit human approval.
- Prefer forward fixes over reverting migrations.
- Prefer feature flags or kill switches for risky behavior.
- Capture current state before rollback: task id, changed files, commands, and risk reason.
- Do not revert unrelated user changes.

## Rollback Levels

### Level 0: Docs/Prompt Only

Use when only company docs, prompts, or checklists changed.

- restore previous wording with a focused patch
- update decision log with reason
- no app tests required unless prompt affects generated artifacts

### Level 1: UI Only

Use when routes/components/i18n changed without backend contract changes.

- hide route via navigation/feature flag when possible
- keep i18n keys if harmless
- run relevant typecheck and UI tests
- add visual review note

### Level 2: Backend API Without Migration

Use when controllers/services/DTO/OpenAPI changed.

- disable route through feature flag or RBAC deny path if possible
- keep generated OpenAPI consistent with source
- run focused service/controller tests and OpenAPI generation
- verify clients do not call removed contracts

### Level 3: Migration or Data Shape

Use when Prisma schema, SQL migration, or persistent data shape changed.

- stop phase execution
- do not delete migration files blindly
- assess whether a forward migration/fix is safer
- document data impact and backup assumption
- require Release Director or architect review before continuing

### Level 4: Security/Billing/Auth/RBAC

Use when changes affect trust boundaries.

- stop immediately
- run security/red-team review
- prefer deny-by-default temporary mitigation
- require explicit human approval to ship

## Rollback Report

```yaml
rollback:
  level: 0 | 1 | 2 | 3 | 4
  reason: short reason
  files_affected:
    - path
  mitigation: feature flag | forward fix | focused revert | stop
  commands_required:
    - command
  approval_required: yes | no
```

