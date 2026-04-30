# PHASE-10-T02 — Admin 100% Completion Task Plan

**Status**: APPROVED AS PLANNING EVIDENCE — Superseded for execution by `company/PHASE_PLAN.md`

**Prepared**: 2026-04-30

**Based on**: PH10-T01 Audit Findings + ADMIN_COMPLETION_PROGRAM.md + User Priority Guidance

---

## Executive Summary

**Current State**: 59 enabled admin nav items (67%) remain scaffold, blocking production readiness.

**Audit Findings**:
- 88 total admin routes; 29 production (33%); 59 scaffold (67%)
- 54 unique missing backend APIs
- 59 items missing RBAC enforcement
- 59 items missing audit logs
- Battle feature flag `adminNav.battle` **ENABLED BY DEFAULT** (5 battle admin items are blockers unless feature is disabled)

**Recommendation**: **OPTION 2 (MVP path)** — Disable battle admin by default + complete 54 core routes. This unblocks production while allowing battle admin completion in follow-up phases.

**Estimated Effort**:
- Core admin completion (54 routes): ~48–60 hours (balanced team effort)
- Battle completion (5 routes, optional): ~6–8 hours
- **Total PHASE-10 budget**: 54–68 hours implementation + review/testing

**Risk Level**: HIGH (large scope, cross-layer changes) → Mitigated via small focused tasks, layered gates, no-fake enforcement

## Scoped Cutline Review (Option C)

Cutline resolved against current scaffold evidence (59 scaffold pages using `renderAdminScaffoldForId`, including 5 battle pages).

### Core 54 Route Classification (battle excluded)

- `must_ship_mvp`: 33 routes
- `feature_disabled_for_mvp`: 0 routes
- `defer_phase_11`: 21 routes
- `already_production`: 0 routes

### Must Ship MVP (33)

- `/system/health`
- `/system/queue-health`
- `/system/search-sync`
- `/system/release`
- `/ops/feature-flags`
- `/ops/kill-switches`
- `/ops/dead-letters`
- `/ops/notifications`
- `/ops/security`
- `/import/manifests`
- `/import/failed`
- `/iam/roles`
- `/iam/permissions`
- `/iam/admins`
- `/iam/role-audit`
- `/users/360`
- `/support/notes`
- `/privacy/requests`
- `/privacy/data-requests`
- `/legal/documents`
- `/legal/terms`
- `/legal/consent`
- `/legal/cookies`
- `/legal/tokushoho`
- `/legal/retention`
- `/monetization/plans`
- `/monetization/entitlements`
- `/monetization/quotas`
- `/monetization/subscriptions`
- `/monetization/billing-events`
- `/monetization/refunds`
- `/monetization/provider-config`
- `/monetization/webhook-dlq`

### Defer PHASE-11 (21)

- `/content/versions`
- `/content/enrichment`
- `/i18n`
- `/flashcards/templates`
- `/flashcards/generated`
- `/learning/paths`
- `/learning/competencies`
- `/assessment/quiz-templates`
- `/assessment/question-bank`
- `/assessment/quiz-sessions`
- `/assessment/mock-exams`
- `/assessment/remediation`
- `/analytics/growth`
- `/analytics/bjt`
- `/analytics/flashcards`
- `/analytics/battle`
- `/analytics/system`
- `/growth/social`
- `/growth/referrals`
- `/growth/postcards`
- `/growth/campaigns`

### Feature Disabled for MVP (outside core 54)

- `/battle/configs`
- `/battle/bots`
- `/battle/matches`
- `/battle/leaderboard`
- `/battle/abuse`

Production control for hidden battle routes:

- `NEXT_PUBLIC_ADMIN_FEATURE_FLAGS={"adminNav.battle":false}`

Execution policy for PHASE-10:

- Execute only `must_ship_mvp` admin routes.
- Do not execute deferred groups in PHASE-10.
- Continue P1 learner hardening with existing loading/card patterns (no new skeleton library prerequisite).

---

## Recommended Strategy: Battle Feature Flag

### Finding
Per `apps/admin/lib/admin-feature-flags.ts` line 14:
> Omitted keys default to **enabled** (not disabled)

**Current status**: `adminNav.battle` is **ENABLED** without explicit environment override.

### Two Production Paths

| Path | Effort | Ship Timeline | Battle Status |
|---|---|---|---|
| **Option 1: Full Feature** | +6–8h | Longer | All 5 battle routes complete, enabled |
| **Option 2: MVP (Recommended)** | Immediate | Current | Disable battle admin in prod env, complete in PHASE-11 |

### Recommendation: **OPTION 2**

**Rationale**:
1. Battle admin is lower priority per user guidance (social/motivation category)
2. User explicitly prioritized: Daily Hub (done), Flashcard (done), Quiz (PHASE-10), then battle lower
3. Battle feature flag can be toggled off in production without codebase changes
4. Allows MVP launch without battle admin completion
5. Battle can be completed in follow-up phase when team capacity available

**Action**: Set `NEXT_PUBLIC_ADMIN_FEATURE_FLAGS='{"adminNav.battle":false}'` in production to hide 5 battle nav items.

---

## Task Grouping Strategy

**Layers** (backend APIs + RBAC/audit first):
1. **Infrastructure** (prerequisite setup)
2. **System & Operations** (foundational)
3. **IAM** (foundational access control)
4. **Content & i18n** (content management)
5. **Assessment & Learning** (learning operations)
6. **Users, Support, Legal** (user and compliance management)
7. **Monetization** (revenue operations)
8. **Analytics & Growth** (insights)
9. **Battle** (optional, feature-flagged)

---

## Phase-10 Task Breakdown

### GROUP 1: Infrastructure Prerequisites

