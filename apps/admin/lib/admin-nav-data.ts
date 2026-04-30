import type { AdminNavGroupDefinition, AdminNavItemDefinition } from "@nihongo-bjt/ui";

import type { NavIconName } from "./admin-nav-icons";

const item = (i: {
  activeMatch?: "exact" | "prefix";
  featureFlag?: string;
  featureOffBehavior?: "hide" | "disabled";
  href: string;
  icon: NavIconName;
  id: string;
  labelKey: string;
  permissions?: string | string[];
  status: AdminNavItemDefinition["status"];
}): AdminNavItemDefinition => ({
  activeMatch: i.activeMatch,
  featureFlag: i.featureFlag,
  featureOffBehavior: i.featureOffBehavior,
  href: i.href,
  icon: i.icon,
  id: i.id,
  labelKey: i.labelKey,
  permissions: i.permissions,
  status: i.status
});

const group = (g: {
  defaultExpanded?: boolean;
  id: string;
  items: AdminNavItemDefinition[];
  labelKey: string;
  sectionCollapsible: boolean;
}): AdminNavGroupDefinition => ({
  defaultExpanded: g.defaultExpanded,
  id: g.id,
  items: g.items,
  labelKey: g.labelKey,
  sectionCollapsible: g.sectionCollapsible
});

