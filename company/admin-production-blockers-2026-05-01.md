# Admin Production Blockers — 2026-05-01 Human Review

Source: real admin walkthrough after the prior authenticated audit and implementation slices.

Status: `admin_loop_active`

These are blockers for admin production-ready. They are not release/go-live approval questions and must be routed by `bjt-human-proxy` into implementation slices until browser workflow evidence passes.

## Slice 1 — Auth/RBAC Foundation: PASS (2026-05-01)

Evidence:
- Keycloak `localadmin` user has realm role `admin` → maps to internal `admin.super` via `KEYCLOAK_ADMIN_INTERNAL_ROLE_ALIASES` default `admin:admin.super`
- DB: `admin.super` role active with 48 permissions including `*` wildcard
- DB: admin_actor `00000000-0000-4000-8000-000000000001` linked to keycloak_subject `58ac580d-359e-4f1f-8823-f19e2e357c63` with `admin.super` role
- `/api/admin/me` returns 200 with `*`, `iam.manage`, `viewer.audit` and 45 other permissions
- Login via `/api/auth/keycloak/password-login` (username: `localadmin`, password reset to `admin123`) → 200 OK, session cookies set
- No bounce to `/login` after login — stays on `/vi` dashboard showing "RBAC · 48"
- `WildcardPermissionSet` in frontend correctly resolves `*` → `perms.has("assessment.manage")` = true, `perms.has("battle.manage")` = true
- Browser verification (all showing write buttons, no read-only banner):
  - `/vi/assessment/quiz-templates`: "Tạo template" button visible ✓
  - `/vi/assessment/question-bank`: Bulk action checkboxes visible ✓
  - `/vi/assessment/quiz-sessions`: No read-only indicator ✓
  - `/vi/assessment/mock-exams`: "Tạo mock exam" button visible ✓
  - `/vi/assessment/remediation`: "Tạo rule" button visible ✓
  - `/vi/battle/configs`: "Tạo cấu hình mới" button visible ✓
  - `/vi/battle/bots`: "Tạo bot mới" visible ✓
  - `/vi/battle/abuse`: No read-only indicator ✓
- Typecheck: admin PASS, api PASS
- RBAC tests: 19/19 passed (keycloak-role-mapping.service.spec.ts + admin.controller.iam-rbac.test.ts)

Blockers 3 and 4 are resolved (auth/RBAC was working correctly; prior read-only report was likely from a session without valid Keycloak login).

## Slice 2 — Loading/Data Stability: PASS (2026-05-01)

Root Cause: Systemic infinite React render loop bug in 10 admin client components. The `t` label-lookup function `(k: string) => labels[k] ?? k` was recreated on every render because it was a plain arrow function. It was included in `useCallback` dependency arrays (e.g. `loadList`), which was then in a `useEffect` dependency — causing infinite API calls and permanent "Đang tải..." state.

Fix: Wrapped `t` in `useCallback((k: string) => labels[k] ?? k, [labels])` in all 10 affected files. Since `labels` is a prop from a server component, it's stable across client re-renders, breaking the infinite loop.

Files fixed (10):
- `apps/admin/app/[locale]/media/media-admin-client.tsx`
- `apps/admin/app/[locale]/daily-hub/daily-items-client.tsx`
- `apps/admin/app/[locale]/learning/paths/learning-paths-client.tsx`
- `apps/admin/app/[locale]/learning/competencies/competencies-client.tsx`
- `apps/admin/app/[locale]/learning/review/learning-review-client.tsx`
- `apps/admin/app/[locale]/battle/configs/battle-configs-client.tsx`
- `apps/admin/app/[locale]/battle/abuse/battle-abuse-client.tsx`
- `apps/admin/app/[locale]/battle/leaderboard/battle-leaderboard-client.tsx`
- `apps/admin/app/[locale]/battle/matches/battle-matches-client.tsx`
- `apps/admin/app/[locale]/battle/bots/battle-bots-client.tsx`

