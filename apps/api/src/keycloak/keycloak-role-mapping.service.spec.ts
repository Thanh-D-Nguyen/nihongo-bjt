import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KeycloakRoleMappingService } from "./keycloak-role-mapping.service.js";
import type { KeycloakJwtPayload } from "./keycloak.types.js";

describe("KeycloakRoleMappingService", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...prevEnv };
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.KEYCLOAK_ADMIN_REALM_ROLES = "admin,superadmin";
  });

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  function svc() {
    return new KeycloakRoleMappingService();
  }

  it("tokenHasAdminPortalAccess is true when realm role matches", () => {
    const claims: KeycloakJwtPayload = {
      realm_access: { roles: ["offline_access", "admin"] }
    };
    expect(svc().tokenHasAdminPortalAccess(claims)).toBe(true);
  });

  it("tokenHasAdminPortalAccess is true when resource client role matches", () => {
    const claims: KeycloakJwtPayload = {
      resource_access: { "nihongo-admin": { roles: ["superadmin"] } }
    };
    expect(svc().tokenHasAdminPortalAccess(claims)).toBe(true);
  });

  it("tokenHasAdminPortalAccess is false without configured roles", () => {
    const claims: KeycloakJwtPayload = {
      realm_access: { roles: ["learner"] },
      resource_access: { account: { roles: ["manage-account"] } }
    };
    expect(svc().tokenHasAdminPortalAccess(claims)).toBe(false);
  });

  it("rolesForInternalAdminSync merges realm/resource roles and admin aliases uniquely", () => {
    const claims: KeycloakJwtPayload = {
      realm_access: { roles: ["admin", "learner"] },
      resource_access: { clientA: { roles: ["viewer", "admin"] } }
    };
    const roles = svc().rolesForInternalAdminSync(claims).sort();
    expect(roles).toEqual(["admin", "admin.super", "learner", "viewer"]);
  });

  it("supports explicit KEYCLOAK_ADMIN_INTERNAL_ROLE_ALIASES overrides", () => {
    process.env.KEYCLOAK_ADMIN_INTERNAL_ROLE_ALIASES = "ops_admin:iam.manage";
    const claims: KeycloakJwtPayload = {
      realm_access: { roles: ["ops_admin"] }
    };
    expect(svc().rolesForInternalAdminSync(claims).sort()).toEqual(["iam.manage", "ops_admin"]);
  });

  it("respects KEYCLOAK_ADMIN_REALM_ROLES for portal check", () => {
    process.env.KEYCLOAK_ADMIN_REALM_ROLES = "ops_admin";
    const claims: KeycloakJwtPayload = {
      realm_access: { roles: ["ops_admin"] }
    };
    expect(svc().tokenHasAdminPortalAccess(claims)).toBe(true);
    const claims2: KeycloakJwtPayload = {
      realm_access: { roles: ["admin"] }
    };
    expect(svc().tokenHasAdminPortalAccess(claims2)).toBe(false);
  });
});
