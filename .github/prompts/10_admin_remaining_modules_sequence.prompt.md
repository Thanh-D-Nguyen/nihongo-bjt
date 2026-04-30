# 10 — Admin Remaining Modules Sequence

<context-hint>
Use to complete admin modules one by one after overview and core content pages are OK.
</context-hint>

<task>
Act as Boss + Admin UI Agent. Create a sequence to complete all remaining admin modules production-style.
</task>

<instructions>
1. Read `docs/spec/index.md`, `docs/spec/digests/admin_ui_digest.md`, `docs/spec/compact/05_admin_ui_modules.md`, and `docs/spec/compact/04_admin_rbac.md`.
2. Read `company/ADMIN_PRODUCTION_ORCHESTRATION.md`, `company/admin-module-inventory.md`, and `apps/api/src/admin/admin-openapi.schema.ts`.
3. Assume these pages are acceptable unless repo says otherwise:
   - Dictionary / Từ vựng
   - Kanji
   - Grammar / Ngữ pháp
   - Examples / Câu ví dụ
4. Audit remaining admin routes and admin API coverage.
5. Create or update `docs/ADMIN_REMAINING_MODULES_PLAN.md`.
6. For each module define:
   - current status
   - backend dependency
   - permissions
   - feature flags
   - production UI requirements
   - route shell vs full implementation
   - acceptance criteria
7. Do not implement all at once.
8. Pick the next one module from `company/ADMIN_PRODUCTION_ORCHESTRATION.md` priority queue and delegate it.
9. Hidden/default-off modules still count as admin backlog. Under the current full-admin directive, do not treat deferral as completion unless the human later gives a new explicit scope-change instruction.
</instructions>
