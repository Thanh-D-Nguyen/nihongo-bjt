import type { OpenAPIObject } from "@nestjs/swagger";

type AdminRouteRegistryEntry = {
  controller: string;
  group:
    | "admin_core"
    | "operations"
    | "analytics"
    | "growth"
    | "daily"
    | "legal"
    | "monetization"
    | "billing_webhook"
    | "ads";
  method: "get" | "post" | "patch" | "delete";
  path: string;
  requires: readonly string[];
  testFile: string;
};

function entry(
  method: AdminRouteRegistryEntry["method"],
  path: string,
  group: AdminRouteRegistryEntry["group"],
  requires: readonly string[],
  controller: string,
  testFile: string
): AdminRouteRegistryEntry {
  return { controller, group, method, path, requires, testFile };
}

export const ADMIN_OPENAPI_ROUTE_REGISTRY: readonly AdminRouteRegistryEntry[] = [
  entry("get", "/api/admin/session", "admin_core", ["iam.manage", "support.user.read"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("get", "/api/admin/me", "admin_core", ["iam.manage", "support.user.read"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("get", "/api/admin/module-contracts", "admin_core", ["iam.manage", "admin.content.read", "support.user.read"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("get", "/api/admin/content/summary", "admin_core", ["admin.content.read"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("post", "/api/admin/lexemes/:id/examples", "admin_core", ["admin.content.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("patch", "/api/admin/lexemes/:id/examples/:linkId", "admin_core", ["admin.content.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("delete", "/api/admin/lexemes/:id/examples/:linkId", "admin_core", ["admin.content.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("get", "/api/admin/content", "admin_core", ["admin.content.read"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("post", "/api/admin/content", "admin_core", ["admin.content.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("patch", "/api/admin/content/:type/:id/status", "admin_core", ["admin.content.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("patch", "/api/admin/content/:type/:id", "admin_core", ["admin.content.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("get", "/api/admin/users/kpis", "admin_core", ["support.user.read", "support.user.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("get", "/api/admin/users", "admin_core", ["support.user.read", "support.user.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("get", "/api/admin/users/:id/audit", "admin_core", ["support.user.read", "support.user.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("get", "/api/admin/users/:id", "admin_core", ["support.user.read", "support.user.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("patch", "/api/admin/users/:id/status", "admin_core", ["support.user.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("patch", "/api/admin/users/:id/plan", "admin_core", ["admin.monetization.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("post", "/api/admin/users/:id/support-notes", "admin_core", ["support.user.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("post", "/api/admin/users/invite", "admin_core", ["admin.users.create", "user.create", "support.user.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("post", "/api/admin/users", "admin_core", ["support.user.write"], "AdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("get", "/api/admin/audit", "admin_core", ["viewer.audit"], "AdminController", "apps/api/src/admin/admin.repository.privacy-boundary.test.ts"),
  entry("get", "/api/admin/reading-assist/reports", "admin_core", ["admin.content.read"], "AdminController", "apps/api/src/admin/admin.repository.privacy-boundary.test.ts"),

  entry("get", "/api/admin/operations/feature-flags", "operations", ["iam.manage", "viewer.audit"], "OperationsController", "apps/api/src/operations/operations.controller.rbac.test.ts"),
  entry("patch", "/api/admin/operations/feature-flags/:key", "operations", ["iam.manage"], "OperationsController", "apps/api/src/operations/operations.controller.rbac.test.ts"),
  entry("get", "/api/admin/operations/kill-switches", "operations", ["iam.manage", "viewer.audit"], "OperationsController", "apps/api/src/operations/operations.controller.rbac.test.ts"),
  entry("patch", "/api/admin/operations/kill-switches/:key", "operations", ["iam.manage"], "OperationsController", "apps/api/src/operations/operations.controller.rbac.test.ts"),
  entry("get", "/api/admin/operations/dead-letter-queue", "operations", ["iam.manage", "viewer.audit"], "OperationsController", "apps/api/src/operations/operations.controller.rbac.test.ts"),
  entry("patch", "/api/admin/operations/dead-letter-queue/:id", "operations", ["iam.manage"], "OperationsController", "apps/api/src/operations/operations.controller.rbac.test.ts"),
  entry("get", "/api/admin/operations/import-staging/errors", "operations", ["iam.manage", "viewer.audit"], "OperationsController", "apps/api/src/operations/operations.controller.rbac.test.ts"),
  entry("patch", "/api/admin/operations/import-staging/errors/:id/dead-letter", "operations", ["iam.manage"], "OperationsController", "apps/api/src/operations/operations.controller.rbac.test.ts"),
  entry("patch", "/api/admin/operations/search-rebuild", "operations", ["iam.manage"], "OperationsController", "apps/api/src/operations/operations.controller.rbac.test.ts"),

  entry("get", "/api/admin/analytics", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view"], "AdminAnalyticsController", "apps/api/src/growth/growth-admin.controller.referral-share-analytics.test.ts"),

  entry("get", "/api/admin/growth/share-templates", "growth", ["admin.growth.read"], "GrowthAdminController", "apps/api/src/growth/growth-admin.controller.referral-share-analytics.test.ts"),
  entry("get", "/api/admin/growth/referral-share-analytics", "growth", ["admin.growth.read"], "GrowthAdminController", "apps/api/src/growth/growth-admin.controller.referral-share-analytics.test.ts"),
  entry("post", "/api/admin/growth/share-template/preview", "growth", ["admin.growth.read"], "GrowthAdminController", "apps/api/src/growth/growth-admin.controller.referral-share-analytics.test.ts"),

  entry("get", "/api/admin/daily/widgets", "daily", ["admin.content.read"], "AdminDailyController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("patch", "/api/admin/daily/widgets/:id", "daily", ["admin.content.write"], "AdminDailyController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),

  entry("get", "/api/admin/legal/policies", "legal", ["admin.legal.read", "admin.legal.write", "legal.admin"], "LegalPolicyAdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("post", "/api/admin/legal/policies", "legal", ["admin.legal.write", "legal.admin"], "LegalPolicyAdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("patch", "/api/admin/legal/policies/:id/publish", "legal", ["admin.legal.write", "legal.admin"], "LegalPolicyAdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),
  entry("patch", "/api/admin/legal/policies/:id/archive", "legal", ["admin.legal.write", "legal.admin"], "LegalPolicyAdminController", "apps/api/src/admin/admin.controller.user-detail-privacy.test.ts"),

  entry("get", "/api/admin/monetization/summary", "monetization", ["admin.monetization.read"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/monetization/overview", "monetization", ["admin.monetization.read"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/monetization/analytics", "monetization", ["admin.monetization.read", "revenue.analytics.view"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/monetization/audit", "monetization", ["admin.monetization.read", "monetization.audit.view"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/monetization/plans", "monetization", ["billing.plan.view", "admin.monetization.read"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/monetization/plans", "monetization", ["billing.plan.manage", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/monetization/plans/:id", "monetization", ["billing.plan.manage", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/monetization/entitlements", "monetization", ["billing.entitlement.view", "admin.monetization.read"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/monetization/entitlements", "monetization", ["billing.entitlement.manage", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/monetization/plans/:planId/entitlements", "monetization", ["billing.entitlement.manage", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("delete", "/api/admin/monetization/plans/:planId/entitlements/:entitlementId", "monetization", ["billing.entitlement.manage", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/monetization/quotas", "monetization", ["billing.quota.view", "admin.monetization.read"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/monetization/quotas/policies", "monetization", ["billing.quota.manage", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/monetization/quotas/policies/:id", "monetization", ["billing.quota.manage", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/monetization/quotas/plan-links", "monetization", ["billing.quota.manage", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/monetization/quota-overrides", "monetization", ["billing.quota.override", "admin.monetization.read"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/monetization/quota-overrides", "monetization", ["billing.quota.override", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("delete", "/api/admin/monetization/quota-overrides/:id", "monetization", ["billing.quota.override", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/monetization/subscriptions", "monetization", ["billing.subscription.view", "admin.monetization.read"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/monetization/subscriptions/:id", "monetization", ["billing.subscription.manage", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/monetization/coupons", "monetization", ["billing.coupon.view", "admin.monetization.read"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/monetization/coupons", "monetization", ["billing.coupon.manage", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/monetization/coupons/:id", "monetization", ["billing.coupon.manage", "admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/monetization/ads/placements", "monetization", ["admin.monetization.read", "ads.placement.view"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/monetization/ads/placements/:id", "monetization", ["admin.monetization.write", "ads.placement.manage"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/monetization/dev/users/:userId/plan", "monetization", ["admin.monetization.write"], "MonetizationAdminController", "apps/api/src/monetization/monetization-admin.controller.rbac.test.ts"),

  entry("post", "/api/admin/billing/webhook", "billing_webhook", ["admin.monetization.write", "billing.webhook.manage"], "BillingWebhookController", "apps/api/src/monetization/billing/billing-webhook.service.security.test.ts"),
  entry("get", "/api/admin/billing/webhook", "billing_webhook", ["admin.monetization.read", "billing.webhook.read"], "BillingWebhookController", "apps/api/src/monetization/billing/billing-webhook.service.security.test.ts"),
  entry("get", "/api/admin/billing/webhook/:id/raw", "billing_webhook", ["admin.monetization.write", "billing.webhook.manage"], "BillingWebhookController", "apps/api/src/monetization/billing/billing-webhook.service.security.test.ts"),

  entry("get", "/api/admin/ads/overview", "ads", ["admin.monetization.read", "ads.overview.view"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/ads/placements", "ads", ["ads.placement.view", "admin.monetization.read"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/ads/placements", "ads", ["ads.placement.manage", "admin.monetization.write"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/ads/placements/:id", "ads", ["ads.placement.manage", "admin.monetization.write"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/ads/campaigns", "ads", ["ads.campaign.view", "admin.monetization.read"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/ads/campaigns", "ads", ["ads.campaign.manage", "admin.monetization.write"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/ads/campaigns/:id", "ads", ["ads.campaign.manage", "admin.monetization.write"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/ads/providers", "ads", ["ads.provider.view", "admin.monetization.read"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/ads/providers/:key", "ads", ["ads.provider.manage", "admin.monetization.write"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/ads/rules", "ads", ["ads.rule.view", "admin.monetization.read"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/ads/rules", "ads", ["ads.rule.manage", "admin.monetization.write"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/ads/performance", "ads", ["ads.performance.view", "admin.monetization.read"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/ads/audit", "ads", ["ads.audit.view", "viewer.audit"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts")
] as const;

function normalizePath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

export function applyAdminOpenApiExtensions(document: OpenAPIObject): void {
  for (const route of ADMIN_OPENAPI_ROUTE_REGISTRY) {
    const pathKey = normalizePath(route.path);
    const pathItem = document.paths[pathKey] as Record<string, unknown> | undefined;
    if (!pathItem) {
      continue;
    }
    const operation = pathItem[route.method] as Record<string, unknown> | undefined;
    if (!operation) {
      continue;
    }

    (operation as Record<string, unknown>)["x-admin-group"] = route.group;
    (operation as Record<string, unknown>)["x-admin-requires"] = [...route.requires];
    (operation as Record<string, unknown>)["x-admin-controller"] = route.controller;
    (operation as Record<string, unknown>)["x-admin-test-file"] = route.testFile;
  }
}
