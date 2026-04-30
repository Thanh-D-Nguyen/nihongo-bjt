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

  it("rolesForInternalAdminSync merges realm and resource roles uniquely", () => {
    const claims: KeycloakJwtPayload = {
      realm_access: { roles: ["admin", "learner"] },
      resource_access: { clientA: { roles: ["viewer", "admin"] } }
    };
    const roles = svc().rolesForInternalAdminSync(claims).sort();
    expect(roles).toEqual(["admin", "learner", "viewer"]);
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