**Scope**: RBAC framework, audit log setup, API registry
**Owner**: bjt-backend + bjt-security
**Risk**: HIGH (affects all other admin tasks)
**Blocker**: None (runs first)

#### PH10-T02.1: Admin RBAC Framework Setup

**Objective**: Establish role-based access control enforcement for all admin APIs

**Scope**:
- Create/verify admin RBAC decorator (e.g., `@AdminRbac(permission)`)
- Register all admin roles: `admin_super`, `admin_ops`, `admin_content`, `admin_growth`, `admin_support`
- Implement permission check middleware/guard for all admin endpoints
- Add RBAC test fixtures
- Update OpenAPI: tag admin endpoints with required role

**Backend Files** (likely):
- `apps/api/src/admin/admin.rbac.ts` (new or verify)
- `apps/api/src/auth/guards/admin-rbac.guard.ts`
- `apps/api/src/admin/admin.controller.*.ts`
- `apps/api/src/database/seeders/admin-roles.seeder.ts`

**Acceptance Criteria**:
- [ ] All admin endpoints tagged with required role
- [ ] RBAC guard blocks unauthorized roles with 403
- [ ] Tests verify permission enforcement
- [ ] OpenAPI spec includes role tags

**Estimated Hours**: 6–8h
**Risk**: MEDIUM (foundational, must be correct)

---

#### PH10-T02.2: Admin Audit Log Framework Setup

**Objective**: Establish audit logging for all admin write operations

**Scope**:
- Create audit log schema/table (if not exists): `AdminAuditLog`
- Implement `@AdminAudit()` decorator for mutation endpoints
- Capture: userId, action, resource, old_value, new_value, timestamp, status
- Create audit log query/list endpoint (`GET /admin/audit-logs`)
- Add seeder/test fixtures
- Verify no admin write escapes audit

**Backend Files** (likely):
- `apps/api/src/admin/admin-audit.service.ts` (new)
- `apps/api/src/admin/admin-audit.decorator.ts` (new)
- `packages/database/prisma/schema.prisma` (AdminAuditLog table)
- `apps/api/src/admin/admin.controller.audit.ts` (new)

**Acceptance Criteria**:
- [ ] AdminAuditLog schema created and migrated
- [ ] All admin writes logged with action/resource/values
- [ ] Audit list endpoint queryable by userId/action/resource
- [ ] Tests verify logging on create/update/delete
- [ ] OpenAPI spec includes audit endpoints

**Estimated Hours**: 6–8h
**Risk**: MEDIUM (foundational, audit integrity required)

---

#### PH10-T02.3: Admin API Registry & OpenAPI Contracts

**Objective**: Document all admin API endpoints with DTO validation and OpenAPI schema

**Scope**:
- Create/update admin API registry: group by feature area
- For each scaffold admin page group:
  - Define request DTOs (GET query, POST body)
  - Define response DTOs (200, 400, 403, 404, 500)
  - Tag with feature area and required role
- Run OpenAPI generator
- Update `docs/BACKEND_API_PRODUCTION_AUDIT.md` with admin API completion status

**Backend Files** (likely):
- `apps/api/src/admin/dto/*.dto.ts`
- `apps/api/src/admin/admin.controller.*.ts` (add OpenAPI decorators)
- `docs/BACKEND_API_PRODUCTION_AUDIT.md`

**Acceptance Criteria**:
- [ ] All admin endpoints documented in OpenAPI
- [ ] All DTOs defined (request/response)
- [ ] OpenAPI generation passes without errors
- [ ] API registry updated with endpoint list

**Estimated Hours**: 4–6h
**Risk**: LOW (documentation, high-level)

---

### GROUP 2: System & Operations (11 scaffold items)

**Scope**: System health, queues, feature flags, kill switches, import management
**Owner**: bjt-backend (API) + bjt-admin-ui (UI)
**Risk**: HIGH (health/operational endpoints)
**Blocker**: Completed PH10-T02.1–2.3 (RBAC/audit/API registry)

#### PH10-T02.4: System Health & Queue Monitoring APIs + Admin UI

**Objective**: Complete system health, queue health, search sync, and release endpoints with real data

**Backend Scope**:
- API: `GET /admin/system/health` → real system metrics (db, cache, queue, search status)
- API: `GET /admin/system/queue-health` → queue status, pending job counts, DLQ count
- API: `GET /admin/system/search-sync` → Meilisearch sync status
- API: `GET /admin/system/release` → current app version, deployment timestamp
- All endpoints RBAC: `admin_super` or `admin_ops`
- All endpoints audit-logged (reads typically not logged, but health checks may be flagged)

**Admin UI Scope** (`apps/admin/app/[locale]/system/`):
- `/system/health` → cards showing system status, refresh button, color-coded alerts
- `/system/queue-health` → queue depth table, DLQ items, job failure counts
- `/system/search-sync` → Meilisearch sync progress, last sync timestamp
- `/system/release` → version info, deployment time, rollback option (if applicable)
- All pages use real API (no scaffold)
- i18n for all labels
- Loading, error, degraded states

**Acceptance Criteria** (Backend):
- [ ] 4 endpoints implemented with real data
- [ ] RBAC enforcement (admin_ops role required)
- [ ] OpenAPI documented
- [ ] Tests verify endpoint behavior and RBAC

**Acceptance Criteria** (UI):
- [ ] 4 scaffold pages replaced with production UI
- [ ] Connected to real APIs
- [ ] Loading/error states
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 10–12h (backend 6–7h, UI 4–5h)
**Risk**: HIGH (operational criticality)

---

#### PH10-T02.5: Feature Flags & Kill Switches APIs + Admin UI

**Objective**: Complete admin feature flag and kill switch management

**Backend Scope**:
- API: `GET /admin/ops/feature-flags` → list all feature flags, current values
- API: `PATCH /admin/ops/feature-flags/:key` → toggle feature flag, audit logged
- API: `GET /admin/ops/kill-switches` → list all kill switches (circuit breakers)
- API: `PATCH /admin/ops/kill-switches/:key` → toggle kill switch, audit logged
- All mutations RBAC: `admin_ops`
- All mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/ops/`):
- `/ops/feature-flags` → table of flags, current state, toggle button, last modified by/when
- `/ops/kill-switches` → table of circuit breakers, status, toggle button
- Both pages show history or recent changes
- i18n labels

**Acceptance Criteria** (Backend):
- [ ] 4 endpoints (list flags, patch flag, list switches, patch switch)
- [ ] RBAC enforcement (admin_ops)
- [ ] Audit logged on all mutations
- [ ] Tests verify behavior and RBAC

**Acceptance Criteria** (UI):
- [ ] 2 scaffold pages replaced with production UI
- [ ] Connected to real APIs
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 8–10h (backend 4–5h, UI 4–5h)
**Risk**: HIGH (operational criticality, must not break features)

---

#### PH10-T02.6: Import & Failed Jobs Management APIs + Admin UI

**Objective**: Complete import manifest, failed imports, and notifications management

**Backend Scope**:
- API: `GET /admin/import/manifests` → list import manifests (completed, in progress)
- API: `GET /admin/import/failed` → list failed imports with error details
- API: `POST /admin/import/retry/:id` → retry failed import
- API: `GET /admin/ops/notifications` → list system notifications/alerts
- All endpoints RBAC: `admin_ops`
- Mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/import/` and `/ops/`):
- `/import/manifests` → table of manifests (date, status, item count, duration)
- `/import/failed` → table of failed imports (manifest, error message, retry button)
- `/ops/notifications` → system notifications feed
- i18n labels

**Acceptance Criteria** (Backend):
- [ ] 4 endpoints implemented
- [ ] RBAC enforcement
- [ ] Mutations audit-logged
- [ ] Tests verify behavior

**Acceptance Criteria** (UI):
- [ ] 3 scaffold pages replaced with production UI
- [ ] Connected to real APIs
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 8–10h (backend 4–5h, UI 4–5h)
**Risk**: MEDIUM

---

### GROUP 3: IAM (Roles, Permissions, Admin Management) (4 scaffold items)

**Scope**: Role definitions, permission matrix, admin user management
**Owner**: bjt-security (lead) + bjt-admin-ui
**Risk**: HIGH (access control)
**Blocker**: Completed PH10-T02.1 (RBAC framework)

#### PH10-T02.7: IAM Admin APIs + Admin UI

**Objective**: Complete role, permission, and admin user management pages

**Backend Scope**:
- API: `GET /admin/iam/roles` → list all admin roles with permissions
- API: `POST /admin/iam/roles` → create new admin role (RBAC: `admin_super`)
- API: `PATCH /admin/iam/roles/:id` → update role permissions (RBAC: `admin_super`)
- API: `GET /admin/iam/permissions` → list all available permissions
- API: `GET /admin/iam/admins` → list admin users with roles
- API: `POST /admin/iam/admins` → invite new admin user (RBAC: `admin_super`)
- API: `PATCH /admin/iam/admins/:id/roles` → update admin user roles (RBAC: `admin_super`)
- API: `GET /admin/iam/role-audit` → view role change audit trail
- All mutations RBAC: `admin_super`
- All mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/iam/`):
- `/iam/roles` → role management table (name, permissions, actions)
- `/iam/permissions` → read-only permission catalog
- `/iam/admins` → admin user management (email, roles, last login, actions)
- `/iam/role-audit` → audit trail of role changes

**Acceptance Criteria** (Backend):
- [ ] 8 endpoints implemented
- [ ] RBAC enforcement (admin_super only for mutations)
- [ ] All mutations audit-logged
- [ ] Tests verify RBAC and audit

**Acceptance Criteria** (UI):
- [ ] 4 scaffold pages replaced with production UI
- [ ] Connected to real APIs
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 12–14h (backend 6–7h, UI 6–7h)
**Risk**: HIGH (security-critical)

---

### GROUP 4: Content Management (3 scaffold items)

**Scope**: Content versions, enrichment, i18n management
**Owner**: bjt-admin-ui (lead) + bjt-backend
**Risk**: MEDIUM
**Blocker**: None (independent)

#### PH10-T02.8: Content Versions, Enrichment, & i18n APIs + Admin UI

**Objective**: Complete content versioning, enrichment pipeline, and i18n management

**Backend Scope**:
- API: `GET /admin/content/versions` → list content versions (published, draft)
- API: `POST /admin/content/versions/publish` → publish new version (RBAC: `admin_content`)
- API: `GET /admin/content/enrichment` → enrichment pipeline status (kanji, readings, etc.)
- API: `POST /admin/content/enrichment/trigger` → trigger enrichment run (RBAC: `admin_content`)
- API: `GET /admin/i18n` → list i18n keys, translations by language
- API: `POST /admin/i18n/sync` → sync i18n keys from codebase (RBAC: `admin_content`)
- All mutations RBAC: `admin_content`
- All mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/content/` and `/i18n/`):
- `/content/versions` → version history table, publish button, rollback option
- `/content/enrichment` → enrichment status, pipeline logs, trigger button
- `/i18n` → i18n key management (key, translations by language, edit form)

**Acceptance Criteria** (Backend):
- [ ] 6 endpoints implemented
- [ ] RBAC enforcement (admin_content)
- [ ] Mutations audit-logged
- [ ] Tests verify behavior

**Acceptance Criteria** (UI):
- [ ] 3 scaffold pages replaced with production UI
- [ ] Connected to real APIs
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 10–12h (backend 5–6h, UI 5–6h)
**Risk**: MEDIUM

---

