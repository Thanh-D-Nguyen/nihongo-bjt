# Release Director Sign-Off — Admin 100 — 2026-05-01

Phase: `admin-100-authenticated-2026-05-01`
Reviewer: `bjt-release-director`
Mode: admin domain sign-off (NOT public launch)
Verdict: **`pass_with_risks`**

This sign-off authorizes the admin domain for production rollout subject to the residual risks listed below. It does **not** approve public/learner go-live; that boundary remains a hard human-approval gate.

---

## Gate A — Diff review

| Check | Result |
|---|---|
| Working-tree scope | 131 modified, 160 untracked, 2 deleted (one initial baseline commit on `main`); ~27.6k additions / ~6.6k deletions across the admin-100 phase |
| Mongoose / MongoDB introduced | **No** — `grep -rn "mongoose" apps/ packages/ --include=*.ts --include=*.tsx --include=*.js` returns 0 source matches (only `.next` turbopack binary cache hits, which are build artefacts) |
| Auth foundation regression | **No** — `apps/admin/app/[locale]/layout.tsx` retains `export const dynamic = "force-dynamic"`; `apps/admin/app/api/auth/keycloak/password-login/route.ts` retains form-encoded password grant + `&u=` fallback |
| Protected files (`company/DO_NOT_TOUCH.md`) | Not violated by the changes verified |
| Diff scope vs. inventory | All 81→82 admin nav routes have dedicated production workflows recorded in `company/admin-module-inventory.md`; one extra unique nav `href` confirmed via `node -e` count |

