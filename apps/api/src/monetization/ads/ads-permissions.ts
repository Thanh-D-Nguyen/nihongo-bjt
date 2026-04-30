/** Fine-grained ads admin RBAC. Legacy `admin.monetization.read` / `write` with `ads.*` still apply where noted. */
export const ADS_PERMS = {
  readOverview: ["admin.monetization.read", "ads.placement.view", "ads.performance.view", "ads.campaign.view"],
  managePlacements: ["admin.monetization.write", "ads.placement.manage"],
  viewPlacements: ["admin.monetization.read", "ads.placement.view"],
  manageCampaigns: ["admin.monetization.write", "ads.campaign.manage"],
  viewCampaigns: ["admin.monetization.read", "ads.campaign.view"],
  manageProviders: ["admin.monetization.write", "ads.provider.manage"],
  viewProviders: ["admin.monetization.read", "ads.provider.view"],
  manageRules: ["admin.monetization.write", "ads.rules.manage"],
  readRules: [
    "admin.monetization.read",
    "ads.placement.view",
    "ads.campaign.view",
    "ads.provider.view",
    "ads.performance.view",
    "ads.rules.manage"
  ],
  readPerformance: ["admin.monetization.read", "ads.performance.view"],
  readAudit: ["admin.monetization.read", "ads.audit.view", "viewer.audit"]
} as const;

export const ANY_ADS_READ = [
  "admin.monetization.read",
  "ads.placement.view",
  "ads.campaign.view",
  "ads.provider.view",
  "ads.performance.view"
] as const;
