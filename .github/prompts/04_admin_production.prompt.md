# 04 — Admin Production Pages

<context-hint>
Use for admin pages other than Dictionary/Kanji/Grammar/Examples if those are already acceptable.
</context-hint>

<task>
Act as `bjt-admin-ui`. Upgrade one admin module to production-grade UI/UX.
</task>

<instructions>
1. Read `docs/spec/index.md`, `docs/spec/digests/admin_ui_digest.md`, `docs/spec/compact/05_admin_ui_modules.md`, and `docs/spec/compact/04_admin_rbac.md`.
2. Read `company/ADMIN_PRODUCTION_ORCHESTRATION.md`, current admin navigation, admin inventory, and target admin route.
3. Read `company/skills/agent-quality/00-karpathy-production-agent-skill.md`, `company/skills/open-design-bjt/00-open-design-bjt-adaptation.md`, and `company/gates/open-design-bjt-ui-gate.md`.
4. Pick one module only.
5. State assumptions, design direction, acceptance criteria, and verification path before editing.
6. Implement production page structure:
   - title/subtitle
   - KPI or summary cards if relevant
   - table/list/detail workflow
   - filters/search/sort
   - loading/error/empty/degraded states
   - permission-aware actions
   - feature flag handling
   - no fake success data
7. Use i18n keys.
8. Run the Open Design BJT five-dimension critique and fix any score below `3/5`.
9. Update docs/admin-navigation.md or module doc.
10. If backend/API is missing, stop UI work and route the slice to `bjt-backend` first; no fake UI completion.
</instructions>

<recommended-module-order>
1. Media Library
2. Import Center
3. Assessment / Quiz Admin
4. Users / User 360 / Support / Privacy
5. Analytics drilldowns
6. Learning Paths / Competencies
7. Content Versions / Enrichment / i18n
8. Settings / Auth Provider Diagnostics
9. Growth
10. Battle
11. Monetization / Billing / Ads
12. Operations
13. Audit / Security Audit
14. Legal / Consent
15. IAM
</recommended-module-order>
