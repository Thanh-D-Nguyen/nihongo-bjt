# 58 — Human Proxy: Full Menu Production Audit To World-Class BJT Product

<context-hint>
Use when the human wants Human Proxy to coordinate specialists overnight after an authenticated browse/source audit of the admin and learner apps.
</context-hint>

<task>
Act as `bjt-human-proxy`.

Use the audit evidence below to coordinate specialist agents through the night. The target bar is not "works locally"; it is a production-grade BJT/Japanese learning web product that could credibly be the best BJT learning platform in the world.

Latest human directive:

> Duyệt qua tất cả menu admin/backend và frontend learner. Note lại thiếu chức năng và phần cần cải thiện để Human Proxy điều phối agent làm xuyên đêm.
>
> Admin: `localadmin` / `Admin123456!` at `http://localhost:3001/vi`
>
> Frontend learner: `testuser` / `testuser` at `http://localhost:3000/vi`

Use credentials only at local runtime for browser QA. Do not write them into app config, env files, screenshots, logs, or production docs.
</task>

<required-reading>
1. `.github/agents/bjt.human-proxy.agent.md`
2. `.github/prompts/47_human_proxy_production_loop.prompt.md`
3. `.github/prompts/57_admin_learning_practice_full_product.prompt.md`
4. `.github/prompts/59_frontend_all_screens_uiux_unattended_contract.prompt.md`
5. `company/ADMIN_PRODUCTION_ORCHESTRATION.md`
6. `company/ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md`
7. `company/admin-module-inventory.md`
8. `company/gates/admin-100-completion-gate.md`
9. `company/gates/admin-page-production-gate.md`
10. `company/gates/open-design-bjt-ui-gate.md`
11. `company/BJT_ASSESSMENT_FORMAT_STANDARD.md`
12. `DESIGN.md`
13. `docs/design/bjt-ui-ux-production-standard.md` when present
14. `company/FRONTEND_PRODUCTION_ORCHESTRATION.md`
15. `company/learner-ui-screen-contract.md`
16. `company/gates/world-class-learner-experience-gate.md`
17. `docs/spec/compact/02_database_prisma.md`
18. `docs/spec/compact/03_backend_api_registry.md`
19. `docs/spec/compact/04_admin_rbac.md`
20. `docs/spec/compact/05_admin_ui_modules.md`
21. `docs/spec/compact/06_learner_ui_modules.md`
22. `docs/spec/compact/10_testing_acceptance.md`
23. `docs/spec/compact/11_learning_effectiveness_experience.md`
24. `docs/spec/digests/admin_ui_digest.md`
25. `docs/spec/digests/learner_ui_digest.md`
26. `docs/spec/digests/learning_science_digest.md`
27. `docs/spec/digests/assessment_psychometrics_digest.md`
28. `docs/spec/digests/content_quality_digest.md`
29. `docs/spec/digests/media_experience_digest.md`
30. Read and follow all active Cursor rules in `.cursor/rules/*.mdc`.
</required-reading>

<audit-evidence>
Authenticated browser login evidence from 2026-05-02:

- Admin login succeeded and landed on `http://localhost:3001/vi`. The dashboard rendered with admin shell, RBAC badge, all sidebar groups, and real account session.
- Learner login succeeded and landed on `http://localhost:3000/vi`. The app rendered the learner shell, user `Test User`, daily focus, flashcard due state, BJT progress, and main nav.
- Representative browser screenshots were captured under `/tmp/nihongo-bjt-menu-audit-2026-05-02-fast/`, including:
  - `admin-dailyHub.png`
  - `admin-decks.png`
  - `admin-flashcardTemplates.png`
  - `admin-generatedCards.png`
  - `admin-learningPaths.png`
  - `admin-questionBank.png`
  - `admin-readingAssist.png`
  - `admin-remediation.png`
- Full Playwright all-route run hit dev-server/browser timeout on heavier admin routes. Treat this as a runtime QA blocker: rerun authenticated browser QA in smaller batches per menu group and record pass/fail per route.
- Source route inventory reviewed from `apps/admin/lib/admin-nav-data.ts`, `apps/admin/app/[locale]`, `apps/web/app/[locale]`, Prisma schema, and seed scripts.
</audit-evidence>

<menu-coverage-source>
Admin menu routes from `apps/admin/lib/admin-nav-data.ts` that must be covered in overnight QA:

