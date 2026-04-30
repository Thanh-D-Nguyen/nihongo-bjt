# Rollback Safety Gate

## Purpose

Confirm risky phase changes can be mitigated safely.

## Checklist

- Feature flag or deny-by-default fallback exists for risky behavior.
- Migrations are forward-fixable or explicitly reviewed.
- Generated files can be regenerated from source.
- External providers are behind interfaces.
- Admin changes can be disabled without data loss.
- Rollback level is identified from `company/ROLLBACK_PLAYBOOK.md`.
- Human approval requirement is clear.

## Blockers

- Data-destructive migration without approval.
- Security/billing/auth rollback would expose users.
- No way to disable risky route/provider.
- Rollback would require reverting unrelated user changes.

