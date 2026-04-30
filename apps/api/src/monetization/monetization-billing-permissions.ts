/**
 * Fine-grained billing RBAC. Legacy `admin.monetization.read` / `admin.monetization.write` remain valid.
 */
export const BILLING_PERMS = {
  readOverview: [
    "admin.monetization.read",
    "billing.overview.view",
    "revenue.analytics.view"
  ],
  readPlans: ["admin.monetization.read", "billing.plan.view"],
  managePlans: ["admin.monetization.write", "billing.plan.manage"],
  readEntitlements: ["admin.monetization.read", "billing.entitlement.manage"],
  manageEntitlements: ["admin.monetization.write", "billing.entitlement.manage"],
  readQuotas: ["admin.monetization.read", "billing.quota.view"],
  manageQuotas: ["admin.monetization.write", "billing.quota.manage"],
  overrideQuotas: ["admin.monetization.write", "billing.quota.override"],
  readSubscriptions: ["admin.monetization.read", "billing.subscription.view"],
  manageSubscriptions: ["admin.monetization.write", "billing.subscription.manage"],
  readCoupons: ["admin.monetization.read", "billing.coupon.manage"],
  manageCoupons: ["admin.monetization.write", "billing.coupon.manage"],
  readAds: ["admin.monetization.read", "ads.placement.view", "ads.performance.view"],
  manageAds: ["admin.monetization.write", "ads.placement.manage"],
  readMonetizationAudit: ["admin.monetization.read", "monetization.audit.view", "viewer.audit"]
} as const;
