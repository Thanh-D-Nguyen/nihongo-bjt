# 49 — Admin 100% Completion Audit

<task>
Act as `bjt-boss` with `bjt-admin-ui`, `bjt-backend`, `bjt-qa`, and `bjt-release-director` review. Audit the full admin workspace and produce the admin module inventory.
</task>

<required-reading>
1. `company/ADMIN_COMPLETION_PROGRAM.md`
2. `company/admin-module-inventory.md`
3. `company/gates/admin-100-completion-gate.md`
4. `company/gates/admin-page-production-gate.md`
5. `docs/admin-navigation.md`
6. `docs/spec/digests/admin_ui_digest.md`
7. `docs/spec/compact/04_admin_rbac.md`
8. `docs/spec/compact/05_admin_ui_modules.md`
9. `apps/admin/lib/admin-nav-data.ts`
10. `apps/admin/lib/admin-scaffold-spec.ts`
11. `apps/admin/lib/render-admin-scaffold.tsx`
</required-reading>

<instructions>
Do not modify product source code in this audit.

1. Enumerate every admin nav item from `apps/admin/lib/admin-nav-data.ts`.
2. Enumerate every admin route under `apps/admin/app/[locale]`.
3. Find every route that renders `renderAdminScaffoldForId(...)`.
4. Classify each nav item as `production_ready`, `mvp_basic_needs_polish`, `temporary_ui`, `duplicate_route`, `planned_notice`, `missing_workflow`, `read_only_when_management_required`, `connected_but_incomplete`, `scaffold`, `missing_route`, `backend_blocked`, `feature_disabled`, or `needs_review`.
5. For each item, record backend/API, RBAC, audit, route-specific purpose, CRUD/review/moderation workflow coverage, UI gate, Open Design BJT five-dimension critique, browser/visual evidence, owner, and next action.
6. Update `company/admin-module-inventory.md` with a complete table.
7. Update phase/project state with the admin completion gap.
8. Return an explicit Admin 100 gate result.
9. Treat human-reported issues as evidence. If the human reports that Daily Hub, Learning/Review, Assessment, Battle, Users/User 360, Growth, IAM, or any other admin area is still temporary or shallow, classify those routes as `needs_product_depth` or a stricter blocker until fixed.
10. Audit old/untouched screens explicitly. For every visible admin route, record whether the UI was recently implemented, intentionally reused with evidence, or still old/needs redesign. A route with no current browser/source evidence must be `needs_visual_product_depth_audit`, not `production_ready`.
</instructions>

<required-commands>
```bash
rg -n 'status: "scaffold"' apps/admin/lib/admin-nav-data.ts
rg -l 'renderAdminScaffoldForId' apps/admin/app | sort
find apps/admin/app/[locale] -name page.tsx | sort
pnpm -w exec turbo run typecheck
```
</required-commands>

<definition-of-done>
- `company/admin-module-inventory.md` has every enabled admin nav item.
- Current scaffold and missing-route counts are recorded.
- Admin 100 gate returns `block` if any enabled scaffold, duplicate route, planned-notice page, missing workflow, connected-but-incomplete route, or unresolved human-reported product-depth blocker remains.
- Admin 100 gate returns `block` if any visible route lacks current browser/source evidence or is marked old/untouched without explicit production-ready acceptance.
- Next execution group is recommended.
</definition-of-done>
