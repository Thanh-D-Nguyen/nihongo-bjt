# Admin Page Production Gate

## Purpose

Admin pages must be operational, permission-aware, auditable, and scannable.

## Required Checks

- Loads base UI production skills.
- Uses `company/skills/ui-production/03-admin-table-skill.md` for tables.
- Uses `company/skills/ui-production/04-form-validation-skill.md` for forms.
- Uses `company/skills/ui-production/08-dashboard-data-viz-skill.md` for dashboards/analytics.
- Applies `company/gates/ui-production-gate.md`.
- Applies `company/gates/open-design-bjt-ui-gate.md`.
- Actions are permission-aware.
- Admin writes have backend RBAC and audit path.
- Dangerous actions require confirmation.
- Sensitive changes request audit reason when required.
- No raw IDs as primary labels unless the ID is the object.
- No internal event keys as user-facing copy.
- No fake production metrics.
- Open Design BJT five-dimension critique has no score below `3/5`.

## Blockers

- UI-only RBAC for admin write.
- Admin mutation without audit logging where required.
- Page depends on fake local production data.
- Destructive action without confirmation.
- Missing loading/error/empty state for core workflow.
- Open Design BJT P0 gate fails.

## Output

```yaml
admin_page_gate:
  status: pass | pass_with_risks | block
  page: route
  permission_behavior: pass | block
  audit_behavior: pass | not_applicable | block
  data_states: pass | risk | block
  visual_qa: pass | risk | block
```