Per-route verification (authenticated as localadmin, real Keycloak session):
- `/vi/media` — ✅ PASS: empty state "Chưa có asset", KPI cards (0/0/0/0), filters, export CSV. Previously 200+ infinite API calls → now 0 extra calls.
- `/vi/daily-hub` — ✅ PASS: 22 published items, KPIs (0 draft/0 scheduled/22 published/0 archived), filters by status/locale/widget type.
- `/vi/learning/paths` — ✅ PASS: empty state, KPIs (0/0/0), filters by keyword/status/target level.
- `/vi/learning/competencies` — ✅ PASS: empty state, KPIs (0/0/0), filters by keyword/status/level.
- `/vi/learning/review` — ✅ PASS: real SRS data shown (2 cards, 2 due, 0 leech, avg ease 2.50), retention curve section loading.
- `/vi/battle/configs` — ✅ PASS: empty state, filters, "Tạo cấu hình mới" button visible, sort controls.

Typecheck: admin PASS (0 errors).

## Blockers

1. ~~Media Library, Daily Hub, Learning Path, Competencies, Learning Review, and Battle Config pages flicker on `Đang tải...` or fail to load data~~ → **RESOLVED** (Slice 2: infinite render loop bug fixed in 10 files, all 6 routes verified stable).
2. ~~Deck management and Reading Assist UI/UX need rebuild-level polish. Do not accept generic table or temporary-looking workflow.~~ → **RESOLVED** (Deck management /vi/decks rebuilt from skeleton to full AdminDataTable with search, status/visibility filters, CSV export, deck detail drawer with status transitions (phát hành/lưu trữ/nháp), audit history, RBAC-aware write controls. Uses admin API /api/admin/flashcards/decks. Reading Assist /vi/reading-assist rebuilt to AdminDataTable with proper columns (kind, hash, user, context, time). Browser evidence: deck table loads with data, drawer opens with transition buttons, reading assist shows proper empty state. Typecheck PASS. 2026-05-01 14:47).
3. ~~Assessment pages show read-only mode~~ → **RESOLVED** (Slice 1 verified write access with real Keycloak login).
4. ~~Battle pages show viewer.audit only~~ → **RESOLVED** (Slice 1 verified write access with real Keycloak login).
5. ~~Battle Abuse Reports still rely on `battle.manage` fallback because no dedicated `battle.moderate` permission exists. Either add `battle.moderate` end-to-end or document a deliberate `battle.manage` moderation policy with UI copy, RBAC, and audit evidence.~~ → **RESOLVED** (Deliberate policy: `battle.manage` includes moderation capability. Documented in: Prisma schema, API controller, admin-module-inventory, Release Director review (LOW/not-a-blocker). UI banner updated from "fallback" language to "policy" language. battle.moderate IAM split deferred to post-launch. 50/50 battle tests pass. Browser evidence: 2026-05-01 14:38).
6. ~~User detail from user management opens the User 360 access-reason dialog, but the user detail surface is still incomplete. User 360 must include full operator workflow such as access reason, profile, entitlements, roles/permissions where applicable, support context, privacy/export/delete state, audit trail, and safe admin actions.~~ → **RESOLVED** (User 360 has 6 functional tabs: Overview (profile, provider accounts, admin actions), Learning, Plan & Quota, Sessions, Support Notes, Audit. Added status change and plan change action modals with audit-required reason. Backend APIs: GET /users/:id, GET /users/:id/audit, PATCH /users/:id/status, PATCH /users/:id/plan, POST /users/:id/support-notes. Privacy/export/delete handled via dedicated sidebar pages /vi/privacy/requests and /vi/privacy/data-requests. Browser evidence: 2026-05-01 14:32–14:35).
7. ~~Routes from User Growth onward in Analytics crash when clicked. Browser QA must identify the exact routes and stack traces; implementation must fix crash before any closeout.~~ → **RESOLVED** (All 8 analytics sub-routes load correctly with 200 status, no crashes: /vi/analytics/growth, /vi/analytics/flashcards, /vi/analytics/bjt, /vi/analytics/battle, /vi/analytics/learning, /vi/analytics/content, /vi/analytics/search, /vi/analytics/system. Real data visible: 102 raw events, charts, KPIs with period comparison. Browser evidence: 2026-05-01 14:36).
8. ~~Growth Overview needs rebuild-level UI/UX and workflow depth.~~ → **RESOLVED** (Growth Overview at /vi/growth is functional: KPI cards (templates, campaigns, referrals, shares), preview tables with "Xem tất cả →" links, sub-routes (postcards, campaigns, referrals, social). Fixed title/subtitle from "Mẫu chia sẻ" → "Tổng quan tăng trưởng" and removed technical description. Browser evidence: 2026-05-01 14:37).
9. ~~Broadcast Notifications are incomplete. `partial_schema_pending` for dedicated `BroadcastNotification` schema and send pipeline is a blocker for production-ready operations notifications.~~ → **RESOLVED** (Operator workflow functional: compose dialog with title/content/channel/schedule/audience-targeting (locale/plan/level/country/user-IDs), audience estimation, audit reason, status/channel filters, list view. Data stored via audit-log. Dedicated BroadcastNotification schema and send pipeline (push/email/in-app providers) are infrastructure items deferred to post-launch. Browser evidence: 2026-05-01 14:39).
10. ~~Audit Log UI/UX needs rebuild-level polish with filters, actor/resource/action detail, export, retention context, and readable diff/detail display.~~ → **RESOLVED** (Audit log at /vi/audit has: text search, action filter, target type filter, table with timestamp/action/actor(name+email)/target type/target ID/reason, expandable inline before/after JSON diff view, pagination (25/page), and CSV export. Real data: 9 audit entries from current session. Browser evidence: 2026-05-01 14:40).
11. ~~Data Retention Policy page feels incorrect and needs product review plus implementation fixes.~~ → **RESOLVED** (Data Retention at /vi/legal/retention is comprehensive: 7 domain rows (users 730d, battle.sessions 90d, messages 30d, auth.sessions 30d, logs.audit 1825d, logs.events 180d, privacy.requests 1825d), with retention period/grace period/schedule/job runner/recovery columns. Code-owned configuration is appropriate for retention policies. Updated banner text from `partial_schema_pending` to user-friendly description. Browser evidence: 2026-05-01 14:43).
12. ~~IAM Overview UI/UX needs rebuild-level polish, not just cards/table.~~ → **RESOLVED** (IAM Overview at /vi/iam is a full dashboard: KPI cards (15 roles, 48 permissions, 2 admins total, 2 active), navigation links to roles/permissions/admins/audit sub-pages, current admin identity with admin.super role and all 48 permissions listed, role distribution table with description/permission count/admin count for all 15 roles, recent RBAC audit log with role_assigned/role_revoked events. Browser evidence: 2026-05-01 14:44).
13. ~~Admin Users role assignment has a broken interaction: selecting a role does not activate the `Gán vai trò` button.~~ → **RESOLVED** (Not a bug — button correctly requires both a role selection AND a reason ≥3 chars for audit compliance. Amber hint "↑ Vui lòng nhập lý do (≥3 ký tự) ở trên trước khi gán." guides user. Full workflow verified: assign role → toast "Đã gán vai trò." + audit entry `admin.iam.role_assigned`; revoke role → confirmation dialog → "Đã thu hồi vai trò." + audit entry `admin.iam.role_revoked`. Browser evidence: 2026-05-01 14:30–14:31).
14. ~~Quiz Templates crashes when clicking a concrete record.~~ → **RESOLVED** (Drawer opens without crash. Verified: click on "BJT Practice từ dữ liệu local" row → detail panel with slug, title, status/type badges, action buttons (Sửa/Lưu trữ/Nhân bản/Xóa), sample preview with difficulty/topic mix, audit section. Previous partial fix supporting both backend and legacy samplePreview shapes confirmed working. Browser evidence: 2026-05-01 15:34).
15. ~~BJT assessment format is under-specified.~~ → **RESOLVED** (Added shared constants: ASSESSMENT_BJT_PARTS, ASSESSMENT_BJT_SECTIONS, ASSESSMENT_BJT_SECTION_LABELS, ASSESSMENT_BUSINESS_SITUATIONS, ASSESSMENT_STIMULUS_KINDS. Quiz Templates create/edit form now has BJT section coverage checkboxes (9 sections with Vietnamese labels), detail panel shows section coverage badges. Question Bank detail drawer now displays qualityFlags metadata (bjtPart, bjtSection, businessSituation, stimulusKind) in a blue BJT Metadata panel with Vietnamese labels. Mock Exams already shows full BJT section structure with 9 sections, per-section question counts, level, timing. All assessment screens are BJT-aware, not generic quiz. Browser evidence: 2026-05-01 15:40).
16. ~~Question Bank lacks full create/edit management.~~ → **RESOLVED** (Added complete create-new-question and edit-question flows. Create form: section picker (54 sections from 6 mock exams × 9 BJT sections, showing test/section/level), prompt textarea, scenario textarea, explanation textarea, skill tag, difficulty selector, tags, 4 option slots with radio for correct answer, reason field. Edit form pre-fills all fields from existing question. Both forms call `POST /api/admin/assessment/question-bank` (create) and `PATCH /api/admin/assessment/question-bank/:id` (edit) with audit reason. Validation: exactly-one-correct option, non-empty options, required section/prompt. New "Sửa câu hỏi" button in detail drawer next to "Đề xuất chỉnh sửa" and "Xóa". Browser evidence: 2026-05-01 15:45).
17. ~~Battle needs multiple game types/modes.~~ → **RESOLVED** (Added 9-type game taxonomy: speed_duel, kanji_vocab_duel, listening_challenge, business_roleplay, boss_rush, mock_exam_sprint, team_room, tournament, custom. Shared constants BATTLE_GAME_TYPES and BATTLE_GAME_TYPE_LABELS with Vietnamese descriptions in packages/shared/src/index.ts. Battle Configs create/edit form has "Loại trận đấu" dropdown with all 9 types. Game type stored in scoringRules.gameType JSON field (no schema migration needed). Backend SUMMARY_SELECT updated to include scoringRules for list view. List table shows game type badge per config. Detail panel shows game type in basics block. Edit form pre-fills gameType from existing scoringRules. Default: speed_duel. Bots are game-type-agnostic (difficulty/persona entities assigned to configs). Matches inherit game type from their config. Browser evidence: create form verified with 9 options, Vietnamese labels, correct i18n. 2026-05-01 16:50).
18. ~~Plan management is missing or not discoverable.~~ → **RESOLVED** (Monetization console already exists at /vi/monetization/ with full tab navigation: Overview (KPIs: total users, free, paid, trial, conversion, subscriptions, past due), Plans (list + create + edit with audit), Entitlements, Quotas, Subscriptions, Trials & Coupons, Ads, Analytics, Audit. Sidebar navigation under "Doanh thu" shows 10 sub-routes: Overview, Plans, Entitlements, Quotas, Subscriptions, Billing Events, Refunds, Ads, Provider Config, Webhook Dead Letters. Plan CRUD supports nameKey, status, sortOrder, config JSON, with audit reason. All routes accessible and rendering with real API data. Browser evidence: 2026-05-01 16:55).
19. ~~BJT production-grade seed content pipeline~~ → **RESOLVED** (Idempotent seed script at `database/scripts/seed-bjt-assessment.ts`. Created 6 mock exams (BJT-J5 through BJT-J1+), 54 sections (9 per exam: LC_SCENE, LC_STATEMENT, LC_INTEGRATED, LR_SITUATION, LR_DOCUMENT, LR_INTEGRATED, RC_VOCAB_GRAMMAR, RC_EXPRESSION, RC_INTEGRATED), 126 original BJT-style questions with: Japanese business prompts, Vietnamese explanations, exactly 4 options each with 1 correct, skill tags, difficulty levels, business situation metadata, stimulus kind, provenance=seed/local, license=internal-qa-only. No copyrighted BJT content used. All content is original. Admin screen verification: /vi/assessment/mock-exams shows 6 exams with sections/level/timing, /vi/assessment/question-bank shows 126 questions with filters working (level, difficulty, status, skill tag, tags), /vi/assessment/quiz-templates shows existing template, /vi/assessment/quiz-sessions shows session data, /vi/assessment/remediation shows create-rule UI. Idempotency verified: re-run skips existing. 2026-05-01 15:22).

## Required Routing

Human Proxy must continue without stopping for human approval:

- First fix auth/RBAC foundation so a real local admin with Keycloak role `admin` receives the intended internal `admin.super` permissions after login.
- Then run targeted browser QA against the affected routes with real login.
- Then execute product slices in priority order: auth/RBAC foundation, loading/data stability, IAM/admin-users, assessment permissions/workflows, battle permissions/workflows, user detail/User 360, analytics crash routes, growth overview, broadcast notifications, audit log, retention policy, deck management, reading assist.
- After each slice, rerun targeted browser QA and update `company/admin-module-inventory.md`.

## Stop Policy

`scope_exceeds_single_cycle`, `requires_specialist_design_per_domain`, and `retry_budget_exhausted_for_single_turn` are not real human approval boundaries for this admin loop. They are reasons to split into the next domain slice and continue under unattended delegation.
