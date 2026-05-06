# 57 — Human Proxy: Admin Learning & Practice Full Product Management

<context-hint>
Use when the human asks Human Proxy to coordinate specialists so the admin area for learning, review, practice, flashcards/SRS, BJT quiz/mock exam, remediation, and reading assist becomes a complete production-grade management surface with real product data.
</context-hint>

<task>
Act as `bjt-human-proxy`.

Coordinate the right specialist agents to turn the admin Learning & Practice domain into a complete product-management console, not a demo CRUD screen. The target is production-grade admin management backed by PostgreSQL/Prisma, real APIs, validated import/seed data, RBAC, audit logs, i18n, tests, and browser/runtime evidence.

Latest human directive:

> Admin cho phần học tập & ôn luyện phải có phần quản lý đầy đủ và chèn các dữ liệu thật chuẩn product. Human Proxy hãy điều phối chuyên gia phù hợp để làm end-to-end.
>
> Bổ sung: dữ liệu thật được insert/import phải có image đầy đủ cho flashcards, Daily Hub, và mọi module cần ảnh. Sửa cả trang login admin/backend và frontend theo ngôn ngữ thiết kế chung mới cập nhật. Dùng local test credentials cho browser QA: admin `localadmin` / `Admin123456!`, frontend learner `testuser` / `testuser`. Không commit secrets hoặc credentials vào file runtime/config.
</task>

<required-reading>
1. `.github/agents/bjt.human-proxy.agent.md`
2. `.github/prompts/47_human_proxy_production_loop.prompt.md`
3. `.github/prompts/50_admin_100_completion_phase.prompt.md`
4. `company/ADMIN_PRODUCTION_ORCHESTRATION.md`
5. `company/ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md`
6. `company/admin-module-inventory.md`
7. `company/gates/admin-100-completion-gate.md`
8. `company/gates/admin-page-production-gate.md`
9. `company/gates/open-design-bjt-ui-gate.md`
10. `company/BJT_ASSESSMENT_FORMAT_STANDARD.md`
11. `docs/spec/index.md`
12. `docs/spec/compact/02_database_prisma.md`
13. `docs/spec/compact/03_backend_api_registry.md`
14. `docs/spec/compact/04_admin_rbac.md`
15. `docs/spec/compact/05_admin_ui_modules.md`
16. `docs/spec/compact/10_testing_acceptance.md`
17. `docs/spec/compact/11_learning_effectiveness_experience.md`
18. `docs/spec/digests/admin_ui_digest.md`
19. `docs/spec/digests/backend_digest.md`
20. `docs/spec/digests/learning_science_digest.md`
21. `docs/spec/digests/assessment_psychometrics_digest.md`
22. `docs/spec/digests/content_quality_digest.md`
23. `docs/spec/digests/localization_japan_vietnam_digest.md`
24. Read and follow all active Cursor rules in `.cursor/rules/*.mdc`.
25. `DESIGN.md`
26. `docs/design/bjt-ui-ux-production-standard.md` when present
27. `company/FRONTEND_PRODUCTION_ORCHESTRATION.md` when frontend login is in scope
28. `company/learner-ui-screen-contract.md` when frontend login is in scope
</required-reading>

<scope>
Admin Learning & Practice includes, at minimum:

- learning paths, units, lessons, lesson items, lesson prerequisites, publication lifecycle
- practice sets, drills, review queues, remediation rules, weak-skill targeting
- flashcard decks, cards, SRS settings, tags, due-card diagnostics, card quality review
- BJT question bank, BJT sections/parts, skills, scenarios, distractors, explanations, timing, scoring metadata
- BJT quiz templates, mock exams, session review, attempts, result analytics, remediation mapping
- reading assist dictionary/terms, furigana, meanings, example sentences, add-to-flashcard settings
- content QA workflow: draft/review/approve/publish/archive, duplicate detection, quality score, localization review
- import center workflow for real seed/import data with staging, validation, preview, approval, and rollback plan
- media/provenance fields for audio/images/examples when content uses media or external sources
- complete real image coverage for flashcards, Daily Hub items, lessons, practice content, reading assist examples, share/postcard surfaces, and any other image-bearing product module
- admin analytics backed by real events/rollups for learning/practice usage and content effectiveness
- admin/backend login and learner frontend login pages updated to the current shared visual language/design system
</scope>

<specialist-routing>
Human Proxy must select and coordinate specialists based on discovered gaps:

- `bjt-backend`: Prisma schema, migrations, DTOs/contracts, admin APIs, service logic, audit logging, tests.
- `bjt-admin-ui`: admin IA, production workflows, tables/forms/detail pages, states, RBAC-aware UI, browser evidence.
- `bjt-learning-science`: SRS/remediation behavior, cognitive load, practice effectiveness, learner wellbeing.
- `bjt-assessment-psychometrics`: BJT section/timing/scoring/question quality, mock exam validity, attempt analytics.
- `bjt-content-quality`: Japanese correctness, business naturalness, level fit, duplicate/content QA criteria.
- `bjt-localization-japan-vietnam`: JA/VI/admin copy quality and i18n key review.
- `bjt-data-import`: real product seed/import pipeline, staging validation, provenance, rollback/retry.
- `bjt-media-experience`: image requirements, visual asset quality, licensing/provenance metadata, and image fallback/degraded states.
- `bjt-visual-experience`: updated shared design language for admin/backend and frontend login surfaces.
- `bjt-learner-ui`: learner frontend login implementation and authenticated learner browser evidence.
- `bjt-security`: RBAC, audit, privacy exposure, destructive/high-risk admin mutations.
- `bjt-qa`: unit/integration/e2e verification, browser/runtime checks, regression risk.
- `bjt-release-director`: admin sign-off after source, runtime, and QA evidence are complete.

