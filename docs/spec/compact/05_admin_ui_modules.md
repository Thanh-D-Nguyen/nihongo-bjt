# Compact Spec 05: Admin UI Modules

## Canonical references

Full spec sections: 14, 21.10 admin, 26.10, 27.11, 28.12, 29.11.

## Production rules

- No fake production data.
- Route shells are allowed only when clearly marked and wired to real contracts/feature flags.
- User-facing text must use i18n keys.
- Navigation and actions must be RBAC-aware, with backend enforcement still required.
- Admin writes need confirmation patterns appropriate to risk and must hit audited backend APIs.
- Every list/detail page needs loading, error, empty, and permission-denied states.

## Navigation IA

Expected admin areas:
- Dashboard
- Users/support/user360
- Content CMS
- Preset decks
- Media library and provenance
- i18n management
- Quiz/BJT
- Battle
- Import center
- Enrichment queue
- Audit/IAM
- Analytics
- Monetization: plans, entitlements, quotas, subscriptions, usage, ads, billing events
- Auth/social providers
- Sharing/referrals/postcards
- Reading assist quality
- Learning paths
- Legal/consent/privacy
- Operations/feature flags where applicable

## Dashboard and analytics

- Charts must use real events/rollups, not hard-coded fake arrays.
- Show freshness/degraded states when data is delayed or unavailable.
- Respect analytics RBAC and privacy masking.
- Exports require backend permission and audit.

## Module status rules

For incomplete modules:
- clearly show not configured, unavailable, or feature-flagged status
- link to real setup/action path when available
- do not present fake metrics or fake success actions

## Admin visual requirements

- Professional SaaS admin style: dense, scannable, restrained.
- Avoid marketing hero layouts inside admin.
- Use consistent tables, filters, segmented controls, menus, icons, and status badges.
- Keep responsive layouts functional for tablet/laptop admin usage.

## Required related reads

- RBAC/audit: `compact/04_admin_rbac.md`
- Backend endpoints: `compact/03_backend_api_registry.md`
- Monetization admin: `compact/08_monetization.md`
- Privacy/legal admin: `compact/07_security_privacy.md`

## Page checklist

Each production admin page should include:
- clear title and concise subtitle
- primary action when permitted
- filters/search/sort where useful
- table or list with stable columns
- detail or edit workflow when required
- loading state
- empty state
- error state
- degraded provider state
- permission-denied state
- audit-aware mutation path

## Form checklist

Admin forms should:
- use schema/DTO-aligned validation
- show field-level errors
- prevent duplicate submits
- confirm destructive or high-risk changes
- preserve user input on recoverable errors
- use i18n keys
- avoid exposing secrets after save

## Data visualization checklist

Admin analytics must show:
- data source
- freshness or last updated time
- empty/degraded state
- filters used
- privacy masking where required
- export permission boundary

Do not create charts before the event/rollup source exists.

## Implementation order

1. Confirm backend contract and permission.
2. Add route shell only if feature flag/status is honest.
3. Wire real list/detail/read APIs.
4. Add mutation workflow with audit-backed endpoint.
5. Add tests or document test gap.
6. Update admin navigation docs if navigation changes.
