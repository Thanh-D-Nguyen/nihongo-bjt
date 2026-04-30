# Canonical API Registry

## Shared Snapshot (BJT-101)

- Snapshot date: 2026-04-29 JST
- Scope: docs-only convergence against current backend artifacts and route evidence.
- Evidence basis: `docs/openapi.json`, `apps/api/src/openapi/openapi-generation.test.ts`, `docs/CURSOR_BACKEND_API_HANDOFF.md`, `docs/BACKEND_API_PRODUCTION_CHECKLIST.md`
- Confidence: partial (evidence-backed docs reconciliation; no new runtime verification in this task)

## Shared Status Legend

- `complete`: canonical v15 family exists on current backend routes and is usable.
- `partial`: family exists but is incomplete (missing sub-endpoints, DTO/schema depth, tests, or full enforcement).
- `missing`: family is not production-ready in the current backend snapshot.

## Endpoint Family Status (Converged)

| Family | Status | Notes |
|---|---|---|
| `/api/auth/profile` | complete | Canonical profile sync/read/update is implemented. |
| `/api/dictionary/*`, `/api/kanji/*`, `/api/grammar/*`, `/api/examples/*`, `/api/vija/search` | partial | Canonical aliases exist; response/test maturity still incomplete. |
| `/api/bookmarks/*` | partial | Implemented with persistence; list hydration/contract depth still pending. |
| `/api/decks/*`, `/api/review/*` | partial | Canonical aliases implemented; review submit now returns persisted, exam-safe remediation metadata (`reviewEventId`, `remediation.sourceId`, `remediation.sourceType`, `remediation.sourceIdKind`, `remediationPolicy.availability=after_answer`), while deck CRUD/presets and broader contract depth remain pending. |
| `/api/flashcards/cards/:id/images/*` | partial | Upload/link exists; provenance-license metadata is now required before linking, while external search/select remains incomplete. |
| `/api/admin/operations/feature-flags/*` | partial | List/update exists with RBAC + audit; rollout/runtime enforcement still maturing. |
| `/api/admin/operations/kill-switches/*` | partial | List/update exists with RBAC + audit; propagation/runtime enforcement still pending. |
| `/api/admin/operations/dead-letter-queue/*` | partial | List/resolve/discard exists; retry worker integration still pending. |
| `/api/legal/*`, `/api/consent/*` | partial | Baseline consent status/accept APIs are implemented; broader legal/privacy family is still incomplete. |
| `/api/privacy/*` | partial | Privacy requests exist via learner routes; canonical prefix alignment still pending. |
| `/api/auth/oauth/*`, `/api/referrals/*`, `/api/share/*` | partial | Real flows exist mostly under legacy/adjacent prefixes. |
| `/api/admin/imports/*`, `/api/admin/notifications/*` | missing | Admin APIs not production-ready in current snapshot. |

## Explicit Gate Evidence Links

- OpenAPI snapshot: `docs/openapi.json`
- OpenAPI generation test: `apps/api/src/openapi/openapi-generation.test.ts`
- Backend handoff evidence: `docs/CURSOR_BACKEND_API_HANDOFF.md`
- Production checklist evidence: `docs/BACKEND_API_PRODUCTION_CHECKLIST.md`

Current-truth note: family-level `complete|partial|missing` in the converged table above is authoritative for this snapshot.

Release-decision rule:
- Use only the converged family table in this document for current status decisions.
- Do not infer release readiness from historical notes in other docs without cross-checking this table.

Every endpoint must include DTOs, validation, OpenAPI decorators, auth requirement, permission requirement where admin-only, and auditable writes where applicable.

## Admin Infrastructure Registry (PHASE-10 Days 3-5)

- Admin endpoints tracked: 83
- Registry source: `apps/api/src/admin/admin-openapi.schema.ts`
- Snapshot metadata: `packages/database/admin-api-registry.json`
- OpenAPI extensions required per admin operation: `x-admin-group`, `x-admin-requires`, `x-admin-controller`, `x-admin-test-file`