### GROUP 5: Assessment & Learning (9 scaffold items)

**Scope**: Quiz templates, question bank, quiz sessions, mock exams, remediation, learning paths, competencies
**Owner**: bjt-backend (API) + bjt-admin-ui (UI) + bjt-assessment-psychometrics (review)
**Risk**: HIGH (assessment operations, scoring logic)
**Blocker**: None (independent)

#### PH10-T02.9: Quiz & Question Bank Management APIs + Admin UI

**Objective**: Complete quiz template, question bank, and quiz session management

**Backend Scope**:
- API: `GET /admin/assessment/quiz-templates` → list quiz templates
- API: `POST /admin/assessment/quiz-templates` → create quiz template (RBAC: `admin_content`)
- API: `GET /admin/assessment/question-bank` → list questions, filtered by category
- API: `POST /admin/assessment/question-bank` → add question (RBAC: `admin_content`)
- API: `GET /admin/assessment/quiz-sessions` → list active quiz sessions
- API: `GET /admin/assessment/quiz-sessions/:id` → view session details, user responses
- API: `POST /admin/assessment/quiz-sessions/:id/invalidate` → invalidate session (RBAC: `admin_super`)
- All mutations RBAC: appropriate role
- All mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/assessment/`):
- `/assessment/quiz-templates` → template management (name, category, question count, actions)
- `/assessment/question-bank` → question catalog with search, edit/delete buttons
- `/assessment/quiz-sessions` → active sessions table (user, quiz, started, progress)

**Acceptance Criteria** (Backend):
- [ ] 7 endpoints implemented
- [ ] RBAC enforcement
- [ ] Mutations audit-logged
- [ ] Tests verify behavior

**Acceptance Criteria** (UI):
- [ ] 3 scaffold pages replaced with production UI
- [ ] Connected to real APIs
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 12–14h (backend 6–7h, UI 6–7h)
**Risk**: HIGH (assessment operations)

---

#### PH10-T02.10: Mock Exams & Remediation APIs + Admin UI

**Objective**: Complete mock exam management and remediation tracking

**Backend Scope**:
- API: `GET /admin/assessment/mock-exams` → list mock exams (date, candidates, avg score)
- API: `POST /admin/assessment/mock-exams` → schedule mock exam (RBAC: `admin_content`)
- API: `GET /admin/assessment/mock-exams/:id/results` → view mock exam results
- API: `GET /admin/assessment/remediation` → remediation recommendations by topic
- API: `POST /admin/assessment/remediation/trigger` → trigger remediation job (RBAC: `admin_content`)
- All mutations RBAC: `admin_content`
- All mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/assessment/`):
- `/assessment/mock-exams` → mock exam schedule & results
- `/assessment/remediation` → remediation tracking by user/topic

**Acceptance Criteria** (Backend):
- [ ] 5 endpoints implemented
- [ ] RBAC enforcement
- [ ] Mutations audit-logged
- [ ] Tests verify behavior

**Acceptance Criteria** (UI):
- [ ] 2 scaffold pages replaced with production UI
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 8–10h (backend 4–5h, UI 4–5h)
**Risk**: MEDIUM

---

#### PH10-T02.11: Learning Paths, Templates, & Competencies APIs + Admin UI

**Objective**: Complete learning path, flashcard template, and competency management

**Backend Scope**:
- API: `GET /admin/learning/paths` → list learning paths
- API: `POST /admin/learning/paths` → create learning path (RBAC: `admin_content`)
- API: `GET /admin/learning/competencies` → list competency profiles
- API: `POST /admin/learning/competencies` → add competency (RBAC: `admin_content`)
- API: `GET /admin/flashcards/templates` → list flashcard templates
- API: `POST /admin/flashcards/templates` → create flashcard template (RBAC: `admin_content`)
- API: `GET /admin/flashcards/generated` → list auto-generated flashcards
- All mutations RBAC: `admin_content`
- All mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/learning/` and `/flashcards/`):
- `/learning/paths` → learning path catalog (name, target, steps, actions)
- `/learning/competencies` → competency framework (name, level, skills)
- `/flashcards/templates` → template management (name, card count, actions)
- `/flashcards/generated` → generated cards catalog

**Acceptance Criteria** (Backend):
- [ ] 8 endpoints implemented
- [ ] RBAC enforcement
- [ ] Mutations audit-logged
- [ ] Tests verify behavior

**Acceptance Criteria** (UI):
- [ ] 4 scaffold pages replaced with production UI
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 12–14h (backend 6–7h, UI 6–7h)
**Risk**: MEDIUM

---

### GROUP 6: Users, Support, Legal (14 scaffold items)

**Scope**: User 360 view, support notes, privacy requests, legal documents, consent, cookies, retention
**Owner**: bjt-admin-ui (lead) + bjt-security (privacy/legal review)
**Risk**: HIGH (privacy/compliance/legal)
**Blocker**: None (independent)

#### PH10-T02.12: User 360 & Support Notes APIs + Admin UI

**Objective**: Complete user 360-degree view and support notes management

**Backend Scope**:
- API: `GET /admin/users/360/:userId` → user profile, learning stats, support history (RBAC: `admin_support` or `admin_super`)
- API: `POST /admin/support/notes/:userId` → add support note (RBAC: `admin_support`)
- API: `GET /admin/support/notes/:userId` → list support notes (RBAC: `admin_support`)
- All endpoints check user privacy boundary (RBAC view can be restricted)
- Mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/users/` and `/support/`):
- `/users/360/:userId` → user profile, learning progress, quiz history, support notes inline
- `/support/notes/:userId` → support notes editor, history

**Acceptance Criteria** (Backend):
- [ ] 3 endpoints implemented
- [ ] RBAC enforcement (admin_support role)
- [ ] Privacy boundary checks (prevent unauthorized user data access)
- [ ] Mutations audit-logged
- [ ] Tests verify RBAC and privacy

