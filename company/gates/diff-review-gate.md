# Diff Review Gate

## Purpose

Ensure the reviewed diff matches the task scope and does not hide unrelated risk.

## Checklist

- Changed files match current task/phase report.
- No protected module from `company/DO_NOT_TOUCH.md` is rewritten without reason.
- No broad formatting churn in unrelated files.
- Generated files match source changes and generation command.
- API registry/OpenAPI changes match implementation.
- Migrations are intentional and data-safe.
- Tests map to changed behavior.
- Residual risks have owner and next action.

## Blockers

- Unknown changed file with production impact.
- Registry/OpenAPI mismatch.
- Migration risk without rollback/forward-fix plan.
- Security/RBAC change without specialist review.
- Diff too large for current phase budget.