| Method | Path | Group | Controller | RBAC | Test |
|---|---|---|---|---|---|
| GET | /api/admin/session | admin_core | AdminController | `iam.manage`, `support.user.read` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| GET | /api/admin/me | admin_core | AdminController | `iam.manage`, `support.user.read` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| GET | /api/admin/module-contracts | admin_core | AdminController | `iam.manage`, `admin.content.read`, `support.user.read` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| GET | /api/admin/content/summary | admin_core | AdminController | `admin.content.read` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| POST | /api/admin/lexemes/:id/examples | admin_core | AdminController | `admin.content.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| PATCH | /api/admin/lexemes/:id/examples/:linkId | admin_core | AdminController | `admin.content.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| DELETE | /api/admin/lexemes/:id/examples/:linkId | admin_core | AdminController | `admin.content.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| GET | /api/admin/content | admin_core | AdminController | `admin.content.read` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| POST | /api/admin/content | admin_core | AdminController | `admin.content.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| PATCH | /api/admin/content/:type/:id/status | admin_core | AdminController | `admin.content.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| PATCH | /api/admin/content/:type/:id | admin_core | AdminController | `admin.content.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| GET | /api/admin/users/kpis | admin_core | AdminController | `support.user.read`, `support.user.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| GET | /api/admin/users | admin_core | AdminController | `support.user.read`, `support.user.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| GET | /api/admin/users/:id/audit | admin_core | AdminController | `support.user.read`, `support.user.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| GET | /api/admin/users/:id | admin_core | AdminController | `support.user.read`, `support.user.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| PATCH | /api/admin/users/:id/status | admin_core | AdminController | `support.user.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| PATCH | /api/admin/users/:id/plan | admin_core | AdminController | `admin.monetization.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| POST | /api/admin/users/:id/support-notes | admin_core | AdminController | `support.user.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| POST | /api/admin/users/invite | admin_core | AdminController | `admin.users.create`, `user.create`, `support.user.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| POST | /api/admin/users | admin_core | AdminController | `support.user.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| GET | /api/admin/audit | admin_core | AdminController | `viewer.audit` | apps/api/src/admin/admin.repository.privacy-boundary.test.ts |
| GET | /api/admin/reading-assist/reports | admin_core | AdminController | `admin.content.read` | apps/api/src/admin/admin.repository.privacy-boundary.test.ts |
| GET | /api/admin/operations/feature-flags | operations | OperationsController | `iam.manage`, `viewer.audit` | apps/api/src/operations/operations.controller.rbac.test.ts |
| PATCH | /api/admin/operations/feature-flags/:key | operations | OperationsController | `iam.manage` | apps/api/src/operations/operations.controller.rbac.test.ts |
| GET | /api/admin/operations/kill-switches | operations | OperationsController | `iam.manage`, `viewer.audit` | apps/api/src/operations/operations.controller.rbac.test.ts |
| PATCH | /api/admin/operations/kill-switches/:key | operations | OperationsController | `iam.manage` | apps/api/src/operations/operations.controller.rbac.test.ts |
| GET | /api/admin/operations/dead-letter-queue | operations | OperationsController | `iam.manage`, `viewer.audit` | apps/api/src/operations/operations.controller.rbac.test.ts |
| PATCH | /api/admin/operations/dead-letter-queue/:id | operations | OperationsController | `iam.manage` | apps/api/src/operations/operations.controller.rbac.test.ts |
| GET | /api/admin/operations/import-staging/errors | operations | OperationsController | `iam.manage`, `viewer.audit` | apps/api/src/operations/operations.controller.rbac.test.ts |
| PATCH | /api/admin/operations/import-staging/errors/:id/dead-letter | operations | OperationsController | `iam.manage` | apps/api/src/operations/operations.controller.rbac.test.ts |
| PATCH | /api/admin/operations/search-rebuild | operations | OperationsController | `iam.manage` | apps/api/src/operations/operations.controller.rbac.test.ts |
| GET | /api/admin/analytics | analytics | AdminAnalyticsController | `viewer.analytics`, `admin.analytics.view`, `analytics.view` | apps/api/src/growth/growth-admin.controller.referral-share-analytics.test.ts |
| GET | /api/admin/growth/share-templates | growth | GrowthAdminController | `admin.growth.read` | apps/api/src/growth/growth-admin.controller.referral-share-analytics.test.ts |
| GET | /api/admin/growth/referral-share-analytics | growth | GrowthAdminController | `admin.growth.read` | apps/api/src/growth/growth-admin.controller.referral-share-analytics.test.ts |
| POST | /api/admin/growth/share-template/preview | growth | GrowthAdminController | `admin.growth.read` | apps/api/src/growth/growth-admin.controller.referral-share-analytics.test.ts |
| GET | /api/admin/daily/widgets | daily | AdminDailyController | `admin.content.read` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| PATCH | /api/admin/daily/widgets/:id | daily | AdminDailyController | `admin.content.write` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| GET | /api/admin/legal/policies | legal | LegalPolicyAdminController | `admin.legal.read`, `admin.legal.write`, `legal.admin` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| POST | /api/admin/legal/policies | legal | LegalPolicyAdminController | `admin.legal.write`, `legal.admin` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| PATCH | /api/admin/legal/policies/:id/publish | legal | LegalPolicyAdminController | `admin.legal.write`, `legal.admin` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| PATCH | /api/admin/legal/policies/:id/archive | legal | LegalPolicyAdminController | `admin.legal.write`, `legal.admin` | apps/api/src/admin/admin.controller.user-detail-privacy.test.ts |
| GET | /api/admin/monetization/summary | monetization | MonetizationAdminController | `admin.monetization.read` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| GET | /api/admin/monetization/overview | monetization | MonetizationAdminController | `admin.monetization.read` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| GET | /api/admin/monetization/analytics | monetization | MonetizationAdminController | `admin.monetization.read`, `revenue.analytics.view` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| GET | /api/admin/monetization/audit | monetization | MonetizationAdminController | `admin.monetization.read`, `monetization.audit.view` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| GET | /api/admin/monetization/plans | monetization | MonetizationAdminController | `billing.plan.view`, `admin.monetization.read` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| POST | /api/admin/monetization/plans | monetization | MonetizationAdminController | `billing.plan.manage`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| PATCH | /api/admin/monetization/plans/:id | monetization | MonetizationAdminController | `billing.plan.manage`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| GET | /api/admin/monetization/entitlements | monetization | MonetizationAdminController | `billing.entitlement.view`, `admin.monetization.read` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| POST | /api/admin/monetization/entitlements | monetization | MonetizationAdminController | `billing.entitlement.manage`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| POST | /api/admin/monetization/plans/:planId/entitlements | monetization | MonetizationAdminController | `billing.entitlement.manage`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| DELETE | /api/admin/monetization/plans/:planId/entitlements/:entitlementId | monetization | MonetizationAdminController | `billing.entitlement.manage`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| GET | /api/admin/monetization/quotas | monetization | MonetizationAdminController | `billing.quota.view`, `admin.monetization.read` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| POST | /api/admin/monetization/quotas/policies | monetization | MonetizationAdminController | `billing.quota.manage`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| PATCH | /api/admin/monetization/quotas/policies/:id | monetization | MonetizationAdminController | `billing.quota.manage`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| POST | /api/admin/monetization/quotas/plan-links | monetization | MonetizationAdminController | `billing.quota.manage`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| GET | /api/admin/monetization/quota-overrides | monetization | MonetizationAdminController | `billing.quota.override`, `admin.monetization.read` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| POST | /api/admin/monetization/quota-overrides | monetization | MonetizationAdminController | `billing.quota.override`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| DELETE | /api/admin/monetization/quota-overrides/:id | monetization | MonetizationAdminController | `billing.quota.override`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| GET | /api/admin/monetization/subscriptions | monetization | MonetizationAdminController | `billing.subscription.view`, `admin.monetization.read` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| PATCH | /api/admin/monetization/subscriptions/:id | monetization | MonetizationAdminController | `billing.subscription.manage`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| GET | /api/admin/monetization/coupons | monetization | MonetizationAdminController | `billing.coupon.view`, `admin.monetization.read` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| POST | /api/admin/monetization/coupons | monetization | MonetizationAdminController | `billing.coupon.manage`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| PATCH | /api/admin/monetization/coupons/:id | monetization | MonetizationAdminController | `billing.coupon.manage`, `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| GET | /api/admin/monetization/ads/placements | monetization | MonetizationAdminController | `admin.monetization.read`, `ads.placement.view` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| PATCH | /api/admin/monetization/ads/placements/:id | monetization | MonetizationAdminController | `admin.monetization.write`, `ads.placement.manage` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| PATCH | /api/admin/monetization/dev/users/:userId/plan | monetization | MonetizationAdminController | `admin.monetization.write` | apps/api/src/monetization/monetization-admin.controller.rbac.test.ts |
| POST | /api/admin/billing/webhook | billing_webhook | BillingWebhookController | `admin.monetization.write`, `billing.webhook.manage` | apps/api/src/monetization/billing/billing-webhook.service.security.test.ts |
| GET | /api/admin/billing/webhook | billing_webhook | BillingWebhookController | `admin.monetization.read`, `billing.webhook.read` | apps/api/src/monetization/billing/billing-webhook.service.security.test.ts |
| GET | /api/admin/billing/webhook/:id/raw | billing_webhook | BillingWebhookController | `admin.monetization.write`, `billing.webhook.manage` | apps/api/src/monetization/billing/billing-webhook.service.security.test.ts |
| GET | /api/admin/ads/overview | ads | AdsAdminController | `admin.monetization.read`, `ads.overview.view` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| GET | /api/admin/ads/placements | ads | AdsAdminController | `ads.placement.view`, `admin.monetization.read` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| POST | /api/admin/ads/placements | ads | AdsAdminController | `ads.placement.manage`, `admin.monetization.write` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| PATCH | /api/admin/ads/placements/:id | ads | AdsAdminController | `ads.placement.manage`, `admin.monetization.write` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| GET | /api/admin/ads/campaigns | ads | AdsAdminController | `ads.campaign.view`, `admin.monetization.read` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| POST | /api/admin/ads/campaigns | ads | AdsAdminController | `ads.campaign.manage`, `admin.monetization.write` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| PATCH | /api/admin/ads/campaigns/:id | ads | AdsAdminController | `ads.campaign.manage`, `admin.monetization.write` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| GET | /api/admin/ads/providers | ads | AdsAdminController | `ads.provider.view`, `admin.monetization.read` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| PATCH | /api/admin/ads/providers/:key | ads | AdsAdminController | `ads.provider.manage`, `admin.monetization.write` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| GET | /api/admin/ads/rules | ads | AdsAdminController | `ads.rule.view`, `admin.monetization.read` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| POST | /api/admin/ads/rules | ads | AdsAdminController | `ads.rule.manage`, `admin.monetization.write` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| GET | /api/admin/ads/performance | ads | AdsAdminController | `ads.performance.view`, `admin.monetization.read` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
| GET | /api/admin/ads/audit | ads | AdsAdminController | `ads.audit.view`, `viewer.audit` | apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts |
