# Compact Spec 04: Admin RBAC and Audit

## Canonical references

Full spec sections: 14.1, 14.10.4, 17.7, 26.10, 26.11.

## RBAC principles

- Admin permissions are enforced server-side.
- Frontend RBAC is only presentation gating.
- Do not scatter hard-coded role checks across UI/business logic.
- Use centralized roles/permissions/guards/policies where the repo supports them.
- Support least privilege for support, content, analyst, finance, security, and super-admin style responsibilities.

## Admin writes

Every admin mutation must:
- require authenticated admin identity
- check backend permission
- validate DTO/input
- persist audit log with actor, action, target, before/after or diff where safe, request metadata, and outcome
- avoid logging secrets or sensitive private content unnecessarily

## Privacy-aware support

Support/user360 views must:
- minimize exposed private learning data
- gate sensitive fields behind explicit permission
- log support access where required
- never expose private notes, tokens, billing secrets, or raw provider payloads to low-privilege roles

## Analytics RBAC

- Aggregate views can be broader.
- Drill-down/user-level analytics require stronger permission.
- Exports require explicit permission and audit.
- Privacy-sensitive dimensions must be masked or suppressed for roles without access.

## Monetization admin

Plan, entitlement, quota, subscription, billing event, webhook, and ad placement management require finance/ops-level permissions. Billing provider secrets and raw webhook verification material must not be exposed through normal admin UI.

## Permission-sensitive modules

Read relevant compact files when changing:
- admin UI: `compact/05_admin_ui_modules.md`
- backend APIs: `compact/03_backend_api_registry.md`
- privacy/security: `compact/07_security_privacy.md`
- monetization: `compact/08_monetization.md`

## Suggested permission families

- `admin.dashboard.read`
- `admin.users.read`
- `admin.users.write`
- `admin.support.read_sensitive`
- `admin.content.read`
- `admin.content.write`
- `admin.media.read`
- `admin.media.write`
- `admin.import.run`
- `admin.audit.read`
- `admin.iam.write`
- `admin.analytics.read`
- `admin.analytics.export`
- `admin.monetization.read`
- `admin.monetization.write`
- `admin.legal.write`
- `admin.operations.write`

Use repo-native naming if already established.

## Audit event checklist

Audit records should identify:
- actor user/admin ID
- permission/role context when useful
- action name
- target type and target ID
- before/after summary or safe diff
- request ID/IP/user agent where available
- success/failure outcome
- timestamp

Avoid logging:
- passwords
- session tokens
- raw payment secrets
- private notes beyond what is necessary
- full files or large payloads

## Review checklist

- Can a low-privilege admin call the backend route directly?
- Does UI hide unavailable actions without relying on that as enforcement?
- Does every admin mutation create audit evidence?
- Are sensitive exports permission-gated?
- Are support views privacy-minimized?
- Are role changes themselves audited?
- Are permission changes reviewed before release?
- Are emergency/support permissions time-bounded where supported?