Before using old agents or multiple specialists, run the agent-quality preflight from `company/gates/agent-quality-gate.md` or `.github/prompts/53_agent_quality_audit.prompt.md`.
</specialist-routing>

<instructions>
1. Classify current state as `admin_completion_needed`.
2. Do not stop after writing a handoff packet if the next action is scoped and approval is not required. Execute or inline the selected specialist pass.
3. Audit the existing admin Learning & Practice routes, backend APIs, Prisma models, seed/import scripts, i18n files, tests, and browser behavior.
4. Update `company/admin-module-inventory.md` with concrete blockers for Learning & Practice routes before implementation if inventory is stale.
5. Pick the smallest end-to-end slice that improves real production depth. Prefer this order unless current evidence points elsewhere:
   - source/data model and API contract for Learning & Practice management
   - real product seed/import data through staging/validation
   - real product image asset coverage, provenance, and degraded-state handling for image-bearing content
   - admin route workflow replacement for the highest-impact page
   - BJT assessment fidelity and psychometric metadata
   - flashcard/SRS and remediation operations
   - reading assist operations
   - analytics backed by real events/rollups
   - admin/backend login and learner frontend login visual-language update
   - full authenticated browser QA and release sign-off
6. For every admin management route in scope, require actual operator actions, not generic read-only resource tables. Expected actions include create/edit/reorder/duplicate/publish/archive/approve/reject/import/validate/retry/export/detail/history as appropriate.
7. Do not insert fake production content. Acceptable data paths:
   - curated seed/dev data stored through real schema and clearly marked as seed/dev
   - imported public/open licensed data with provenance/license metadata
   - manually authored product-quality content with source/reviewer/status metadata
   - local/mock provider output only behind a provider/import abstraction and not marked as production-approved
8. Every inserted/imported image must have a real source path or provider reference, alt text, license/provenance metadata, dimensions or validation, moderation/review status where relevant, and a fallback/degraded behavior. Do not use blank placeholders, decorative filler, or unsourced scraped images.
9. Flashcards and Daily Hub content must not be considered product-ready unless image-required item types have complete image assets and admin can review/replace/remove those assets.
10. Canonical learning/practice data must live in PostgreSQL via Prisma. Search projections may sync to Meilisearch but must not be canonical.
11. Admin writes must be protected by backend RBAC and must create audit logs with actor, action, target, timestamp, and before/after where useful.
12. All user-facing/admin-facing copy must use i18n keys in supported locales.
13. Timed BJT exam integrity must be preserved: do not expose answer/meaning assistance during active timed exam mode except practice/help or post-answer review.
14. Update admin/backend login and learner frontend login pages to match the current shared visual design language. Login pages must be production UI, not generic auth templates: responsive, accessible, localized, brand-consistent, with error/loading/session-expired states and no hard-coded copy.
15. Use these credentials only for local authenticated browser QA: admin `localadmin` / `Admin123456!`, frontend learner `testuser` / `testuser`. Do not write them into tracked app config, screenshots, logs, or docs beyond this prompt/handoff context.
16. Add validation, error handling, loading, empty, permission-denied, degraded-provider, and conflict states.
17. Add tests for core business logic and API/admin workflow behavior. If a test cannot be added in the current slice, record the exact reason and follow-up.
18. Run relevant verification commands after code changes: typecheck, targeted tests, lint when available, Prisma generate/migration checks when schema changed, and browser/runtime checks for changed admin routes.
19. Update project evidence files: `company/admin-module-inventory.md`, `company/PHASE_TASK_REPORT.md`, `company/PHASE_RISK_LOG.md`, and any relevant handoff/state files used by the current admin production loop.
</instructions>

<acceptance-criteria>
For the selected slice to pass:

- no fake in-memory/localStorage state for persistent learning/practice domain data
- no MongoDB/Mongoose
- PostgreSQL/Prisma schema and APIs cover the workflow being shipped
- admin UI exposes route-specific management workflows, not a generic placeholder
- real seed/import/product data is staged, validated, reviewed, and stored through real schema
- flashcards, Daily Hub, and all image-bearing modules have complete real image assets with source/provenance/license metadata and admin review controls
- content has quality/provenance/review metadata where required
- BJT content respects sections, timing, scoring, skills, scenarios, distractors, explanations, and remediation mapping
- flashcard/SRS behavior is deterministic and tested when touched
- reading assist is reusable and respects BJT exam-mode restrictions
- admin/backend login and learner frontend login match the shared updated design language and pass responsive/authenticated browser checks
- RBAC and audit logs are enforced server-side for admin writes
- i18n keys exist for all visible copy
- tests/typecheck pass or blockers are recorded with exact failure evidence
- authenticated browser/runtime evidence exists for changed admin routes
</acceptance-criteria>

<hard-stops>
Stop for real human approval only when:

- destructive migration or data deletion is required
- external paid/provider secret is required
- security/privacy/legal/billing risk requires acceptance
- Release Director returns `no_ship`
- final public production launch/go-live approval is requested
- repeated targeted fixes cannot restore typecheck/tests and the failure is not safely isolatable
</hard-stops>

<output>
Use the Human Proxy YAML report contract from `.github/agents/bjt.human-proxy.agent.md`.

The report must include:

- selected admin slice
- specialists selected and whether each ran as subagent, inline, planned, or skipped
- files/routes/APIs inspected
- files changed
- data added or imported and its provenance/review status
- image assets added/imported, their source/license/provenance status, and any remaining missing-image blockers
- admin/backend login and frontend login routes reviewed or changed, with credential-based browser QA evidence
- verification commands and results
- inventory/risk/report files updated
- remaining blockers and the next safe action
</output>