- Overview/System: `/`, `/system/health`, `/system/queue-health`, `/system/search-sync`, `/system/release`
- Content: `/content`, `/dictionary`, `/kanji`, `/grammar`, `/media`, `/content/versions`, `/content/enrichment`, `/i18n`, `/announcements`
- Learning: `/daily-hub`, `/decks`, `/flashcards/templates`, `/flashcards/generated`, `/reading-assist`, `/learning/paths`, `/learning/competencies`, `/learning/review`
- Assessment: `/bjt`, `/assessment/quiz-templates`, `/assessment/question-bank`, `/assessment/quiz-sessions`, `/assessment/mock-exams`, `/assessment/remediation`
- Battle: `/battle/configs`, `/battle/bots`, `/battle/matches`, `/battle/leaderboard`, `/battle/abuse`
- Users/Support: `/users`, `/users/360`, `/support/notes`, `/privacy/requests`, `/privacy/data-requests`
- Analytics: `/analytics`, `/analytics/growth`, `/analytics/learning`, `/analytics/content`, `/analytics/search`, `/analytics/bjt`, `/analytics/flashcards`, `/analytics/battle`, `/analytics/system`
- Monetization/Ads: `/monetization`, `/monetization/plans`, `/monetization/entitlements`, `/monetization/quotas`, `/monetization/subscriptions`, `/monetization/billing-events`, `/monetization/refunds`, `/ads`, `/monetization/provider-config`, `/monetization/webhook-dlq`
- Growth: `/growth`, `/growth/social`, `/growth/referrals`, `/growth/postcards`, `/growth/campaigns`
- Operations: `/ops/feature-flags`, `/ops/kill-switches`, `/ops/dead-letters`, `/import`, `/import/manifests`, `/import/failed`, `/ops/notifications`, `/audit`, `/ops/security`, `/settings`
- Legal/IAM: `/legal/documents`, `/legal/terms`, `/legal/consent`, `/legal/cookies`, `/legal/tokushoho`, `/legal/retention`, `/iam`, `/iam/roles`, `/iam/permissions`, `/iam/admins`, `/iam/role-audit`

Learner menu/routes that must be covered:

- `/`, `/login`, `/register`, `/quiz`, `/flashcards`, `/battle`, `/search`, `/analytics`, `/settings`, `/settings/accounts`, `/settings/notifications`, `/settings/privacy`, `/settings/reading`, `/onboarding`, `/daily/[id]`, `/share/[token]`
</menu-coverage-source>

<top-findings>
P0/P1 issues to route first:

1. Admin Learning & Practice image coverage is not production-ready.
   - Browser: Daily Hub list shows 48 published rows but no real thumbnails/images in the list.
   - Browser: Flashcard templates/generated cards and decks show text-only management; no visible image asset coverage.
   - Source: `apps/api/scripts/seed-daily.ts` seeds Daily Hub content without `imageUrl`.
   - Source: `FlashcardVariant` has `CardMediaLink` and `MediaAsset`, but admin flashcard/deck screens do not expose attach/replace/remove/review image workflows.
   - Source: `DailyContentItem.imageUrl` is just a URL string; it lacks media asset FK, alt text, license/provenance, rights review, and dimensions validation.
   - Route to `bjt-media-experience`, `bjt-data-import`, `bjt-backend`, `bjt-admin-ui`, `bjt-content-quality`.

2. Admin Assessment/BJT is not yet world-class BJT management.
   - Browser: `/assessment/question-bank` captured stuck in `Đang tải...`.
   - Browser: `/assessment/remediation` rendered empty state, no seeded remediation rules or trigger evidence.
   - Source: `apps/api/scripts/seed-quiz.ts` creates only a tiny local practice set from canonical content, not a full BJT-format question bank.
   - Required: BJT parts/sections, timing, audio/media where relevant, scenario metadata, distractor rationale, explanation quality, psychometric tags, mock exam blueprint, scoring rubric, review workflow, analytics/remediation linkage.
   - Route to `bjt-assessment-psychometrics`, `bjt-backend`, `bjt-admin-ui`, `bjt-learning-science`, `bjt-qa`.

3. Learning paths are too shallow for production learning operations.
   - Browser: `/learning/paths` shows 5 published paths but no visible lesson/unit/prerequisite tree on list.
   - Source: `LearningPath` schema is flat; no path units, lessons, lesson items, prerequisites, ordering/versioning, path assignment, publication diff, or effectiveness evidence.
   - Required: path builder with units/lessons, prerequisites, target competencies, linked decks/quizzes/daily content, publish/version/audit workflow, learner preview.
   - Route to `bjt-learning-science`, `bjt-backend`, `bjt-admin-ui`, `bjt-content-quality`.