**Acceptance Criteria** (UI):
- [ ] 2 scaffold pages replaced with production UI
- [ ] Privacy boundary visible (no unauthorized data exposure)
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 10–12h (backend 5–6h, UI 5–6h)
**Risk**: HIGH (privacy-sensitive)

---

#### PH10-T02.13: Privacy & Data Export APIs + Admin UI

**Objective**: Complete privacy request and data export management

**Backend Scope**:
- API: `GET /admin/privacy/requests` → list privacy requests (deletion, export, correction)
- API: `PATCH /admin/privacy/requests/:id/status` → update request status (RBAC: `admin_super`)
- API: `POST /admin/privacy/requests/:id/export` → trigger data export (RBAC: `admin_super`)
- API: `GET /admin/privacy/data-requests` → list completed data exports
- All mutations RBAC: `admin_super`
- All mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/privacy/`):
- `/privacy/requests` → privacy request queue (user, request type, status, actions)
- `/privacy/data-requests` → completed exports (user, export date, download link)

**Acceptance Criteria** (Backend):
- [ ] 4 endpoints implemented
- [ ] RBAC enforcement (admin_super)
- [ ] Mutations audit-logged
- [ ] Tests verify behavior

**Acceptance Criteria** (UI):
- [ ] 2 scaffold pages replaced with production UI
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 8–10h (backend 4–5h, UI 4–5h)
**Risk**: HIGH (privacy-critical)

---

#### PH10-T02.14: Legal Documents, Consent, Cookies APIs + Admin UI

**Objective**: Complete legal document, consent tracking, and cookie policy management

**Backend Scope**:
- API: `GET /admin/legal/documents` → list legal documents (terms, privacy, etc.)
- API: `POST /admin/legal/documents` → create/update legal document (RBAC: `admin_super`)
- API: `GET /admin/legal/consent` → consent tracking by user, document, date
- API: `GET /admin/legal/cookies` → cookie policy, categorization
- API: `POST /admin/legal/cookies` → update cookie policy (RBAC: `admin_super`)
- API: `GET /admin/legal/tokushoho` → Japan-specific legal (tokushoho) tracking
- API: `GET /admin/legal/retention` → data retention policy and enforcement status
- All mutations RBAC: `admin_super`
- All mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/legal/`):
- `/legal/documents` → document management (terms, privacy, last updated, actions)
- `/legal/consent` → consent analytics (acceptance rate by document)
- `/legal/cookies` → cookie policy editor, category management
- `/legal/tokushoho` → Japan legal compliance tracking
- `/legal/retention` → retention policy, cleanup logs

**Acceptance Criteria** (Backend):
- [ ] 7 endpoints implemented
- [ ] RBAC enforcement (admin_super)
- [ ] Mutations audit-logged
- [ ] Tests verify behavior

**Acceptance Criteria** (UI):
- [ ] 5 scaffold pages replaced with production UI
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 12–14h (backend 6–7h, UI 6–7h)
**Risk**: HIGH (legal/compliance)

---

### GROUP 7: Monetization (8 scaffold items)

**Scope**: Plans, entitlements, quotas, subscriptions, billing, refunds, provider config, webhook DLQ
**Owner**: bjt-backend (API) + bjt-admin-ui (UI) + bjt-security (billing review)
**Risk**: HIGH (revenue operations, billing logic)
**Blocker**: None (independent)

#### PH10-T02.15: Monetization Plans, Entitlements, Quotas APIs + Admin UI

**Objective**: Complete subscription plan, entitlement, and quota management

