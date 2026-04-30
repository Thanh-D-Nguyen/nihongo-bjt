/**
 * Non-user-facing technical strings: API path hints (spec §10.1) and permission code hints.
 * Titles and sidebar labels come from the same i18n keys as `admin-nav-data`.
 */
export type AdminScaffoldSpec = {
  api: string;
  id: string;
  /** same as AdminNavItemDefinition.labelKey for page title = sidebar */
  labelKey: string;
  /**
   * Human-readable list of **codes**; nav shows items when user has any one (OR) — this line lists them for ops.
   */
  permissions: string;
};

export const ADMIN_SCAFFOLD_SPEC: Record<string, AdminScaffoldSpec> = {
  "ov.systemHealth": {
    id: "ov.systemHealth",
    labelKey: "shell.navItems.systemHealth",
    api: "GET /admin/ops/health* · live/ready/version (align with §6 ops health; registry §10.1).",
    permissions: "admin.analytics.view | viewer.analytics | analytics.view"
  },
  "ov.queueHealth": {
    id: "ov.queueHealth",
    labelKey: "shell.navItems.queueHealth",
    api: "BullMQ/Redis queue metrics via admin operations surface (see §7 jobs; §10.1 extensions).",
    permissions: "admin.analytics.view | viewer.analytics | analytics.view"
  },
  "ov.searchSync": {
    id: "ov.searchSync",
    labelKey: "shell.navItems.searchSync",
    api: "Meilisearch index sync; content projection rebuilds (search is not SOT — §0).",
    permissions: "admin.content.read | admin.analytics.view | viewer.analytics"
  },
  "ov.release": {
    id: "ov.release",
    labelKey: "shell.navItems.release",
    api: "GET /version or app build info endpoint; deployment metadata (§6).",
    permissions: "iam.manage"
  },
  "cm.versions": {
    id: "cm.versions",
    labelKey: "shell.navItems.contentVersions",
    api: "GET/POST /admin/content-versions/* (spec §10.1 additional registry).",
    permissions: "admin.content.read | editor.exam (versioning as implemented)"
  },
  "cm.enrichment": {
    id: "cm.enrichment",
    labelKey: "shell.navItems.enrichment",
    api: "GET/POST /admin/enrichment* (registry lines 932–934).",
    permissions: "admin.content.read | editor.enrichment"
  },
  "cm.i18n": {
    id: "cm.i18n",
    labelKey: "shell.navItems.i18n",
    api: "Content/i18n admin endpoints under /admin/… (i18n center; coordinate with i18n module).",
    permissions: "admin.content.read | iam.manage"
  },
  "ln.templates": {
    id: "ln.templates",
    labelKey: "shell.navItems.flashcardTemplates",
    api: "Flashcard template CRUD under admin learning/flashcard domain; templates §12.1.",
    permissions: "admin.content.read | editor.exam (when mapped)"
  },
  "ln.generated": {
    id: "ln.generated",
    labelKey: "shell.navItems.generatedCards",
    api: "Generated/user/system cards; tie to card factory & SRS (§12).",
    permissions: "admin.content.read"
  },
  "ln.paths": {
    id: "ln.paths",
    labelKey: "shell.navItems.learningPaths",
    api: "GET/POST /admin/learning-paths/* (spec §10.1; §29).",
    permissions: "admin.content.read | editor.exam (if mapped to paths)"
  },
  "ln.competencies": {
    id: "ln.competencies",
    labelKey: "shell.navItems.competencies",
    api: "Competency model under learning admin (see learning paths §29, competencies when implemented).",
    permissions: "admin.content.read"
  },
  "as.quizTemplates": {
    id: "as.quizTemplates",
    labelKey: "shell.navItems.quizTemplates",
    api: "GET/POST /admin/quiz/templates (registry line 925–926).",
    permissions: "admin.content.read | editor.exam"
  },
  "as.qbank": {
    id: "as.qbank",
    labelKey: "shell.navItems.questionBank",
    api: "GET/POST /admin/quiz/questions (registry line 927–928).",
    permissions: "admin.content.read | editor.exam"
  },
  "as.sessions": {
    id: "as.sessions",
    labelKey: "shell.navItems.quizSessions",
    api: "Quiz session/attempts analytics & admin; tie to assessment storage (BJT module).",
    permissions: "admin.content.read | admin.analytics.view | viewer.analytics"
  },
  "as.mock": {
    id: "as.mock",
    labelKey: "shell.navItems.mockExams",
    api: "Mock exam paper definitions & scheduling; uses quiz/BJT pipeline.",
    permissions: "admin.content.read | editor.exam"
  },
  "as.remediation": {
    id: "as.remediation",
    labelKey: "shell.navItems.remediation",
    api: "Remediation/review links; analytics-driven; tie to learning recommendations.",
    permissions: "admin.content.read"
  },
  "bt.configs": {
    id: "bt.configs",
    labelKey: "shell.navItems.battleConfigs",
    api: "GET /admin/battle/configs (registry line 929) — battle §11.",
    permissions: "admin.content.read"
  },
  "bt.bots": {
    id: "bt.bots",
    labelKey: "shell.navItems.battleBots",
    api: "Bot profiles / tuning; room & fairness §11.4; Redis + PostgreSQL.",
    permissions: "admin.content.read"
  },
  "bt.matches": {
    id: "bt.matches",
    labelKey: "shell.navItems.battleMatches",
    api: "Match history, abandonment, PvE/PvP results (Socket.IO + persistence).",
    permissions: "admin.content.read | admin.analytics.view | viewer.analytics"
  },
  "bt.leader": {
    id: "bt.leader",
    labelKey: "shell.navItems.battleLeaderboard",
    api: "Public-safe leaderboard config & aggregates (privacy rules §6).",
    permissions: "admin.content.read | admin.analytics.view | viewer.analytics"
  },
  "bt.abuse": {
    id: "bt.abuse",
    labelKey: "shell.navItems.battleAbuse",
    api: "Cheat / abuse signal review; support + security; audit (§4 admin).",
    permissions: "iam.manage | support.user.read"
  },
  "u.360": {
    id: "u.360",
    labelKey: "shell.navItems.user360",
    api: "GET /admin/users/:id* profile 360, learning & billing views (user admin module).",
    permissions: "support.user.read | support.user.write | support.user"
  },
  "u.notes": {
    id: "u.notes",
    labelKey: "shell.navItems.supportNotes",
    api: "Internal support notes; protect PII; audit on write.",
    permissions: "support.user.write | support.user.read"
  },
  "u.privacy": {
    id: "u.privacy",
    labelKey: "shell.navItems.privacyRequests",
    api: "GET/POST /privacy/* admin handling (spec §10.1 privacy; §21.11).",
    permissions: "support.user.read | iam.manage"
  },
  "u.export": {
    id: "u.export",
    labelKey: "shell.navItems.dataRequests",
    api: "Data export & deletion / anonymization request workflow (GDPR-style; §6).",
    permissions: "support.user.read | iam.manage"
  },
  "an.growth": {
    id: "an.growth",
    labelKey: "shell.navItems.userGrowth",
    api: "GET /admin/analytics* cohorts, signups, funnels (registry line 937).",
    permissions: "viewer.analytics | admin.analytics.view | analytics.view"
  },
  "an.bjt": {
    id: "an.bjt",
    labelKey: "shell.navItems.bjtAnalytics",
    api: "BJT/drill-down aggregates; tie to event log & rollups (not fake charts).",
    permissions: "viewer.analytics | admin.analytics.view | analytics.view"
  },
  "an.fc": {
    id: "an.fc",
    labelKey: "shell.navItems.flashcardAnalytics",
    api: "SRS/flashcard practice aggregates; event pipeline.",
    permissions: "viewer.analytics | admin.analytics.view | analytics.view"
  },
  "an.battle": {
    id: "an.battle",
    labelKey: "shell.navItems.battleAnalytics",
    api: "Battle event aggregates; tie to match & fairness metrics.",
    permissions: "viewer.analytics | admin.analytics.view | analytics.view"
  },
  "an.sys": {
    id: "an.sys",
    labelKey: "shell.navItems.systemAnalytics",
    api: "System usage, error budgets, cost signals (with IAM-gated drill-down).",
    permissions: "viewer.analytics | admin.analytics.view | analytics.view | iam.manage"
  },
  "mo.plans": {
    id: "mo.plans",
    labelKey: "shell.navItems.mtzPlans",
    api: "GET/POST /admin/monetization/plans* (spec §10.1 / §26).",
    permissions: "admin.monetization.read | billing.plan.view"
  },
  "mo.ent": {
    id: "mo.ent",
    labelKey: "shell.navItems.mtzEntitlements",
    api: "Entitlements; central entitlement service (§9 rules).",
    permissions: "admin.monetization.read | billing.entitlement.manage"
  },
  "mo.quo": {
    id: "mo.quo",
    labelKey: "shell.navItems.mtzQuotas",
    api: "Quota policies & usage counters; enforcement server-side.",
    permissions: "admin.monetization.read | billing.quota.view"
  },
  "mo.sub": {
    id: "mo.sub",
    labelKey: "shell.navItems.mtzSubscriptions",
    api: "Subscriptions & subscription events; Prisma models (monetization baseline).",
    permissions: "admin.monetization.read | billing.subscription.view"
  },
  "mo.bill": {
    id: "mo.bill",
    labelKey: "shell.navItems.mtzBilling",
    api: "Invoice/payment event placeholders; provider abstraction.",
    permissions: "admin.monetization.read | revenue.analytics.view"
  },
  "mo.ref": {
    id: "mo.ref",
    labelKey: "shell.navItems.mtzRefunds",
    api: "Refunds & billing adjustments; audit + RBAC.",
    permissions: "admin.monetization.write | billing.subscription.manage"
  },
  "mo.prov": {
    id: "mo.prov",
    labelKey: "shell.navItems.providerConfig",
    api: "Billing/ad provider config; no secrets in UI (server-side only).",
    permissions: "admin.monetization.read | ads.provider.view"
  },
  "mo.dlq": {
    id: "mo.dlq",
    labelKey: "shell.navItems.mtzWebhooks",
    api: "Webhook dead-letters; replay tooling (align with operations DLQ).",
    permissions: "admin.monetization.read | iam.manage"
  },
  "gr.social": {
    id: "gr.social",
    labelKey: "shell.navItems.growthSocial",
    api: "OAuth /auth/oauth/* provider table (spec §10.1, §27).",
    permissions: "admin.growth.read | iam.manage"
  },
  "gr.ref": {
    id: "gr.ref",
    labelKey: "shell.navItems.referrals",
    api: "GET/POST /referrals/*; entitlement hooks for rewards (spec §10.1).",
    permissions: "admin.growth.read"
  },
  "gr.pc": {
    id: "gr.pc",
    labelKey: "shell.navItems.postcards",
    api: "Share/postcard templates & /share/* public renderer (§27.5–27.7).",
    permissions: "admin.growth.read"
  },
  "gr.camp": {
    id: "gr.camp",
    labelKey: "shell.navItems.campaigns",
    api: "Referral & marketing campaigns; audited admin writes.",
    permissions: "admin.growth.read"
  },
  "op.ff": {
    id: "op.ff",
    labelKey: "shell.navItems.featureFlags",
    api: "GET/POST /admin/operations/feature-flags/* (spec §10.1, §30.6).",
    permissions: "iam.manage"
  },
  "op.kill": {
    id: "op.kill",
    labelKey: "shell.navItems.killSwitches",
    api: "GET/POST /admin/operations/kill-switches/* (spec §10.1, §30.6.1).",
    permissions: "iam.manage"
  },
  "op.dl": {
    id: "op.dl",
    labelKey: "shell.navItems.deadLetter",
    api: "GET/POST /admin/operations/dead-letter-queue/* (spec §10.1, §30.11).",
    permissions: "iam.manage | admin.content.read"
  },
  "op.manifests": {
    id: "op.manifests",
    labelKey: "shell.navItems.importManifests",
    api: "GET/POST /admin/imports* manifest tracking (line 930–931) + batch staging.",
    permissions: "admin.content.read | operator.import"
  },
  "op.failed": {
    id: "op.failed",
    labelKey: "shell.navItems.importFailed",
    api: "Failed import rows; DLQ for content pipeline.",
    permissions: "admin.content.read | operator.import"
  },
  "op.notif": {
    id: "op.notif",
    labelKey: "shell.navItems.notifications",
    api: "GET/POST /admin/notifications/* (spec §10.1, §30.8).",
    permissions: "iam.manage | admin.content.read"
  },
  "op.sec": {
    id: "op.sec",
    labelKey: "shell.navItems.securityAudit",
    api: "Security-focused audit & signals; may overlap viewer.audit with filters.",
    permissions: "viewer.audit | iam.manage"
  },
  "lg.doc": {
    id: "lg.doc",
    labelKey: "shell.navItems.legalDocs",
    api: "GET/POST /legal/* document CMS (legal §31).",
    permissions: "iam.manage"
  },
  "lg.terms": {
    id: "lg.terms",
    labelKey: "shell.navItems.legalTerms",
    api: "Terms/privacy version mapping; public consent gating (§31).",
    permissions: "iam.manage"
  },
  "lg.consent": {
    id: "lg.consent",
    labelKey: "shell.navItems.consent",
    api: "GET/POST /consent/* — consent record admin (spec §10.1, §31).",
    permissions: "iam.manage"
  },
  "lg.cookies": {
    id: "lg.cookies",
    labelKey: "shell.navItems.cookies",
    api: "Cookie / tracking preferences admin; public banner config.",
    permissions: "iam.manage"
  },
  "lg.tt": {
    id: "lg.tt",
    labelKey: "shell.navItems.tokushoho",
    api: "特定商取引法 (Japan commercial disclosure) content & edits.",
    permissions: "iam.manage"
  },
  "lg.ret": {
    id: "lg.ret",
    labelKey: "shell.navItems.retention",
    api: "Data retention policy admin; align with export/delete (§6).",
    permissions: "iam.manage"
  },
  "iam.roles": {
    id: "iam.roles",
    labelKey: "shell.navItems.iamRoles",
    api: "GET /admin/iam/roles (registry line 937); role/permission graph.",
    permissions: "iam.manage"
  },
  "iam.permissions": {
    id: "iam.permissions",
    labelKey: "shell.navItems.iamPermissions",
    api: "Permission catalog; sync with `authz` layer & seed (RBAC matrix).",
    permissions: "iam.manage"
  },
  "iam.admins": {
    id: "iam.admins",
    labelKey: "shell.navItems.iamAdmins",
    api: "Admin user / actor registry; protect with iam.manage and audit on write.",
    permissions: "iam.manage"
  },
  "iam.roleAudit": {
    id: "iam.roleAudit",
    labelKey: "shell.navItems.iamRoleAudit",
    api: "Role assignment / grant history; `viewer.audit` or dedicated IAM audit stream.",
    permissions: "iam.manage | viewer.audit"
  }
} as const;

export type AdminScaffoldId = keyof typeof ADMIN_SCAFFOLD_SPEC;
