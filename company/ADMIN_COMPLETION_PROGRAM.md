# Admin 100% Completion Program

## Purpose

Finish the admin workspace as a production operations console, not a collection of honest scaffolds.

Current scaffold pages are allowed by the no-fake rule because they clearly say incomplete. They are not acceptable for final production readiness.

Also not acceptable for the human's admin production-ready goal: pages that are technically "implemented" but still temporary-looking, duplicated from another route, planned-notice-only, missing the expected management workflow, or read-only where the domain requires admin operations.

## Current Snapshot

As of the latest admin production-honesty pass on 2026-04-30:

- Default-visible nav has been reduced to the honest production cutline.
- Hidden/default-off routes are not considered production-ready; under the current full-admin directive they remain blockers until implemented.
- `company/ADMIN_PRODUCTION_ORCHESTRATION.md` defines the admin-first loop for turning incomplete modules into production slices.
- `company/admin-module-inventory.md` remains the detailed source for route-by-route classification.

Refresh commands:

```bash
rg -n 'status: "scaffold"' apps/admin/lib/admin-nav-data.ts
rg -l 'renderAdminScaffoldForId' apps/admin/app | sort
find apps/admin/app/[locale] -name page.tsx | sort
pnpm exec tsx -e "import { ADMIN_NAV_DATA } from './apps/admin/lib/admin-nav-data.ts'; import { buildResolvedAdminNav, getShellNavLabel } from './apps/admin/lib/resolve-admin-nav.ts'; const labels={navGroups:{},navItems:{}}; const nav=buildResolvedAdminNav(ADMIN_NAV_DATA,(k)=>getShellNavLabel(labels,k),'vi',null,{}); console.log(nav.flatMap(g=>g.items).length);"
```

## Production Definition

An admin module is production-ready only when all enabled nav routes meet these checks:

- real route/page exists and is reachable
- page is connected to a real API contract or explicit provider abstraction
- persistent domain data uses PostgreSQL through Prisma or approved raw SQL
- admin reads and writes enforce backend RBAC
- admin writes create audit evidence where required
- no fake production data, fake charts, or fake success states
- loading, empty, error, degraded, permission-denied, and feature-disabled states exist
- user-facing text uses i18n keys
- route passes `company/gates/admin-page-production-gate.md`
- route passes `company/gates/open-design-bjt-ui-gate.md`
- module group passes `company/gates/admin-100-completion-gate.md`
- browser/visual review evidence exists for user-visible layout changes
- route has a distinct purpose/workflow and is not just a copied generic console
- route-specific CRUD/review/moderation operations exist when required by the domain
- planned-notice/info-only pages are implemented or explicitly recorded as blockers for the current full-admin directive

## Scaffold Rule

Allowed before final release:

- route shell that clearly says incomplete
- typed contract or provider stub behind feature flag
- explicit owner and backlog item

Blocked for final production:

- enabled admin nav item still marked `status: "scaffold"`
- enabled route still rendering `renderAdminScaffoldForId(...)`
- page that looks complete but uses fake/local production data
- admin write path without backend RBAC and audit
- visible route duplicated from another route with no route-specific initial state/workflow
- visible planned-notice/static stub route
- route marked implemented but missing product-depth or expected admin operations

## Completion Order

Use this order unless dependencies force a change:

1. System, Operations, IAM
2. Content, Import, i18n, Media
3. Assessment, Learning, Reading Assist
4. Users, Support, Privacy, Legal
5. Monetization, Ads, Billing
6. Analytics, Growth, Battle

## Agent Policy

Default agents per admin module group:

- owner: `bjt-admin-ui`
- backend owner when API is missing: `bjt-backend`
- reviewer: `bjt-qa`
- add `bjt-security` for RBAC, audit, privacy, billing, upload, or external fetch
- add `bjt-release-director` for group completion gate

Do not use more than 4 agents for one admin group unless security, billing, migration, or final release gate is involved.

## Workflow

1. Run `.github/prompts/49_admin_100_completion_audit.prompt.md`.
2. Update `company/admin-module-inventory.md` with every admin nav item.
3. Pick one group from the inventory.
4. Implement backend/API gaps before UI completion.
5. Replace scaffold route with production page.
6. Remove or update nav `status: "scaffold"` only after the gate passes.
7. Run Open Design BJT five-dimension critique and fix any score below `3/5`.
8. Run targeted tests, typecheck, and visual/browser review when applicable.
9. Update inventory, phase report, risk log, and project state.
10. Continue until enabled scaffold count is zero.

## Release Rule

Final production readiness cannot be `ship` while any enabled admin nav item remains scaffolded or missing a production route.

When the human explicitly requests "admin production ready", final admin readiness also cannot be claimed while spec-required admin modules are merely hidden/default-off. For the current full-admin directive, those modules must be implemented or kept as blockers until the human gives a later explicit scope-change instruction.