**Backend Scope**:
- API: `GET /admin/monetization/plans` → list subscription plans
- API: `POST /admin/monetization/plans` → create plan (RBAC: `admin_super`)
- API: `PATCH /admin/monetization/plans/:id` → update plan (RBAC: `admin_super`)
- API: `GET /admin/monetization/entitlements` → list entitlements by plan
- API: `POST /admin/monetization/entitlements` → assign entitlement (RBAC: `admin_super`)
- API: `GET /admin/monetization/quotas` → list quota rules
- API: `POST /admin/monetization/quotas` → create quota rule (RBAC: `admin_super`)
- All mutations RBAC: `admin_super`
- All mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/monetization/`):
- `/monetization/plans` → plan management (name, price, features, actions)
- `/monetization/entitlements` → entitlement assignment (plan, feature, limit)
- `/monetization/quotas` → quota rules (resource, limit, duration, actions)

**Acceptance Criteria** (Backend):
- [ ] 7 endpoints implemented
- [ ] RBAC enforcement (admin_super)
- [ ] Mutations audit-logged
- [ ] Tests verify behavior

**Acceptance Criteria** (UI):
- [ ] 3 scaffold pages replaced with production UI
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 12–14h (backend 6–7h, UI 6–7h)
**Risk**: HIGH (billing-critical)

---

#### PH10-T02.16: Billing, Subscriptions, Webhooks APIs + Admin UI

**Objective**: Complete billing event tracking, subscription management, and webhook DLQ

**Backend Scope**:
- API: `GET /admin/monetization/subscriptions` → list user subscriptions (active, cancelled)
- API: `PATCH /admin/monetization/subscriptions/:id` → update subscription (RBAC: `admin_super`)
- API: `GET /admin/monetization/billing-events` → billing event log (charges, refunds, etc.)
- API: `GET /admin/monetization/refunds` → refund requests
- API: `POST /admin/monetization/refunds/:id/approve` → approve refund (RBAC: `admin_super`)
- API: `GET /admin/monetization/provider-config` → payment provider config
- API: `PATCH /admin/monetization/provider-config` → update provider config (RBAC: `admin_super`)
- API: `GET /admin/monetization/webhook-dlq` → failed webhook events, retry
- All mutations RBAC: `admin_super`
- All mutations audit-logged

**Admin UI Scope** (`apps/admin/app/[locale]/monetization/`):
- `/monetization/subscriptions` → subscription management (user, plan, status, actions)
- `/monetization/billing-events` → billing event log (date, amount, type, status)
- `/monetization/refunds` → refund queue (user, amount, reason, approve/reject buttons)
- `/monetization/provider-config` → provider settings (keys redacted)
- `/monetization/webhook-dlq` → failed webhook dashboard, retry button

**Acceptance Criteria** (Backend):
- [ ] 8 endpoints implemented
- [ ] RBAC enforcement (admin_super)
- [ ] Mutations audit-logged
- [ ] Tests verify behavior

**Acceptance Criteria** (UI):
- [ ] 5 scaffold pages replaced with production UI
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 14–16h (backend 7–8h, UI 7–8h)
**Risk**: HIGH (billing-critical)

---

### GROUP 8: Analytics (4 scaffold items)

**Scope**: Growth analytics, learning analytics, content analytics, system analytics
**Owner**: bjt-admin-ui (lead) + bjt-backend
**Risk**: MEDIUM (analytics data, no write operations)
**Blocker**: None (independent)

#### PH10-T02.17: Analytics Dashboards APIs + Admin UI

**Objective**: Complete analytics dashboards (growth, learning, content, system)

**Backend Scope**:
- API: `GET /admin/analytics/growth` → growth metrics (DAU, WAU, retention, LTV projection)
- API: `GET /admin/analytics/bjt` → BJT analytics (quiz attempts, avg score, pass rate)
- API: `GET /admin/analytics/learning` → learning analytics (path completion, SRS stats)
- API: `GET /admin/analytics/content` → content usage (popular items, engagement)
- API: `GET /admin/analytics/system` → system metrics (uptime, error rate, response time)
- All endpoints RBAC: `admin_ops` (read-only)

**Admin UI Scope** (`apps/admin/app/[locale]/analytics/`):
- `/analytics/growth` → growth dashboard (charts, cohort tables, trends)
- `/analytics/bjt` → BJT performance dashboard (score distribution, topic breakdown)
- `/analytics/learning` → learning analytics (completion funnel, SRS health)
- `/analytics/content` → content usage dashboard (top items, engagement metrics)
- `/analytics/system` → system health dashboard (uptime, error rate, latency)

**Acceptance Criteria** (Backend):
- [ ] 5 endpoints implemented
- [ ] RBAC enforcement (admin_ops, read-only)
- [ ] Tests verify behavior

**Acceptance Criteria** (UI):
- [ ] 5 scaffold pages replaced with production UI
- [ ] Real data from APIs (not fake charts)
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 12–14h (backend 4–5h, UI 8–9h)
**Risk**: MEDIUM

---

### GROUP 9: Growth & Social (4 scaffold items, optional if battle disabled)

**Scope**: Referrals, postcards, campaigns, social sharing
**Owner**: bjt-admin-ui (lead) + bjt-backend
**Risk**: MEDIUM
**Blocker**: None (independent)

#### PH10-T02.18: Growth & Referral Management APIs + Admin UI

**Objective**: Complete referral tracking, postcards, and campaign management

**Backend Scope**:
- API: `GET /admin/growth/referrals` → referral metrics (referrer, referred count, conversions)
- API: `GET /admin/growth/postcards` → postcard usage (shares, impressions, conversions)
- API: `POST /admin/growth/campaigns` → create growth campaign (RBAC: `admin_growth`)
- API: `GET /admin/growth/campaigns` → list active campaigns
- API: `GET /admin/growth/social` → social sharing analytics
- All mutations RBAC: `admin_growth`

**Admin UI Scope** (`apps/admin/app/[locale]/growth/`):
- `/growth/referrals` → referral dashboard (top referrers, conversion metrics)
- `/growth/postcards` → postcard analytics (template, impressions, CTR)
- `/growth/campaigns` → campaign management (active, schedule, performance)
- `/growth/social` → social share analytics (platform, engagement)

**Acceptance Criteria** (Backend):
- [ ] 5 endpoints implemented
- [ ] RBAC enforcement (admin_growth)
- [ ] Tests verify behavior

**Acceptance Criteria** (UI):
- [ ] 4 scaffold pages replaced with production UI
- [ ] Real data from APIs
- [ ] i18n keys used
- [ ] Admin page production gate passes

**Estimated Hours**: 10–12h (backend 4–5h, UI 6–7h)
**Risk**: MEDIUM

---

### GROUP 10: Battle (5 scaffold items, FEATURE-FLAGGED, OPTIONAL)

**Scope**: Battle config, bots, matches, leaderboard, abuse management
**Owner**: bjt-admin-ui + bjt-backend + bjt-security
**Risk**: HIGH (game operations, anti-cheat)
**Blocker**: None (feature-flagged, lower priority)
**Feature Flag**: `NEXT_PUBLIC_ADMIN_FEATURE_FLAGS='{"adminNav.battle":false}'` to disable in MVP

#### PH10-T02.19: Battle Admin APIs + Admin UI (OPTIONAL, PHASE-11+)

**Note**: This task is **optional for MVP**. Disabled by default via feature flag. Can be completed in PHASE-11 or later.

**Objective** (if enabled): Complete battle configuration, bot management, match tracking, leaderboard, and abuse reports

**Scope**:
- Battle config: bot difficulty, match parameters, reward scaling
- Bot management: bot profiles, training status
- Match tracking: active matches, replay storage
- Leaderboard: ranking, score reset events
- Abuse reports: cheating flags, player suspensions

**Estimated Hours** (if enabled): 14–16h (backend 7–8h, UI 7–8h)
**Risk**: HIGH (game balance, anti-cheat)

**Status**: SKIPPED for MVP; added to PHASE-11 backlog

---

## Summary Table

| Task ID | Group | Title | Backend h | UI h | Risk | Blocker |
|---|---|---|---|---|---|---|
| T02.1 | Infrastructure | RBAC Framework | 6–8 | — | MEDIUM | none |
| T02.2 | Infrastructure | Audit Log Framework | 6–8 | — | MEDIUM | none |
| T02.3 | Infrastructure | API Registry | 4–6 | — | LOW | none |
| T02.4 | System/Ops | Health & Queue Monitoring | 6–7 | 4–5 | HIGH | 1–3 |
| T02.5 | System/Ops | Feature Flags & Kill Switches | 4–5 | 4–5 | HIGH | 1–3 |
| T02.6 | System/Ops | Import & Failed Jobs | 4–5 | 4–5 | MEDIUM | 1–3 |
| T02.7 | IAM | Roles, Permissions, Admins | 6–7 | 6–7 | HIGH | 1 |
| T02.8 | Content | Versions, Enrichment, i18n | 5–6 | 5–6 | MEDIUM | none |
| T02.9 | Assessment | Quiz & Question Bank | 6–7 | 6–7 | HIGH | none |
| T02.10 | Assessment | Mock Exams & Remediation | 4–5 | 4–5 | MEDIUM | none |
| T02.11 | Learning | Paths, Templates, Competencies | 6–7 | 6–7 | MEDIUM | none |
| T02.12 | Users/Support | User 360 & Support Notes | 5–6 | 5–6 | HIGH | none |
| T02.13 | Users/Support | Privacy & Data Export | 4–5 | 4–5 | HIGH | none |
| T02.14 | Legal | Documents, Consent, Cookies | 6–7 | 6–7 | HIGH | none |
| T02.15 | Monetization | Plans, Entitlements, Quotas | 6–7 | 6–7 | HIGH | none |
| T02.16 | Monetization | Billing, Subscriptions, Webhooks | 7–8 | 7–8 | HIGH | 15 |
| T02.17 | Analytics | Growth/Learning/System Dashboards | 4–5 | 8–9 | MEDIUM | none |
| T02.18 | Growth | Referrals, Postcards, Campaigns | 4–5 | 6–7 | MEDIUM | none |
| T02.19 | Battle | Battle Admin (OPTIONAL) | 7–8 | 7–8 | HIGH | DISABLED |

---

## Execution Strategy & Sequencing

### Phase 1: Foundation (PH10-T02.1–2.3) — ~16–20h

**Sequential**: RBAC → Audit → API Registry (each prerequisite for Groups 2+)

- **Start**: Immediately
- **Est. completion**: Day 1–2
- **Gate**: RBAC/audit/API contracts verified before task groups 2–9

### Phase 2: System & Operations (PH10-T02.4–2.6) — ~26–32h

**Can run in parallel**: Health/Queues, Feature Flags, Import Management

- **Start**: After Phase 1 complete
- **Est. completion**: Day 3–4
- **Gate**: All operational endpoints live, RBAC/audit verified

### Phase 3: Access Control & Content (PH10-T02.7–2.8) — ~22–26h

**Can run in parallel**: IAM, Content Management

- **Start**: After Phase 2 (IAM blocks users, but can start early)
- **Est. completion**: Day 5
- **Gate**: IAM roles deployed, content APIs live

### Phase 4: Learning & Assessment (PH10-T02.9–2.11) — ~32–38h

**Can run in parallel**: Quiz/QBank, Mock/Remediation, Paths/Competencies

- **Start**: After Phase 2 operational baseline
- **Est. completion**: Day 6–8
- **Gate**: Assessment endpoints live, quiz integrity verified

### Phase 5: User Management & Legal (PH10-T02.12–2.14) — ~30–36h

**Can run in parallel**: User 360, Privacy, Legal

- **Start**: After Phase 2
- **Est. completion**: Day 9–10
- **Gate**: Privacy boundary verified, legal compliance confirmed

### Phase 6: Monetization (PH10-T02.15–2.16) — ~26–30h

**Sequential**: Plans/Quotas → Billing/Subscriptions (billing depends on plan setup)

- **Start**: After Phase 1
- **Est. completion**: Day 11–12
- **Gate**: Billing integrity verified by security review

### Phase 7: Analytics & Growth (PH10-T02.17–2.18) — ~22–26h

**Can run in parallel**: Analytics, Growth

- **Start**: After Phase 2
- **Est. completion**: Day 13–14
- **Gate**: Data accuracy verified, no fake charts

### Phase 8: Battle Admin (PH10-T02.19, OPTIONAL) — 14–16h

**Status**: DISABLED by default for MVP, deferred to PHASE-11

---

## Recommended Task Ownership

### Owner Assignments

| Task Group | Primary Owner | Reviewer | QA | Security Review |
|---|---|---|---|---|
| Infrastructure | bjt-backend | bjt-release-director | bjt-qa | bjt-security |
| System/Ops | bjt-backend + bjt-admin-ui | bjt-qa | bjt-qa | — |
| IAM | bjt-backend + bjt-security | bjt-security | bjt-qa | bjt-security |
| Content | bjt-backend + bjt-admin-ui | bjt-qa | bjt-qa | — |
| Assessment | bjt-backend + bjt-admin-ui + bjt-assessment-psychometrics | bjt-assessment-psychometrics | bjt-qa | — |
| Learning | bjt-backend + bjt-admin-ui | bjt-qa | bjt-qa | — |
| Users/Support | bjt-admin-ui + bjt-backend + bjt-security | bjt-security | bjt-qa | bjt-security |
| Legal | bjt-admin-ui + bjt-backend | bjt-security | bjt-qa | bjt-security |
| Monetization | bjt-backend + bjt-admin-ui + bjt-security | bjt-security | bjt-qa | bjt-security |
| Analytics | bjt-admin-ui + bjt-backend | bjt-qa | bjt-qa | — |
| Growth | bjt-admin-ui + bjt-backend | bjt-qa | bjt-qa | — |
| Battle (Optional) | bjt-admin-ui + bjt-backend + bjt-security | bjt-security | bjt-qa | bjt-security |

---

## Budget & Risk Summary

### Total Estimated Effort

- **Infrastructure**: 16–22h
- **System/Ops**: 26–32h
- **IAM**: 12–14h
- **Content**: 10–12h
- **Assessment & Learning**: 32–38h
- **Users, Support, Legal**: 30–36h
- **Monetization**: 26–30h
- **Analytics & Growth**: 22–26h
- **Battle (OPTIONAL)**: 14–16h

**MVP Total (excluding Battle)**: 174–220h estimated implementation + review/testing

**With Battle**: 188–236h

### Risk Assessment

| Level | Count | Tasks | Mitigation |
|---|---|---|---|
| HIGH | 9 | Health/Ops, RBAC/Audit, IAM, Assessment, User/Privacy, Legal, Monetization, Battle | Small focused tasks; layered gates; no-fake enforcement |
| MEDIUM | 6 | Content, Mock/Remediation, Learning, Analytics, Growth | Standard gates; real data verification |
| LOW | 1 | API Registry | Documentation only |

### No-Fake Enforcement

All 59 scaffold pages will be replaced with production UIs connected to **real APIs** with:
- ✅ Real database persistence (PostgreSQL via Prisma)
- ✅ RBAC enforcement on all admin writes
- ✅ Audit logging on all mutations
- ✅ DTO validation on all inputs
- ✅ OpenAPI contracts
- ✅ Real data (no hardcoded/seeded fake data in production code)
- ✅ Loading, error, degraded, permission-denied states
- ✅ i18n for all user-facing text

---

## Battle Feature Flag Strategy — Recommended Action

### Current State
`adminNav.battle` feature flag is **ENABLED by default** (omitted keys default to enabled).

### Recommendation: OPTION 2 (MVP Path)

**Action**: Set environment variable in production:
```bash
NEXT_PUBLIC_ADMIN_FEATURE_FLAGS='{"adminNav.battle":false}'
```

**Effect**:
- 5 battle admin nav items hidden from admin users
- Zero admin scaffold items remaining (54/54 core routes complete)
- Production readiness gate clears
- Battle admin can be completed in PHASE-11 or later

**Rationale**:
1. Battle is lower priority per user guidance (social/motivation category)
2. Allows MVP launch without battle admin completion
3. Battle feature flag can be toggled without codebase changes
4. Team capacity better spent on core learning flows (quiz, flashcards, reading assist)

---

## Gate & Verification Commands

### Build & Type Check
```bash
pnpm --filter @nihongo-bjt/admin typecheck
pnpm --filter @nihongo-bjt/api typecheck
pnpm --filter @nihongo-bjt/admin build
```

### Test Coverage
```bash
# Admin RBAC tests
pnpm vitest apps/api/src/admin/admin.controller.*.test.ts

