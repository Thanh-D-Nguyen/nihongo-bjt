import type { OpenAPIObject } from "@nestjs/swagger";

type AdminRouteRegistryEntry = {
  controller: string;
  group:
    | "admin_core"
    | "operations"
    | "analytics"
    | "growth"
    | "daily"
    | "learning"
    | "legal"
    | "monetization"
    | "billing_webhook"
    | "ads"
    | "content"
    | "assessment"
    | "media";
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

  entry("get", "/api/admin/analytics/battle/summary", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsBattleAdminController", "apps/api/src/analytics/analytics-battle-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/analytics/battle/timeseries", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsBattleAdminController", "apps/api/src/analytics/analytics-battle-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/analytics/battle/breakdown", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsBattleAdminController", "apps/api/src/analytics/analytics-battle-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/analytics/battle/export", "analytics", ["analytics.export", "analytics.manage", "admin.analytics.view", "iam.manage"], "AnalyticsBattleAdminController", "apps/api/src/analytics/analytics-battle-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/analytics/battle/refresh", "analytics", ["analytics.export", "analytics.manage", "admin.analytics.view", "iam.manage"], "AnalyticsBattleAdminController", "apps/api/src/analytics/analytics-battle-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/analytics/bjt/summary", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsBjtAdminController", "apps/api/src/analytics/analytics-bjt-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/analytics/bjt/timeseries", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsBjtAdminController", "apps/api/src/analytics/analytics-bjt-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/analytics/bjt/breakdown", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsBjtAdminController", "apps/api/src/analytics/analytics-bjt-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/analytics/bjt/export", "analytics", ["analytics.export", "analytics.manage", "admin.analytics.view", "iam.manage"], "AnalyticsBjtAdminController", "apps/api/src/analytics/analytics-bjt-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/analytics/bjt/refresh", "analytics", ["analytics.export", "analytics.manage", "admin.analytics.view", "iam.manage"], "AnalyticsBjtAdminController", "apps/api/src/analytics/analytics-bjt-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/analytics/flashcards/summary", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsFlashcardsAdminController", "apps/api/src/analytics/analytics-flashcards-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/analytics/flashcards/timeseries", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsFlashcardsAdminController", "apps/api/src/analytics/analytics-flashcards-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/analytics/flashcards/breakdown", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsFlashcardsAdminController", "apps/api/src/analytics/analytics-flashcards-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/analytics/flashcards/export", "analytics", ["analytics.export", "analytics.manage", "admin.analytics.view", "iam.manage"], "AnalyticsFlashcardsAdminController", "apps/api/src/analytics/analytics-flashcards-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/analytics/flashcards/refresh", "analytics", ["analytics.export", "analytics.manage", "admin.analytics.view", "iam.manage"], "AnalyticsFlashcardsAdminController", "apps/api/src/analytics/analytics-flashcards-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/analytics/growth/summary", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsGrowthAdminController", "apps/api/src/analytics/analytics-growth-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/analytics/growth/timeseries", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsGrowthAdminController", "apps/api/src/analytics/analytics-growth-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/analytics/growth/breakdown", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsGrowthAdminController", "apps/api/src/analytics/analytics-growth-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/analytics/growth/export", "analytics", ["analytics.export", "analytics.manage", "admin.analytics.view", "iam.manage"], "AnalyticsGrowthAdminController", "apps/api/src/analytics/analytics-growth-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/analytics/growth/refresh", "analytics", ["analytics.export", "analytics.manage", "admin.analytics.view", "iam.manage"], "AnalyticsGrowthAdminController", "apps/api/src/analytics/analytics-growth-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/analytics/system/summary", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsSystemAdminController", "apps/api/src/analytics/analytics-system-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/analytics/system/timeseries", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsSystemAdminController", "apps/api/src/analytics/analytics-system-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/analytics/system/breakdown", "analytics", ["viewer.analytics", "admin.analytics.view", "analytics.view", "viewer.audit"], "AnalyticsSystemAdminController", "apps/api/src/analytics/analytics-system-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/analytics/system/export", "analytics", ["analytics.export", "analytics.manage", "admin.analytics.view", "iam.manage"], "AnalyticsSystemAdminController", "apps/api/src/analytics/analytics-system-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/analytics/system/refresh", "analytics", ["analytics.export", "analytics.manage", "admin.analytics.view", "iam.manage"], "AnalyticsSystemAdminController", "apps/api/src/analytics/analytics-system-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/growth/share-templates", "growth", ["admin.growth.read"], "GrowthAdminController", "apps/api/src/growth/growth-admin.controller.referral-share-analytics.test.ts"),
  entry("get", "/api/admin/growth/referral-share-analytics", "growth", ["admin.growth.read"], "GrowthAdminController", "apps/api/src/growth/growth-admin.controller.referral-share-analytics.test.ts"),
  entry("post", "/api/admin/growth/share-template/preview", "growth", ["admin.growth.read"], "GrowthAdminController", "apps/api/src/growth/growth-admin.controller.referral-share-analytics.test.ts"),

  entry("get", "/api/admin/growth/campaigns", "growth", ["growth.manage", "admin.growth.read", "viewer.audit"], "GrowthCampaignsAdminController", "apps/api/src/growth/growth-campaigns-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/growth/campaigns/audience-estimate", "growth", ["growth.manage", "admin.growth.read", "viewer.audit"], "GrowthCampaignsAdminController", "apps/api/src/growth/growth-campaigns-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/growth/campaigns/:id", "growth", ["growth.manage", "admin.growth.read", "viewer.audit"], "GrowthCampaignsAdminController", "apps/api/src/growth/growth-campaigns-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/campaigns", "growth", ["growth.manage"], "GrowthCampaignsAdminController", "apps/api/src/growth/growth-campaigns-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/growth/campaigns/:id", "growth", ["growth.manage"], "GrowthCampaignsAdminController", "apps/api/src/growth/growth-campaigns-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/campaigns/:id/schedule", "growth", ["growth.manage"], "GrowthCampaignsAdminController", "apps/api/src/growth/growth-campaigns-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/campaigns/:id/activate", "growth", ["growth.manage"], "GrowthCampaignsAdminController", "apps/api/src/growth/growth-campaigns-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/campaigns/:id/end", "growth", ["growth.manage"], "GrowthCampaignsAdminController", "apps/api/src/growth/growth-campaigns-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/campaigns/:id/archive", "growth", ["growth.manage"], "GrowthCampaignsAdminController", "apps/api/src/growth/growth-campaigns-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/campaigns/:id/duplicate", "growth", ["growth.manage"], "GrowthCampaignsAdminController", "apps/api/src/growth/growth-campaigns-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/growth/postcards", "growth", ["growth.manage", "admin.growth.read", "viewer.audit"], "GrowthPostcardsAdminController", "apps/api/src/growth/growth-postcards-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/growth/postcards/:id", "growth", ["growth.manage", "admin.growth.read", "viewer.audit"], "GrowthPostcardsAdminController", "apps/api/src/growth/growth-postcards-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/postcards", "growth", ["growth.manage"], "GrowthPostcardsAdminController", "apps/api/src/growth/growth-postcards-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/growth/postcards/:id", "growth", ["growth.manage"], "GrowthPostcardsAdminController", "apps/api/src/growth/growth-postcards-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/postcards/:id/publish", "growth", ["growth.manage"], "GrowthPostcardsAdminController", "apps/api/src/growth/growth-postcards-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/postcards/:id/archive", "growth", ["growth.manage"], "GrowthPostcardsAdminController", "apps/api/src/growth/growth-postcards-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/growth/referrals", "growth", ["growth.manage", "admin.growth.read", "viewer.audit"], "GrowthReferralsAdminController", "apps/api/src/growth/growth-referrals-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/growth/referrals/:id", "growth", ["growth.manage", "admin.growth.read", "viewer.audit"], "GrowthReferralsAdminController", "apps/api/src/growth/growth-referrals-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/referrals/:id/revoke", "growth", ["growth.manage"], "GrowthReferralsAdminController", "apps/api/src/growth/growth-referrals-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/growth/social/templates", "growth", ["growth.manage", "admin.growth.read", "viewer.audit"], "GrowthSocialAdminController", "apps/api/src/growth/growth-social-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/growth/social/templates/:id", "growth", ["growth.manage", "admin.growth.read", "viewer.audit"], "GrowthSocialAdminController", "apps/api/src/growth/growth-social-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/social/templates", "growth", ["growth.manage"], "GrowthSocialAdminController", "apps/api/src/growth/growth-social-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/growth/social/templates/:id", "growth", ["growth.manage"], "GrowthSocialAdminController", "apps/api/src/growth/growth-social-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/social/templates/:id/publish", "growth", ["growth.manage"], "GrowthSocialAdminController", "apps/api/src/growth/growth-social-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/social/templates/:id/archive", "growth", ["growth.manage"], "GrowthSocialAdminController", "apps/api/src/growth/growth-social-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/growth/social/events", "growth", ["growth.manage", "admin.growth.read", "viewer.audit"], "GrowthSocialAdminController", "apps/api/src/growth/growth-social-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/growth/social/events/:id/moderate", "growth", ["growth.manage"], "GrowthSocialAdminController", "apps/api/src/growth/growth-social-admin.controller.rbac.test.ts"),

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
  entry("get", "/api/admin/ads/audit", "ads", ["ads.audit.view", "viewer.audit"], "AdsAdminController", "apps/api/src/monetization/ads/ads-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/content/enrichment", "content", ["admin.content.write", "admin.content.read", "viewer.audit"], "ContentEnrichmentAdminController", "apps/api/src/content/content-enrichment-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/content/enrichment/:id", "content", ["admin.content.write", "admin.content.read", "viewer.audit"], "ContentEnrichmentAdminController", "apps/api/src/content/content-enrichment-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/content/enrichment/:id/retry", "content", ["admin.content.write"], "ContentEnrichmentAdminController", "apps/api/src/content/content-enrichment-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/content/enrichment/:id/cancel", "content", ["admin.content.write"], "ContentEnrichmentAdminController", "apps/api/src/content/content-enrichment-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/content/enrichment/bulk-retry", "content", ["admin.content.write"], "ContentEnrichmentAdminController", "apps/api/src/content/content-enrichment-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/content/versions", "content", ["admin.content.write", "admin.content.read", "viewer.audit"], "ContentVersionsAdminController", "apps/api/src/content/content-versions-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/content/versions/diff", "content", ["admin.content.write", "admin.content.read", "viewer.audit"], "ContentVersionsAdminController", "apps/api/src/content/content-versions-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/content/versions/:id", "content", ["admin.content.write", "admin.content.read", "viewer.audit"], "ContentVersionsAdminController", "apps/api/src/content/content-versions-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/content/:contentId/versions", "content", ["admin.content.write", "admin.content.read", "viewer.audit"], "ContentVersionsAdminController", "apps/api/src/content/content-versions-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/content/versions/:id/revert", "content", ["admin.content.write"], "ContentVersionsAdminController", "apps/api/src/content/content-versions-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/assessment/mock-exams", "assessment", ["assessment.manage", "assessment.review", "viewer.audit"], "MockExamsAdminController", "apps/api/src/assessment/mock-exams-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/assessment/mock-exams/:id", "assessment", ["assessment.manage", "assessment.review", "viewer.audit"], "MockExamsAdminController", "apps/api/src/assessment/mock-exams-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/mock-exams", "assessment", ["assessment.manage"], "MockExamsAdminController", "apps/api/src/assessment/mock-exams-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/assessment/mock-exams/:id", "assessment", ["assessment.manage"], "MockExamsAdminController", "apps/api/src/assessment/mock-exams-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/mock-exams/:id/publish", "assessment", ["assessment.manage"], "MockExamsAdminController", "apps/api/src/assessment/mock-exams-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/mock-exams/:id/archive", "assessment", ["assessment.manage"], "MockExamsAdminController", "apps/api/src/assessment/mock-exams-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/mock-exams/:id/duplicate", "assessment", ["assessment.manage"], "MockExamsAdminController", "apps/api/src/assessment/mock-exams-admin.controller.rbac.test.ts"),
  entry("delete", "/api/admin/assessment/mock-exams/:id", "assessment", ["assessment.manage"], "MockExamsAdminController", "apps/api/src/assessment/mock-exams-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/assessment/quiz-templates", "assessment", ["assessment.manage", "assessment.review", "viewer.audit"], "QuizTemplatesAdminController", "apps/api/src/assessment/quiz-templates-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/assessment/quiz-templates/:id", "assessment", ["assessment.manage", "assessment.review", "viewer.audit"], "QuizTemplatesAdminController", "apps/api/src/assessment/quiz-templates-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/quiz-templates", "assessment", ["assessment.manage"], "QuizTemplatesAdminController", "apps/api/src/assessment/quiz-templates-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/assessment/quiz-templates/:id", "assessment", ["assessment.manage"], "QuizTemplatesAdminController", "apps/api/src/assessment/quiz-templates-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/quiz-templates/:id/publish", "assessment", ["assessment.manage"], "QuizTemplatesAdminController", "apps/api/src/assessment/quiz-templates-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/quiz-templates/:id/archive", "assessment", ["assessment.manage"], "QuizTemplatesAdminController", "apps/api/src/assessment/quiz-templates-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/quiz-templates/:id/duplicate", "assessment", ["assessment.manage"], "QuizTemplatesAdminController", "apps/api/src/assessment/quiz-templates-admin.controller.rbac.test.ts"),
  entry("delete", "/api/admin/assessment/quiz-templates/:id", "assessment", ["assessment.manage"], "QuizTemplatesAdminController", "apps/api/src/assessment/quiz-templates-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/assessment/question-bank", "assessment", ["assessment.manage", "assessment.review", "viewer.audit"], "QuestionBankAdminController", "apps/api/src/assessment/question-bank-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/assessment/question-bank/:id", "assessment", ["assessment.manage", "assessment.review", "viewer.audit"], "QuestionBankAdminController", "apps/api/src/assessment/question-bank-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/question-bank", "assessment", ["assessment.manage"], "QuestionBankAdminController", "apps/api/src/assessment/question-bank-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/assessment/question-bank/:id", "assessment", ["assessment.manage"], "QuestionBankAdminController", "apps/api/src/assessment/question-bank-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/question-bank/bulk", "assessment", ["assessment.manage"], "QuestionBankAdminController", "apps/api/src/assessment/question-bank-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/question-bank/:id/suggest-edit", "assessment", ["assessment.manage", "assessment.review"], "QuestionBankAdminController", "apps/api/src/assessment/question-bank-admin.controller.rbac.test.ts"),
  entry("delete", "/api/admin/assessment/question-bank/:id", "assessment", ["assessment.manage"], "QuestionBankAdminController", "apps/api/src/assessment/question-bank-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/assessment/quiz-sessions", "assessment", ["assessment.manage", "assessment.review", "viewer.audit"], "QuizSessionsAdminController", "apps/api/src/assessment/quiz-sessions-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/assessment/quiz-sessions/:id", "assessment", ["assessment.manage", "assessment.review", "viewer.audit"], "QuizSessionsAdminController", "apps/api/src/assessment/quiz-sessions-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/quiz-sessions/:id/abort", "assessment", ["assessment.manage"], "QuizSessionsAdminController", "apps/api/src/assessment/quiz-sessions-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/quiz-sessions/:id/extend-time", "assessment", ["assessment.manage"], "QuizSessionsAdminController", "apps/api/src/assessment/quiz-sessions-admin.controller.rbac.test.ts"),

  entry("get", "/api/admin/assessment/remediation/rules", "assessment", ["assessment.manage", "assessment.review", "viewer.audit"], "RemediationAdminController", "apps/api/src/assessment/remediation-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/assessment/remediation/rules/:id", "assessment", ["assessment.manage", "assessment.review", "viewer.audit"], "RemediationAdminController", "apps/api/src/assessment/remediation-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/remediation/rules", "assessment", ["assessment.manage"], "RemediationAdminController", "apps/api/src/assessment/remediation-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/assessment/remediation/rules/:id", "assessment", ["assessment.manage"], "RemediationAdminController", "apps/api/src/assessment/remediation-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/remediation/rules/:id/enable", "assessment", ["assessment.manage"], "RemediationAdminController", "apps/api/src/assessment/remediation-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/assessment/remediation/rules/:id/disable", "assessment", ["assessment.manage"], "RemediationAdminController", "apps/api/src/assessment/remediation-admin.controller.rbac.test.ts"),
  entry("delete", "/api/admin/assessment/remediation/rules/:id", "assessment", ["assessment.manage"], "RemediationAdminController", "apps/api/src/assessment/remediation-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/assessment/remediation/triggers", "assessment", ["assessment.manage", "assessment.review", "viewer.audit"], "RemediationAdminController", "apps/api/src/assessment/remediation-admin.controller.rbac.test.ts"),

  // Learning paths
  entry("get", "/api/admin/learning/paths", "learning", ["admin.content.read", "admin.content.write", "viewer.audit"], "LearningPathsAdminController", "apps/api/src/learning/learning-paths-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/learning/paths/:id", "learning", ["admin.content.read", "admin.content.write", "viewer.audit"], "LearningPathsAdminController", "apps/api/src/learning/learning-paths-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/learning/paths", "learning", ["admin.content.write"], "LearningPathsAdminController", "apps/api/src/learning/learning-paths-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/learning/paths/:id", "learning", ["admin.content.write"], "LearningPathsAdminController", "apps/api/src/learning/learning-paths-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/learning/paths/:id/publish", "learning", ["admin.content.write"], "LearningPathsAdminController", "apps/api/src/learning/learning-paths-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/learning/paths/:id/archive", "learning", ["admin.content.write"], "LearningPathsAdminController", "apps/api/src/learning/learning-paths-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/learning/paths/:id/duplicate", "learning", ["admin.content.write"], "LearningPathsAdminController", "apps/api/src/learning/learning-paths-admin.controller.rbac.test.ts"),
  entry("delete", "/api/admin/learning/paths/:id", "learning", ["admin.content.write"], "LearningPathsAdminController", "apps/api/src/learning/learning-paths-admin.controller.rbac.test.ts"),

  // Competencies
  entry("get", "/api/admin/learning/competencies", "learning", ["admin.content.read", "admin.content.write", "viewer.audit"], "CompetenciesAdminController", "apps/api/src/learning/learning-competencies-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/learning/competencies/:id", "learning", ["admin.content.read", "admin.content.write", "viewer.audit"], "CompetenciesAdminController", "apps/api/src/learning/learning-competencies-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/learning/competencies", "learning", ["admin.content.write"], "CompetenciesAdminController", "apps/api/src/learning/learning-competencies-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/learning/competencies/:id", "learning", ["admin.content.write"], "CompetenciesAdminController", "apps/api/src/learning/learning-competencies-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/learning/competencies/:id/publish", "learning", ["admin.content.write"], "CompetenciesAdminController", "apps/api/src/learning/learning-competencies-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/learning/competencies/:id/archive", "learning", ["admin.content.write"], "CompetenciesAdminController", "apps/api/src/learning/learning-competencies-admin.controller.rbac.test.ts"),
  entry("delete", "/api/admin/learning/competencies/:id", "learning", ["admin.content.write"], "CompetenciesAdminController", "apps/api/src/learning/learning-competencies-admin.controller.rbac.test.ts"),

  // Learning Review (spaced repetition admin)
  entry("get", "/api/admin/learning/review/summary", "learning", ["admin.content.read", "admin.content.write", "viewer.audit"], "LearningReviewAdminController", "apps/api/src/learning/learning-review-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/learning/review/retention-curve", "learning", ["admin.content.read", "admin.content.write", "viewer.audit"], "LearningReviewAdminController", "apps/api/src/learning/learning-review-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/learning/review/problem-cards", "learning", ["admin.content.read", "admin.content.write", "viewer.audit"], "LearningReviewAdminController", "apps/api/src/learning/learning-review-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/learning/review/cards/:id", "learning", ["admin.content.read", "admin.content.write", "viewer.audit"], "LearningReviewAdminController", "apps/api/src/learning/learning-review-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/learning/review/cards/:id/force-reintroduce", "learning", ["admin.content.write"], "LearningReviewAdminController", "apps/api/src/learning/learning-review-admin.controller.rbac.test.ts"),

  // Daily content items
  entry("get", "/api/admin/daily/items", "daily", ["admin.content.read", "admin.content.write", "viewer.audit"], "DailyItemsAdminController", "apps/api/src/daily/daily-items-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/daily/items/:id", "daily", ["admin.content.read", "admin.content.write", "viewer.audit"], "DailyItemsAdminController", "apps/api/src/daily/daily-items-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/daily/items", "daily", ["admin.content.write"], "DailyItemsAdminController", "apps/api/src/daily/daily-items-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/daily/items/:id", "daily", ["admin.content.write"], "DailyItemsAdminController", "apps/api/src/daily/daily-items-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/daily/items/:id/schedule", "daily", ["admin.content.write"], "DailyItemsAdminController", "apps/api/src/daily/daily-items-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/daily/items/:id/publish", "daily", ["admin.content.write"], "DailyItemsAdminController", "apps/api/src/daily/daily-items-admin.controller.rbac.test.ts"),
  entry("post", "/api/admin/daily/items/:id/archive", "daily", ["admin.content.write"], "DailyItemsAdminController", "apps/api/src/daily/daily-items-admin.controller.rbac.test.ts"),
  entry("delete", "/api/admin/daily/items/:id", "daily", ["admin.content.write"], "DailyItemsAdminController", "apps/api/src/daily/daily-items-admin.controller.rbac.test.ts"),

  // BJT overview dashboard (read-only)
  entry("get", "/api/admin/bjt/summary", "analytics", ["analytics.view", "admin.analytics.view", "viewer.analytics", "viewer.audit", "assessment.manage", "assessment.review"], "BjtDashboardAdminController", "apps/api/src/assessment/bjt-dashboard-admin.controller.rbac.test.ts"),

  // Media library admin
  entry("get", "/api/admin/media", "media", ["admin.content.read", "admin.content.write", "iam.manage", "viewer.audit"], "MediaAdminController", "apps/api/src/media/media-admin.controller.rbac.test.ts"),
  entry("get", "/api/admin/media/:id", "media", ["admin.content.read", "admin.content.write", "iam.manage", "viewer.audit"], "MediaAdminController", "apps/api/src/media/media-admin.controller.rbac.test.ts"),
  entry("patch", "/api/admin/media/:id/metadata", "media", ["admin.content.write", "iam.manage"], "MediaAdminController", "apps/api/src/media/media-admin.controller.rbac.test.ts"),
  entry("delete", "/api/admin/media/:id", "media", ["admin.content.write", "iam.manage"], "MediaAdminController", "apps/api/src/media/media-admin.controller.rbac.test.ts")
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
