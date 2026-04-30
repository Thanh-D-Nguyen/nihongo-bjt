# Sprint Board

## Now

- ID: ADMIN100-AUDIT
- Task: Audit full admin workspace and inventory all scaffold/missing modules
- Owner: bjt-boss
- Status: queued

## Next

- ID: ADMIN100-PHASE
- Task: Complete admin workspace group-by-group until enabled scaffold count is zero
- Owner: bjt-boss
- Status: queued
- Prompt: `.github/prompts/49_admin_100_completion_audit.prompt.md`, then `.github/prompts/50_admin_100_completion_phase.prompt.md`

## Next UI/UX Quality Gate

- ID: BJTUX-REVIEW
- Task: Review major learner/study/assessment/reading/media/social flows against BJT-specific UI/UX production standard
- Owner: bjt-learner-ui
- Status: queued
- Prompt: `.github/prompts/51_bjt_ui_ux_production_review.prompt.md`

## Done

| ID | Task | Owner | Evidence |
| --- | --- | --- | --- |
| PH05-T01 | Admin module contract parity | bjt-backend | Admin module contract manifest is wired via `/api/admin/module-contracts`; scaffold surfaces show honest implemented/partial/planned state. |
| PH05-T02 | User 360 and support privacy boundary | bjt-backend | Sensitive user detail access is permission-gated and redacted when permission is missing; privacy boundary tests pass. |
| PH05-T03 | Feature flag, dead-letter, and admin operations pages | bjt-admin-ui + bjt-backend | Operations APIs and admin routes for feature flags/kill switches/dead-letter/import staging are wired with RBAC + audit requirements; targeted tests pass. |
| PH05-T04 | Real analytics events/rollups and dashboard states | bjt-backend | Admin analytics endpoint reads real events/rollups with freshness/degraded handling and server-side RBAC gating. |
| PH05-T05 | Admin loading/error/empty/permission states hardening | bjt-admin-ui | Overview/scaffold states handle loading/error/degraded/permission-denied honestly; browser phase review passed on key routes. |
| PH07-T01 | Daily/Life in Japan context learning slice | bjt-learner-ui + bjt-backend | Daily hub now surfaces learning objective, risk disclaimer, provenance/source, and remediation links with i18n rendering and backend safeguards. |
| PH07-T02 | Media provenance and accessibility controls | bjt-backend | Media provenance/accessibility metadata persistence + validation contract completed; flashcard media-rights enforcement aligned; migration + targeted tests + typechecks passed. |
| PH07-T03 | Privacy-safe postcards and share pages | bjt-boss | Share creation now requires persisted learner opt-in, scorePercent remains private unless explicitly included, privacy settings consent toggle is wired, and browser phase review passed for privacy/share routes. |
| PH07-T04 | Referral/share analytics with real events | bjt-backend | Added real-event aggregate referral/share funnel API with consent integrity checks; removed share token/referral code from analytics payload; targeted tests + OpenAPI generation passed. |
| PH07-T05 | Battle fairness, anti-cheat, and remediation loops | bjt-backend | Enforced known bot keys, added invalid-answer anti-abuse strike threshold with analytics evidence, prevented invalid payload round lock, and added loss remediation focus skill tags with targeted battle tests passing (6/6). |
| PH08-T01 | Critical backend controller/integration regression suite | bjt-qa | Targeted admin/operations/growth regression suite passed (29/29) with RBAC/privacy/audit boundaries confirmed. |
| PH08-T02 | Learner/admin e2e expansion for critical paths | bjt-qa | Smoke e2e expanded and passed (6/6), including privacy-negative and auth-gate assertions; a11y smoke passed (3/3). |
| PH08-T03 | CI truth gates and OpenAPI contract evidence | bjt-devops | Prisma validate, workspace typecheck, regression tests, e2e smoke, and OpenAPI generation passed with regenerated artifacts. |
| PH08-T04 | Honest health/readiness and startup env validation | bjt-devops | Readiness now includes db/redis/search/provider truthful states with degraded reporting; startup env validation fails fast with sanitized errors; targeted tests passed (3/3). |
| PH08-T05 | Observability plus backup/restore and dead-letter recovery evidence | bjt-devops | Verified pg_dump/pg_restore readiness, ran health/ops/billing/growth observability/privacy regression pack (31/31), and recorded DLQ/fail-closed evidence without fake success. |
| PH08-T06 | Red-team abuse review and release-readiness decision packet | bjt-qa | Abuse-focused battle/billing/ops suite passed (21/21), no critical blocker found, Release Director recommendation set to ship_with_risks pending human phase-end token. |