# Audit log tests
pnpm vitest apps/api/src/admin/admin-audit*.test.ts

# Integration tests (APIs + audit)
pnpm vitest apps/api/src/admin/ --run
```

### OpenAPI Generation
```bash
pnpm --filter @nihongo-bjt/api openapi:generate
```

### Admin Scaffold Count
```bash
# Should be 0 by phase end
grep -c 'renderAdminScaffoldForId' apps/admin/app/**/page.tsx
```

### Nav Status
```bash
# Should be 0 by phase end
grep -c 'status: "scaffold"' apps/admin/lib/admin-nav-data.ts
```

---

## Phase Completion Criteria

✅ **Production-Ready**: Phase 10 is complete when:

1. [ ] All 54 core scaffold routes replaced with production pages
2. [ ] Battle disabled via feature flag OR all 5 battle routes completed
3. [ ] Zero `renderAdminScaffoldForId` calls in enabled routes
4. [ ] Zero enabled nav items marked `status: "scaffold"`
5. [ ] All admin writes have RBAC + audit logging
6. [ ] All admin mutations tested and verified
7. [ ] OpenAPI generation passes without errors
8. [ ] Admin 100% completion gate passes
9. [ ] Browser/visual QA evidence for all changed pages
10. [ ] `company/admin-module-inventory.md` updated with production status

---

## Approval & Next Steps

**Status**: Plan ready for Boss Agent approval

**Human Options**:
- ✅ **APPROVE PLAN** → Proceed to task execution (prompt 29_boss_run_phase_batch)
- ⚠️ **REQUEST CHANGES** → Specify concerns/modifications needed
- ⛔ **REJECT PLAN** → Return to planning, will not execute

**Next Action** (if approved):
1. Human approves plan
2. Run `.github/prompts/29_boss_run_phase_batch.prompt.md` with battle flag disabled
3. Execute tasks 1–18 (or 1–19 if battle enabled) in dependency order
4. Update PHASE_TASK_REPORT.md after each task group
5. At phase end, run `.github/prompts/42_phase_review_and_close.prompt.md` for Release Director final gate

---

## Files to Create/Update

### New Files
- `company/PHASE_10_T02_PLAN.md` (this file)

### Files to Update During Execution
- `company/CURRENT_PHASE.md`
- `company/PHASE_HANDOFF.md`
- `company/PHASE_TASK_REPORT.md`
- `company/PHASE_RISK_LOG.md`
- `company/admin-module-inventory.md`
- `company/backlog.md`
- `company/project-state.md`

---

**End of PHASE-10-T02 Plan**
