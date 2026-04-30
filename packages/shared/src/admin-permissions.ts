/**
 * Central permission codes for admin API + UI. Keep in sync with `authz` seed / roles.
 * @see apps/api/scripts/seed-admin.ts
 */
export const ADMIN_PERMISSION = {
  supportUserLegacy: "support.user",
  supportUserRead: "support.user.read",
  supportUserWrite: "support.user.write",
  supportUserSensitiveRead: "support.user.read_sensitive",
  /** @deprecated User-create / invite: prefer this over ad-hoc support.user.* */
  userCreate: "user.create",
  adminUsersCreate: "admin.users.create"
} as const;

export const ADMIN_SYSTEM_ROLE = {
  superadmin: "superadmin",
  admin: "admin",
  operator: "operator",
  viewer: "viewer"
} as const;

export type AdminSystemRole = typeof ADMIN_SYSTEM_ROLE[keyof typeof ADMIN_SYSTEM_ROLE];

export const ADMIN_SYSTEM_ROLE_PERMISSION_MATRIX: Record<AdminSystemRole, readonly string[]> = {
  superadmin: ["*"],
  admin: [
    "admin.content.read",
    "admin.content.write",
    "admin.analytics.view",
    "admin.growth.read",
    "admin.legal.read",
    "admin.legal.write",
    "admin.monetization.read",
    "admin.monetization.write",
    "admin.users.create",
    "support.user",
    "support.user.read",
    "support.user.write",
    "viewer.audit"
  ],
  operator: [
    "iam.manage",
    "support.user.read",
    "support.user.write",
    "viewer.audit",
    "billing.webhook.manage",
    "billing.webhook.read",
    "admin.import.read",
    "admin.import.write"
  ],
  viewer: [
    "analytics.view",
    "viewer.analytics",
    "viewer.audit",
    "support.user.read",
    "admin.content.read"
  ]
};

export const ADMIN_ROUTE_GROUP_PERMISSIONS = {
  admin_core: [
    "iam.manage",
    "admin.content.read",
    "admin.content.write",
    "support.user",
    "support.user.read",
    "support.user.write",
    "admin.users.create",
    "user.create",
    "admin.monetization.write",
    "viewer.audit"
  ],
  operations: ["iam.manage", "viewer.audit"],
  analytics: ["viewer.analytics", "admin.analytics.view", "analytics.view"],
  growth: ["admin.growth.read"],
  daily: ["admin.content.read", "admin.content.write"],
  legal: ["admin.legal.read", "admin.legal.write", "legal.admin"],
  monetization: ["admin.monetization.read", "admin.monetization.write", "billing.overview.view"],
  billing_webhook: ["admin.monetization.read", "admin.monetization.write", "billing.webhook.read", "billing.webhook.manage"],
  ads: ["admin.monetization.read", "admin.monetization.write", "ads.manage", "ads.read", "viewer.audit"]
} as const;

export type AdminSupportUserPermissionCode = typeof ADMIN_PERMISSION[keyof typeof ADMIN_PERMISSION];

/**
 * @remarks Admin UI can use this to show/hide menu items; the API still enforces
 * `support.user.read` (etc.) on every request - never use only this in the backend.
 */
export function canListLearnerProfiles(codes: readonly string[] | Set<string>): boolean {
  const s = codes instanceof Set ? codes : new Set(codes);
  return (
    s.has(ADMIN_PERMISSION.supportUserRead) ||
    s.has(ADMIN_PERMISSION.supportUserWrite) ||
    s.has(ADMIN_PERMISSION.supportUserLegacy)
  );
}

/**
 * @remarks Legacy "create profile" path; invite/create flows also accept `user.create` / `admin.users.create` server-side.
 */
export function canCreateLearnerProfile(codes: readonly string[] | Set<string>): boolean {
  const s = codes instanceof Set ? codes : new Set(codes);
  return (
    s.has(ADMIN_PERMISSION.supportUserWrite) ||
    s.has(ADMIN_PERMISSION.supportUserLegacy) ||
    s.has(ADMIN_PERMISSION.adminUsersCreate) ||
    s.has(ADMIN_PERMISSION.userCreate)
  );
}

/**
 * @remarks Mirrors server-side `POST /admin/users/invite` permission union; UI-only gate.
 */
export function canInviteOrCreateUser(codes: readonly string[] | Set<string>): boolean {
  const s = codes instanceof Set ? codes : new Set(codes);
  return (
    s.has(ADMIN_PERMISSION.adminUsersCreate) ||
    s.has(ADMIN_PERMISSION.userCreate) ||
    s.has(ADMIN_PERMISSION.supportUserWrite) ||
    s.has(ADMIN_PERMISSION.supportUserLegacy)
  );
}

/**
 * Sensitive user fields (PII/session metadata) should only appear for explicit support-sensitive reads.
 * Keeps backward compatibility for legacy/write operators while enabling tighter policy rollout.
 */
export function canReadSensitiveUserProfile(codes: readonly string[] | Set<string>): boolean {
  const s = codes instanceof Set ? codes : new Set(codes);
  return (
    s.has("*") ||
    s.has(ADMIN_PERMISSION.supportUserSensitiveRead) ||
    s.has(ADMIN_PERMISSION.supportUserWrite) ||
    s.has(ADMIN_PERMISSION.supportUserLegacy)
  );
}

export function toRolePermissionSet(role: AdminSystemRole): Set<string> {
  return new Set(ADMIN_SYSTEM_ROLE_PERMISSION_MATRIX[role]);
}