/** Canonical v15-aligned nav; `href` is the path after locale (must start with `/`). */
export const ADMIN_NAV_DATA: AdminNavGroupDefinition[] = [
  group({
    id: "overview",
    items: [
      item({ href: "/", icon: "home", id: "ov.home", labelKey: "shell.navItems.overview", status: "implemented" }),
      item({
        href: "/system/health",
        icon: "cog",
        id: "ov.systemHealth",
        labelKey: "shell.navItems.systemHealth",
        permissions: ["admin.analytics.view", "viewer.analytics", "analytics.view"],
        status: "implemented"
      }),
      item({
        href: "/system/queue-health",
        icon: "queue",
        id: "ov.queueHealth",
        labelKey: "shell.navItems.queueHealth",
        permissions: ["admin.analytics.view", "viewer.analytics", "analytics.view"],
        status: "implemented"
      }),
      item({
        href: "/system/search-sync",
        icon: "search",
        id: "ov.searchSync",
        labelKey: "shell.navItems.searchSync",
        permissions: ["admin.content.read", "admin.analytics.view", "viewer.analytics"],
        status: "implemented"
      }),
      item({
        href: "/system/release",
        icon: "cog",
        id: "ov.release",
        labelKey: "shell.navItems.release",
        permissions: ["iam.manage"],
        status: "implemented"
      })
    ],
    labelKey: "shell.navGroups.overview",
    sectionCollapsible: false
  }),
  group({
    id: "content",
    defaultExpanded: false,
    items: [
      item({ href: "/content", icon: "book", id: "cm.overview", labelKey: "shell.navItems.contentOverview", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/dictionary", icon: "book", id: "cm.dictionary", labelKey: "shell.navItems.dictionary", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/kanji", icon: "book", id: "cm.kanji", labelKey: "shell.navItems.kanji", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/grammar", icon: "book", id: "cm.grammar", labelKey: "shell.navItems.grammar", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/media", icon: "book", id: "cm.media", labelKey: "shell.navItems.media", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/content/versions", icon: "queue", id: "cm.versions", labelKey: "shell.navItems.contentVersions", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/content/enrichment", icon: "bolt", id: "cm.enrichment", labelKey: "shell.navItems.enrichment", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/i18n", icon: "cog", id: "cm.i18n", labelKey: "shell.navItems.i18n", permissions: ["admin.content.read", "iam.manage"], status: "implemented" })
    ],
    labelKey: "shell.navGroups.content",
    sectionCollapsible: true
  }),
  group({
    id: "learning",
    defaultExpanded: false,
    items: [
      item({ href: "/daily-hub", icon: "academic", id: "ln.daily", labelKey: "shell.navItems.dailyHub", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/decks", icon: "book", id: "ln.decks", labelKey: "shell.navItems.decks", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/flashcards/templates", icon: "book", id: "ln.templates", labelKey: "shell.navItems.flashcardTemplates", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/flashcards/generated", icon: "book", id: "ln.generated", labelKey: "shell.navItems.generatedCards", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/reading-assist", icon: "search", id: "ln.reading", labelKey: "shell.navItems.readingAssist", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/learning/paths", icon: "academic", id: "ln.paths", labelKey: "shell.navItems.learningPaths", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/learning/competencies", icon: "academic", id: "ln.competencies", labelKey: "shell.navItems.competencies", permissions: ["admin.content.read"], status: "implemented" })
    ],
    labelKey: "shell.navGroups.learning",
    sectionCollapsible: true
  }),
  group({
    id: "assessment",
    defaultExpanded: false,
    items: [
      item({ href: "/bjt", icon: "academic", id: "as.bjt", labelKey: "shell.navItems.bjt", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/assessment/quiz-templates", icon: "book", id: "as.quizTemplates", labelKey: "shell.navItems.quizTemplates", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/assessment/question-bank", icon: "book", id: "as.qbank", labelKey: "shell.navItems.questionBank", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/assessment/quiz-sessions", icon: "queue", id: "as.sessions", labelKey: "shell.navItems.quizSessions", permissions: ["admin.content.read", "admin.analytics.view", "viewer.analytics"], status: "implemented" }),
      item({ href: "/assessment/mock-exams", icon: "academic", id: "as.mock", labelKey: "shell.navItems.mockExams", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/assessment/remediation", icon: "bolt", id: "as.remediation", labelKey: "shell.navItems.remediation", permissions: ["admin.content.read"], status: "implemented" })
    ],
    labelKey: "shell.navGroups.assessment",
    sectionCollapsible: true
  }),
  group({
    id: "battle",
    defaultExpanded: false,
    items: [
      item({
        href: "/battle/configs",
        icon: "bolt",
        id: "bt.configs",
        labelKey: "shell.navItems.battleConfigs",
        permissions: ["admin.content.read"],
        status: "implemented"
      }),
      item({
        href: "/battle/bots",
        icon: "cog",
        id: "bt.bots",
        labelKey: "shell.navItems.battleBots",
        permissions: ["admin.content.read"],
        status: "implemented"
      }),
      item({
        href: "/battle/matches",
        icon: "chart",
        id: "bt.matches",
        labelKey: "shell.navItems.battleMatches",
        permissions: ["admin.content.read", "admin.analytics.view", "viewer.analytics"],
        status: "implemented"
      }),
      item({
        href: "/battle/leaderboard",
        icon: "chart",
        id: "bt.leader",
        labelKey: "shell.navItems.battleLeaderboard",
        permissions: ["admin.content.read", "admin.analytics.view", "viewer.analytics"],
        status: "implemented"
      }),
      item({
        href: "/battle/abuse",
        icon: "shield",
        id: "bt.abuse",
        labelKey: "shell.navItems.battleAbuse",
        permissions: ["iam.manage", "support.user.read"],
        status: "implemented"
      })
    ],
    labelKey: "shell.navGroups.battle",
    sectionCollapsible: true
  }),
  group({
    id: "users",
    defaultExpanded: false,
    items: [
      item({
        activeMatch: "exact",
        href: "/users",
        icon: "user",
        id: "u.users",
        labelKey: "shell.navItems.users",
        permissions: ["support.user.read", "support.user.write", "support.user"],
        status: "implemented"
      }),
      item({
        href: "/users/360",
        icon: "user",
        id: "u.360",
        labelKey: "shell.navItems.user360",
        permissions: ["support.user.read", "support.user.write", "support.user"],
        status: "implemented"
      }),
      item({ href: "/support/notes", icon: "book", id: "u.notes", labelKey: "shell.navItems.supportNotes", permissions: ["support.user.write", "support.user.read"], status: "implemented" }),
      item({ href: "/privacy/requests", icon: "shield", id: "u.privacy", labelKey: "shell.navItems.privacyRequests", permissions: ["support.user.read", "iam.manage"], status: "implemented" }),
      item({ href: "/privacy/data-requests", icon: "shield", id: "u.export", labelKey: "shell.navItems.dataRequests", permissions: ["support.user.read", "iam.manage"], status: "implemented" })
    ],
    labelKey: "shell.navGroups.users",
    sectionCollapsible: true
  }),
  group({
    id: "analytics",
    defaultExpanded: false,
    items: [
      item({
        activeMatch: "exact",
        href: "/analytics",
        icon: "chart",
        id: "an.exec",
        labelKey: "shell.navItems.executive",
        permissions: ["viewer.analytics", "admin.analytics.view", "analytics.view"],
        status: "implemented"
      }),
      item({ href: "/analytics/growth", icon: "chart", id: "an.growth", labelKey: "shell.navItems.userGrowth", permissions: ["viewer.analytics", "admin.analytics.view", "analytics.view"], status: "implemented" }),
      item({ href: "/analytics/learning", icon: "chart", id: "an.learning", labelKey: "shell.navItems.learningAnalytics", permissions: ["viewer.analytics", "admin.analytics.view", "analytics.view"], status: "implemented" }),
      item({ href: "/analytics/content", icon: "chart", id: "an.content", labelKey: "shell.navItems.contentAnalytics", permissions: ["viewer.analytics", "admin.analytics.view", "analytics.view"], status: "implemented" }),
      item({ href: "/analytics/search", icon: "search", id: "an.search", labelKey: "shell.navItems.searchAnalytics", permissions: ["viewer.analytics", "admin.analytics.view", "analytics.view"], status: "implemented" }),
      item({ href: "/analytics/bjt", icon: "chart", id: "an.bjt", labelKey: "shell.navItems.bjtAnalytics", permissions: ["viewer.analytics", "admin.analytics.view", "analytics.view"], status: "implemented" }),
      item({ href: "/analytics/flashcards", icon: "chart", id: "an.fc", labelKey: "shell.navItems.flashcardAnalytics", permissions: ["viewer.analytics", "admin.analytics.view", "analytics.view"], status: "implemented" }),
      item({ href: "/analytics/battle", icon: "chart", id: "an.battle", labelKey: "shell.navItems.battleAnalytics", permissions: ["viewer.analytics", "admin.analytics.view", "analytics.view"], status: "implemented" }),
      item({ href: "/analytics/system", icon: "cog", id: "an.sys", labelKey: "shell.navItems.systemAnalytics", permissions: ["viewer.analytics", "admin.analytics.view", "iam.manage", "analytics.view"], status: "implemented" })
    ],
    labelKey: "shell.navGroups.analytics",
    sectionCollapsible: true
  }),
  group({
    id: "monetization",
    defaultExpanded: false,
    items: [
      item({ activeMatch: "exact", href: "/monetization", icon: "money", id: "mo.ov", labelKey: "shell.navItems.mtzOverview", permissions: ["admin.monetization.read"], status: "implemented" }),
      item({ href: "/monetization/plans", icon: "money", id: "mo.plans", labelKey: "shell.navItems.mtzPlans", permissions: ["admin.monetization.read", "billing.plan.view"], status: "implemented" }),
      item({ href: "/monetization/entitlements", icon: "money", id: "mo.ent", labelKey: "shell.navItems.mtzEntitlements", permissions: ["admin.monetization.read", "billing.entitlement.manage"], status: "implemented" }),
      item({ href: "/monetization/quotas", icon: "money", id: "mo.quo", labelKey: "shell.navItems.mtzQuotas", permissions: ["admin.monetization.read", "billing.quota.view"], status: "implemented" }),
      item({ href: "/monetization/subscriptions", icon: "money", id: "mo.sub", labelKey: "shell.navItems.mtzSubscriptions", permissions: ["admin.monetization.read", "billing.subscription.view"], status: "implemented" }),
      item({ href: "/monetization/billing-events", icon: "money", id: "mo.bill", labelKey: "shell.navItems.mtzBilling", permissions: ["admin.monetization.read", "revenue.analytics.view"], status: "implemented" }),
      item({ href: "/monetization/refunds", icon: "money", id: "mo.ref", labelKey: "shell.navItems.mtzRefunds", permissions: ["admin.monetization.write", "billing.subscription.manage"], status: "implemented" }),
      item({ href: "/ads", icon: "megaphone", id: "mo.ads", labelKey: "shell.navItems.ads", permissions: ["admin.monetization.read", "ads.placement.view"], status: "implemented" }),
      item({ href: "/monetization/provider-config", icon: "cog", id: "mo.prov", labelKey: "shell.navItems.providerConfig", permissions: ["admin.monetization.read", "ads.provider.view"], status: "implemented" }),
      item({ href: "/monetization/webhook-dlq", icon: "queue", id: "mo.dlq", labelKey: "shell.navItems.mtzWebhooks", permissions: ["admin.monetization.read", "iam.manage"], status: "implemented" })
    ],
    labelKey: "shell.navGroups.monetization",
    sectionCollapsible: true
  }),
  group({
    id: "growth",
    defaultExpanded: false,
    items: [
      item({ activeMatch: "exact", href: "/growth", icon: "megaphone", id: "gr.main", labelKey: "shell.navItems.growthOverview", permissions: ["admin.growth.read"], status: "implemented" }),
      item({ href: "/growth/social", icon: "user", id: "gr.social", labelKey: "shell.navItems.growthSocial", permissions: ["admin.growth.read", "iam.manage"], status: "implemented" }),
      item({ href: "/growth/referrals", icon: "chart", id: "gr.ref", labelKey: "shell.navItems.referrals", permissions: ["admin.growth.read"], status: "implemented" }),
      item({ href: "/growth/postcards", icon: "book", id: "gr.pc", labelKey: "shell.navItems.postcards", permissions: ["admin.growth.read"], status: "implemented" }),
      item({ href: "/growth/campaigns", icon: "megaphone", id: "gr.camp", labelKey: "shell.navItems.campaigns", permissions: ["admin.growth.read"], status: "implemented" })
    ],
    labelKey: "shell.navGroups.growth",
    sectionCollapsible: true
  }),
  group({
    id: "operations",
    defaultExpanded: false,
    items: [
      item({ href: "/ops/feature-flags", icon: "cog", id: "op.ff", labelKey: "shell.navItems.featureFlags", permissions: ["iam.manage"], status: "implemented" }),
      item({ href: "/ops/kill-switches", icon: "shield", id: "op.kill", labelKey: "shell.navItems.killSwitches", permissions: ["iam.manage"], status: "implemented" }),
      item({ href: "/ops/dead-letters", icon: "queue", id: "op.dl", labelKey: "shell.navItems.deadLetter", permissions: ["iam.manage", "admin.content.read"], status: "implemented" }),
      item({ href: "/import", icon: "queue", id: "op.import", labelKey: "shell.navItems.import", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/import/manifests", icon: "queue", id: "op.manifests", labelKey: "shell.navItems.importManifests", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/import/failed", icon: "queue", id: "op.failed", labelKey: "shell.navItems.importFailed", permissions: ["admin.content.read"], status: "implemented" }),
      item({ href: "/ops/notifications", icon: "cog", id: "op.notif", labelKey: "shell.navItems.notifications", permissions: ["iam.manage", "admin.content.read"], status: "implemented" }),
      item({ href: "/audit", icon: "shield", id: "op.audit", labelKey: "shell.navItems.audit", permissions: ["viewer.audit", "iam.manage"], status: "implemented" }),
      item({ href: "/ops/security", icon: "shield", id: "op.sec", labelKey: "shell.navItems.securityAudit", permissions: ["viewer.audit", "iam.manage"], status: "implemented" }),
      item({ href: "/settings", icon: "cog", id: "op.settings", labelKey: "shell.navItems.settings", permissions: ["iam.manage"], status: "implemented" })
    ],
    labelKey: "shell.navGroups.operations",
    sectionCollapsible: true
  }),
  group({
    id: "legal",
    defaultExpanded: false,
    items: [
      item({ href: "/legal/documents", icon: "scale", id: "lg.doc", labelKey: "shell.navItems.legalDocs", permissions: ["iam.manage"], status: "implemented" }),
      item({ href: "/legal/terms", icon: "scale", id: "lg.terms", labelKey: "shell.navItems.legalTerms", permissions: ["iam.manage"], status: "implemented" }),
      item({ href: "/legal/consent", icon: "shield", id: "lg.consent", labelKey: "shell.navItems.consent", permissions: ["iam.manage"], status: "implemented" }),
      item({ href: "/legal/cookies", icon: "shield", id: "lg.cookies", labelKey: "shell.navItems.cookies", permissions: ["iam.manage"], status: "implemented" }),
      item({ href: "/legal/tokushoho", icon: "scale", id: "lg.tt", labelKey: "shell.navItems.tokushoho", permissions: ["iam.manage"], status: "implemented" }),
      item({ href: "/legal/retention", icon: "shield", id: "lg.ret", labelKey: "shell.navItems.retention", permissions: ["iam.manage"], status: "implemented" })
    ],
    labelKey: "shell.navGroups.legal",
    sectionCollapsible: true
  }),
  group({
    id: "iam",
    defaultExpanded: false,
    items: [
      item({
        activeMatch: "exact",
        href: "/iam",
        icon: "shield",
        id: "iam.main",
        labelKey: "shell.navItems.iamOverview",
        permissions: ["iam.manage"],
        status: "implemented"
      }),
      item({
        href: "/iam/roles",
        icon: "shield",
        id: "iam.roles",
        labelKey: "shell.navItems.iamRoles",
        permissions: ["iam.manage"],
        status: "implemented"
      }),
      item({
        href: "/iam/permissions",
        icon: "shield",
        id: "iam.permissions",
        labelKey: "shell.navItems.iamPermissions",
        permissions: ["iam.manage"],
        status: "implemented"
      }),
      item({
        href: "/iam/admins",
        icon: "user",
        id: "iam.admins",
        labelKey: "shell.navItems.iamAdmins",
        permissions: ["iam.manage"],
        status: "implemented"
      }),
      item({
        href: "/iam/role-audit",
        icon: "shield",
        id: "iam.roleAudit",
        labelKey: "shell.navItems.iamRoleAudit",
        permissions: ["iam.manage"],
        status: "implemented"
      })
    ],
    labelKey: "shell.navGroups.iam",
    sectionCollapsible: true
  })
];
