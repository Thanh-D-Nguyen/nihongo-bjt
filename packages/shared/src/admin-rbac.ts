export const CANONICAL_ADMIN_ROLES = [
  "admin.super",
  "admin.content",
  "editor.lexeme",
  "editor.kanji",
  "editor.grammar",
  "editor.exam",
  "editor.media",
  "editor.i18n",
  "editor.enrichment",
  "operator.import",
  "operator.support",
  "viewer.analytics",
  "viewer.audit",
  "iam.manage",
  "billing.manage"
] as const;

export type CanonicalAdminRole = (typeof CANONICAL_ADMIN_ROLES)[number];

export const CANONICAL_ADMIN_ROLE_PERMISSIONS: Record<CanonicalAdminRole, readonly string[]> = {
  "admin.super": ["*"],
  "admin.content": ["admin.content.read", "admin.content.write"],
  "editor.lexeme": ["admin.content.read", "admin.content.write"],
  "editor.kanji": ["admin.content.read", "admin.content.write"],
  "editor.grammar": ["admin.content.read", "admin.content.write"],
  "editor.exam": ["admin.quiz.read", "admin.quiz.write"],
  "editor.media": ["admin.media.read", "admin.media.write"],
  "editor.i18n": ["admin.i18n.read", "admin.i18n.write"],
  "editor.enrichment": ["admin.enrichment.read", "admin.enrichment.write"],
  "operator.import": ["admin.import.read", "admin.import.write"],
  "operator.support": ["support.user.read", "support.user.write", "user.create", "admin.users.create"],
  "viewer.analytics": ["viewer.analytics", "analytics.view", "admin.analytics.view"],
  "viewer.audit": ["viewer.audit"],
  "iam.manage": ["iam.manage"],
  "billing.manage": [
    "admin.monetization.read",
    "admin.monetization.write",
    "billing.overview.view",
    "billing.plan.view",
    "billing.plan.manage",
    "billing.entitlement.manage",
    "billing.quota.view",
    "billing.quota.manage",
    "billing.quota.override",
    "billing.subscription.view",
    "billing.subscription.manage",
    "billing.coupon.manage",
    "monetization.audit.view",
    "revenue.analytics.view"
  ]
};

export function allCanonicalAdminPermissions(): string[] {
  return Array.from(
    new Set(
      Object.values(CANONICAL_ADMIN_ROLE_PERMISSIONS)
        .flat()
        .filter((permission) => permission !== "*")
    )
  ).sort();
}