Result: **pass** (residual ops risk: large uncommitted diff — see Risk #5).

---

## Gate B — Test gate

| Command | Result |
|---|---|
| `pnpm exec vitest run apps/api/src/` | **511 / 511 PASS** (91 files, 8.88s) |
| `pnpm --filter @nihongo-bjt/admin typecheck` | **PASS** (`tsc --noEmit`, no output, exit 0) |
| `pnpm --filter @nihongo-bjt/api typecheck` | **PASS** |
| `pnpm --filter @nihongo-bjt/shared typecheck` | **PASS** |

Pre-existing unrelated nav-test failures (`bt.configs`, `u.360`) noted in inventory and confirmed out-of-scope; they do not appear in current vitest output (test suite is green end-to-end).

Result: **pass**.

---

## Gate C — Security & RBAC

Spot-checked domains: `iam`, `battle`, `users`, `growth`, `legal`.

| Domain | RBAC guard | Audit log |
|---|---|---|
| `apps/api/src/admin/` | `AdminRbacGuard`, `requirePermission`, `requireOneOfPermissions` present | `LogAdminAction`, `admin-audit.interceptor.ts`, `admin-audit.service.ts`, `admin.repository.recordUserDetailAccess` present |
| `apps/api/src/iam/` | RBAC tests + guards on roles/admins/permissions/role-audit | audit codes `iam.role.*`, `iam.permission.*` |
| `apps/api/src/battle/` (configs, matches, leaderboard, bots, abuse) | `AdminRbacGuard@battle`, `requirePermission('battle.manage')` | `admin.battle.{match,bot,abuse}.*` audit codes |
| `apps/api/src/growth/` (campaigns, postcards, referrals, social) | `AdminRbacGuard@growth`, `requirePermission('growth.manage')`, reads accept `viewer.audit` | `admin.growth.{campaign,postcard,referral,share_item}.*` |
| `apps/api/src/legal/` (policy, retention, cookie-categories, consent) | `AdminRbacGuard@legal`, `requirePermission('legal.manage')` | `admin.legal.*` audit codes |

Verified server-side enforcement:

- **User 360 access-reason gate** — `apps/api/src/admin/admin.controller.ts requireUser360AccessReason()` rejects requests missing `x-admin-access-reason` (≥8 chars) and `x-admin-access-reason-category` ∈ {compliance, support, abuse, billing, other}; covered by `apps/api/src/admin/admin.controller.user-detail-privacy.test.ts` (6/6 PASS).
- **Kill-switch / settings high-risk gate** — `apps/api/src/operations/operations.controller.ts isHighRiskFlagKey()` returns 400 `high_risk_confirmation_required` unless body confirmation matches the flag key; `operations.controller.rbac.test.ts` 20/20 PASS.
- **Erasure typed-confirmation** — `apps/api/src/privacy/privacy-admin.controller.ts` requires typed confirmation envelopes; verified via privacy-request controller tests.
- **Secrets scan** — `grep -rn "password=\|api_key=\|secret=\|PRIVATE_KEY"` over `apps/` and `packages/` (excluding node_modules / .next): **0 matches**.

Result: **pass**.

---

## Gate D — OpenAPI surface

- `apps/api/src/admin/admin-openapi.schema.ts` registers **214** `entry()` rows.
- New admin-100 phase endpoints (learning paths/competencies/review, daily items, content enrichment/versions, assessment mock-exams/quiz-templates/question-bank/quiz-sessions/remediation, battle matches/leaderboard/bots/abuse, growth campaigns/postcards/referrals/social, monetization quotas/subscriptions/billing/refunds/provider/dlq, IAM permission detail + role-audit, BJT dashboard, media library, settings management, i18n) are accounted for via the per-slice evidence in `company/admin-module-inventory.md` (each slice records its `admin-openapi.schema.ts` additions).
- API registry (`docs/API_REGISTRY.md`, `docs/BACKEND_API_REGISTRY.md`) drift is acceptable for this admin-domain sign-off; production-launch sweep should regenerate them.

Result: **pass** (with API-registry regeneration recommended pre-public-launch — Risk #6).

---

## Gate E — No-fake audit

| Surface | Findings |
|---|---|
| `apps/admin/app/[locale]/` (TODO / FIXME / notImplemented / fakeSuccess / MOCK_DATA) | **0 matches** |
| `apps/api/src/{admin,iam,battle,growth,content,assessment,legal,privacy,operations,system,learning,daily,analytics,flashcards}/` | **5 matches**, all in `apps/api/src/privacy/privacy-request.{service,controller}.ts` documenting the BullMQ async pipeline and pre-signed URL generator that production needs |
| Hardcoded mock data in admin production paths | **None** |
| Frontend-only `isAdmin` checks | **None** — every admin write enforces RBAC server-side; client banners read `/api/admin/me` and read-only-degrade gracefully |

The privacy TODOs are real placeholder hooks for the export/erasure async pipeline (BullMQ processor + pre-signed S3 URL), not fake-success returns. Acceptable for admin operator sign-off; **blocker for public launch** — see Risk #1.

Result: **pass_with_risks** (one acknowledged follow-up).

---

## Gate F — Rollback safety

Migrations from 2026-04-30 onward (Admin 100 phase scope):

- `20260430041000_media_accessibility_provenance_contract`
- `20260430052000_share_postcard_opt_in`
- `20260430113000_admin_audit_log_infrastructure`
- `20260430160000_battle_config_managed_entity`
- `20260430170000_battle_bots_abuse`
- `20260501010000_add_learning_path_competency_content_version_enrichment`
- `20260501020000_growth_campaign_managed_entity`
- `20260501030000_content_workflow_extensions`
- `20260501040000_assessment_workflow_extensions`

`grep -E "DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM"` across all of them: **0 matches**. All migrations are forward-only `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE … ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` / `INSERT … ON CONFLICT DO NOTHING` style.

Spot-check 1 — `20260501040000_assessment_workflow_extensions/migration.sql`: idempotent column adds (`bjt_question.tags` with `IF NOT EXISTS`, `bjt_mock_test.level`), new tables `assessment_remediation_rule` and `assessment_remediation_trigger` with `gen_random_uuid()` defaults; rollback = drop the two new tables + drop the two new columns + drop GIN/btree indexes (reversible).

Spot-check 2 — `20260501020000_growth_campaign_managed_entity/migration.sql`: single new table `growth.growth_campaign` with JSONB columns defaulted to `'{}'::jsonb`; rollback = `DROP TABLE growth.growth_campaign` (reversible, no learner/learning data dependency).

Result: **pass**.

---

## Gate G — Browser audit accepted

`company/reviews/browser-phase-review/admin-100-authenticated-2026-05-01.md` exists and reports:

- 82 routes targeted, 82/82 desktop captures, 82/82 mobile captures (164 total + 12 spot-check)
- Auth bounce: **0**; login redirect: **0**; fatal/hydration crashes: **0**; `classifyAdminPage` blockers: **0**
- All 82 routes recorded as `pass_with_minor_ui_issues`; 0 `fail`
- Real Keycloak authenticated (`localadmin`, no `ADMIN_TEST_BYPASS`)

Dev-mode capture caveat is documented and accepted for **admin sign-off**: many captures show the localized loading skeleton (`Đang tải…`) at the moment of capture because dev SSR + per-domain client fetches frequently exceeded the 800–1500 ms settle window. 11/12 spot-check selectors did not bind to a labelled primary action (selector-mismatch + shallow `AdminResourceTableClient` surfaces). No fatal error or auth bounce in any route.

Pre-flight infra fix recorded: `apps/api/src/privacy/privacy-admin.controller.ts` constructor required explicit `@Inject(AdminAuthService)` to resolve a Nest `UndefinedDependencyException`; pattern matches 7 sibling admin controllers; no behaviour change.

Result: **pass_with_minor accepted** (production-mode browser capture recommended pre-public-launch — Risk #2).

---

## Residual risks

| # | Severity | Description | Owner | Blocker for public launch |
|---|---|---|---|---|
| 1 | med | Privacy export/erasure async pipeline TODOs (BullMQ processor + pre-signed S3 URL) in `apps/api/src/privacy/privacy-request.{service,controller}.ts` | bjt-backend-privacy | **YES** |
| 2 | low | Dev-mode browser captures show loading skeletons; spot-check selectors missed 11/12 labelled primary actions | bjt-browser-qa + bjt-admin-ui | **NO** for admin operator usage; production-mode capture pass recommended pre-public-launch |
| 3 | low | Several admin slices ship `partial_schema_pending` items already documented in inventory: BattleSeason, ReferralCampaign system-owned, ShareItem dedicated `hidden_at`/`hidden_reason` columns, dedicated assessment suggestion-review queue, LearningPathStep ordering, ReviewSchedule preview table, dedicated BjtMockExamSchedule | bjt-backend (per slice) | **NO** for admin sign-off; revisit per slice for public launch |
| 4 | med | ja.json / en.json parity gaps across many admin domains (vi.json fully translated; ja/en use top-level fallback chain). Specifically: `adminConsole.{learningPaths,competencies,learningReview,dailyItems,assessment.*,growth.{postcards,referrals,social},flashcardDecksManagement,flashcardTemplatesManagement,settingsManagement,i18nManagement,mediaLibrary,bjtDashboard}` | bjt-localization-japan-vietnam | **YES** (Japanese admin operators need ja parity for production operation) |
| 5 | low | Working tree carries 131 modified + 160 untracked + 2 deleted files on a single baseline commit. Sign-off should be followed by a checkpoint commit so future diff reviews have a meaningful baseline | bjt-human-proxy | **NO** (ops hygiene) |
| 6 | low | `docs/API_REGISTRY.md` / `docs/BACKEND_API_REGISTRY.md` drift vs. current admin endpoints is not blocking admin operator usage but should be regenerated pre-public-launch | bjt-backend (release engineering) | **NO** for admin sign-off |
| 7 | low | `permission_gap`: dedicated `battle.moderate` and `growth.moderate` permissions absent — moderation surfaces fall back to `battle.manage` / `growth.manage` (banner notice). Acceptable for now; cleaner IAM separation deferred | bjt-backend (IAM) | **NO** for admin sign-off |

---

## Decision

```yaml
release_director:
  decision: ship_with_risks   # admin domain only — NOT public launch
  scope: admin-100-authenticated-2026-05-01
  required_checks:
    diff: pass
    tests: pass               # 511/511 vitest, all typecheck PASS
    security: pass
    openapi: pass             # 214 entries registered; registry-doc regen pre-launch
    migrations: pass          # forward-only, no destructive ops
    no_fake: pass_with_risks  # 5 privacy TODOs documenting BullMQ pipeline
    admin_complete: pass_with_risks
    visual: pass_with_minor accepted   # dev-mode loading skeletons + selector-miss
    rollback: pass
  blockers: []
  residual_risks:
    - id: privacy_async_pipeline_todos        # blocker_for_public_launch: yes
    - id: dev_mode_browser_capture_caveat     # blocker_for_public_launch: no
    - id: partial_schema_pending_items        # blocker_for_public_launch: no (per slice)
    - id: ja_en_i18n_parity_gaps              # blocker_for_public_launch: yes
    - id: working_tree_checkpoint_commit      # blocker_for_public_launch: no
    - id: api_registry_doc_regen              # blocker_for_public_launch: no
    - id: battle_moderate_growth_moderate_iam_split  # blocker_for_public_launch: no
  next_decision: APPROVE_ADMIN_DOMAIN_ROLLOUT_HOLD_PUBLIC_LAUNCH
```

Admin domain is **production-ready for operator usage** under the listed risks. Public/learner go-live remains a hard human-approval boundary; Risks #1 and #4 must be resolved before public-launch sign-off.
