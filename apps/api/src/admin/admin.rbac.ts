import { applyDecorators, SetMetadata } from "@nestjs/common";
import { ApiExtension } from "@nestjs/swagger";

const ADMIN_ROUTE_GROUP_PERMISSIONS = {
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
  ads: ["admin.monetization.read", "admin.monetization.write", "ads.manage", "ads.read", "viewer.audit"],
  media: ["admin.content.read", "admin.content.write", "iam.manage"]
} as const;

export const ADMIN_RBAC_METADATA_KEY = "admin:rbac:require";

export type AdminRouteGroup = keyof typeof ADMIN_ROUTE_GROUP_PERMISSIONS;

export type AdminRbacRequirement = {
  group: AdminRouteGroup;
  requires: readonly string[];
};

export type AdminFixturePrincipal = {
  role: "superadmin" | "admin" | "operator" | "viewer";
  permissions: readonly string[];
};

export const ADMIN_RBAC_TEST_FIXTURES: Record<AdminFixturePrincipal["role"], AdminFixturePrincipal> = {
  superadmin: {
    permissions: ["*"],
    role: "superadmin"
  },
  admin: {
    permissions: [
      "admin.content.read",
      "admin.content.write",
      "support.user.read",
      "support.user.write",
      "admin.users.create",
      "admin.growth.read",
      "admin.monetization.write",
      "admin.legal.write",
      "admin.analytics.view",
      "viewer.audit"
    ],
    role: "admin"
  },
  operator: {
    permissions: ["iam.manage", "viewer.audit", "billing.webhook.manage", "admin.import.write"],
    role: "operator"
  },
  viewer: {
    permissions: ["viewer.analytics", "analytics.view", "viewer.audit", "admin.content.read"],
    role: "viewer"
  }
};

export function RequireAdminPermissions(
  group: AdminRouteGroup,
  ...requires: readonly string[]
): ClassDecorator & MethodDecorator {
  const resolved = (requires.length > 0 ? requires : ADMIN_ROUTE_GROUP_PERMISSIONS[group]).slice().sort();

  return applyDecorators(
    SetMetadata(ADMIN_RBAC_METADATA_KEY, {
      group,
      requires: resolved
    } satisfies AdminRbacRequirement),
    ApiExtension("x-admin-group", group),
    ApiExtension("x-admin-requires", resolved)
  );
}