4. Reading Assist admin is underpowered.
   - Browser: `/reading-assist` captured only a loading/report surface.
   - Source: admin client reads `/api/admin/reading-assist/reports?limit=50`; it does not manage dictionary terms, furigana quality, reading exceptions, meaning policy, learner feedback resolution, or flashcard creation rules.
   - Required: reusable reading layer operations, free/basic coverage controls, timed BJT restriction checks, quality review queue, add-to-flashcard mapping.
   - Route to `bjt-learning-science`, `bjt-content-quality`, `bjt-backend`, `bjt-admin-ui`, `bjt-security`.

5. Login pages need redesign to the new shared visual language.
   - Browser/source: admin login and learner login are functional, but still generic centered auth cards. Learner login is simpler than admin and lacks password visibility/caps lock parity.
   - Required: shared design language from `DESIGN.md`, responsive polished auth surface, brand/product signal, localized copy, social provider state, error/session-expired/loading states, accessibility, no hard-coded copy.
   - Route to `bjt-visual-experience`, `bjt-learner-ui`, `bjt-admin-ui`, `bjt-security`, `bjt-qa`.

6. Learner frontend still contains demo/sample/fallback copy that must not be treated as production data.
   - Source: `apps/web/messages/*.json` contains `demoStatsCaption`, `demoStatReviews`, `demoDueCount`, `sampleWidgetBadge`, `sampleWeatherBody`, `modeDifficult: demo`, and local-test placeholders.
   - Source: `apps/web/app/[locale]/_components/daily-hub-client.tsx` has `sampleFeatured`.
   - Required: remove demo-looking states from authenticated production path or clearly limit them to unauthenticated/degraded states; wire to real PostgreSQL-backed data and media.
   - Route to `bjt-learner-ui`, `bjt-backend`, `bjt-data-import`, `bjt-learning-science`.

7. Full menu browser QA is itself blocked by runtime/dev-server instability.
   - Playwright all-route attempts timed out on heavier admin route batches. This must be debugged or split into deterministic browser QA batches.
   - Required: stable authenticated smoke runner per menu group with screenshots, route status, network failures, console errors, login-loop detection, i18n key leak detection, image alt/broken-image checks.
   - Route to `bjt-browser-qa`, `bjt-qa`, `bjt-devops`.

8. Frontend guidance exists, but not every small route has a filled screen contract/review artifact.
   - Existing docs define the standard, but small screens such as login/register/onboarding/settings subroutes/daily detail/share/help/privacy/terms/feedback/error states still need explicit per-screen contracts and browser evidence.
   - Required: run `.github/prompts/59_frontend_all_screens_uiux_unattended_contract.prompt.md`, create `FE-ALL-screen-inventory-and-status.md`, and execute frontend micro-slices without stopping at routine handoffs.
   - Route to `bjt-visual-experience`, `bjt-learner-ui`, `bjt-learning-science`, `bjt-behavioral-psychology`, `bjt-qa`, plus `bjt-backend` where data/API support is missing.
</top-findings>

<additional-gaps-by-area>
Admin all-menu improvement notes:

- Overview/System: dashboard has many zero metrics; require freshness/degraded states and clear data-source labels. Queue/Search/Release pages have TODO-like source signals and need browser confirmation.
- Content: dictionary/kanji/grammar pages appear list-oriented and need route-specific create/edit/review/version/import workflows if content management remains in scope.
- Media: media provenance model exists, but image-bearing learning modules are not consistently linked to media assets.
- Daily Hub: good start for create/edit/publish/archive/widget config, but image is a free URL field and list/detail do not enforce complete image metadata.
- Flashcards: variants can edit text and transition status, but no image/audio/media attach workflow; generated/deck pages lack production card QA workflows for image coverage and source review.
- Learning Review: has force-reintroduce action, but needs learner-safe interventions, leech diagnostics, cohort segmentation, and evidence-backed remediation.
- Battle: feature-flagged routes exist; must confirm actual Socket.IO/bot tuning/fairness/abuse workflows in browser before claiming production readiness.
- Analytics: many drilldown pages are thin wrappers or shared domains; require real event/rollup proof, filters, exports, privacy masking, and zero-data honesty.
- Monetization: overview/ads have stronger implementation, but plan/entitlement/quota/subscription/refund/provider/webhook pages need product-depth browser audit, not just source route existence.
- Growth/Social/Postcards: needs actual template lifecycle, public share privacy review, generated postcard visual quality, referral campaign analytics.
- Operations/Legal/IAM: several pages have source TODO signals or read-only summaries; verify each against management workflow standard.

Learner product improvement notes:

- Home is functional after login but still relies on some fallback/sample state paths; Daily Hub needs real images and stronger "Japan daily life + BJT" editorial quality.
- Quiz/Flashcards need image/media-aware cards, BJT exam integrity, post-answer reading assist, and remediation loops tied to admin rules.
- Battle/Search/Analytics/Settings must be authenticated-browser checked after login; direct HTTP checks returned 500 for several protected frontend routes, so verify SSR/auth boundary and redirect behavior.
- Footer links reference help/privacy/terms/feedback, but matching route files were not found in `apps/web/app/[locale]`; create real pages or remove/route correctly.
- Login/register/onboarding must match the new visual language and should not feel like generic forms.
</additional-gaps-by-area>

<specialist-routing>
Human Proxy should coordinate these agents in this order:

1. `bjt-browser-qa` + `bjt-qa`: create deterministic per-menu authenticated browser audit batches for admin and learner. Record route, screenshot, network errors, console errors, auth loop, missing/broken images, i18n leaks.
2. `bjt-backend` + `bjt-data-import` + `bjt-media-experience`: fix data/image model gaps for Daily Hub, flashcards, learning paths, BJT content, and media provenance.
3. `bjt-admin-ui`: replace shallow/table-only management pages with route-specific workflows per `ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md`.
4. `bjt-assessment-psychometrics`: upgrade BJT question bank, quiz templates, mock exams, sessions, scoring, remediation, analytics.
5. `bjt-learning-science`: review SRS, remediation, learning paths, cognitive load, learner wellbeing, and habit loops.
6. `bjt-content-quality` + `bjt-localization-japan-vietnam`: verify Japanese naturalness, BJT/business context, VI/JA copy quality, examples, duplicate detection.
7. `bjt-visual-experience` + `bjt-learner-ui`: redesign admin/backend login and frontend learner login/register/onboarding; improve learner shell pages to world-class product quality.
8. `bjt-security`: review RBAC/audit for all admin writes, image rights/privacy, auth boundaries, share/analytics privacy.
9. `bjt-release-director`: run admin/learner production gate only after source, browser, data, test, and visual evidence are complete.
</specialist-routing>

<execution-instructions>
1. Classify state as `admin_completion_needed` plus `frontend_track_active`.
2. Do not stop at a handoff. Pick the first concrete slice and execute or inline it if approval is not required.
3. First slice should be browser QA stabilization and route evidence because the human explicitly asked to browse all menus.
4. For frontend learner work, apply `.github/prompts/59_frontend_all_screens_uiux_unattended_contract.prompt.md`: every small route/state needs a screen contract or review artifact, and Human Proxy must continue through micro-slices unless a true hard stop occurs.
5. Split browser QA into menu groups. Do not try one giant Playwright pass if dev server hangs. Persist results per group.
6. For each route, classify:
   - production workflow pass
   - route renders but shallow/table-only
   - route stuck loading
   - route auth/redirect/500/network error
   - route has demo/sample/fake data
   - route lacks required image/media/provenance
   - route lacks RBAC/audit mutation path
   - route fails visual/world-class quality
7. Update `company/admin-module-inventory.md`, `company/PHASE_TASK_REPORT.md`, `company/PHASE_RISK_LOG.md`, and any frontend/browser QA evidence files after each slice.
8. For image-bearing data, do not accept text-only seed rows. Require real media asset or provider-backed source, alt text, license/provenance, review status, dimensions validation, and admin replace/remove controls.
9. For BJT content, do not accept generic quiz data. Require BJT-specific sections, timing, media/scenario metadata, scoring, distractor rationale, explanations, psychometric tags, and remediation mapping.
10. Run relevant verification after code changes: typecheck, targeted tests, Prisma validate/generate when schema changes, and browser QA for changed routes.
</execution-instructions>

<definition-of-done>
This overnight effort is not done until:

- every admin menu route above has authenticated browser evidence
- every learner route above has authenticated or appropriate public browser evidence
- each failed/shallow route has an owner agent, concrete blocker, file/API route, and next action
- Daily Hub and flashcards have complete real image data and admin media review workflows
- BJT assessment admin meets `company/BJT_ASSESSMENT_FORMAT_STANDARD.md`
- login pages match the shared updated design language
- demo/sample/fallback learner data is removed from authenticated production paths or correctly isolated as degraded/unauthenticated state
- tests/typecheck/browser QA evidence are recorded
</definition-of-done>

<output>
Use the Human Proxy YAML report contract from `.github/agents/bjt.human-proxy.agent.md`.

Include:

- selected first slice
- route groups audited this cycle
- specialist agents selected and execution mode
- concrete findings by route
- screenshots/evidence files
- source files changed
- verification commands and results
- updated inventory/risk/report files
- next safe overnight slice
</output>
