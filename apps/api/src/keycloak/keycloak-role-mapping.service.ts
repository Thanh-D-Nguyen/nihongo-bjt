import { parseServerEnv } from "@nihongo-bjt/config";
import { Injectable } from "@nestjs/common";

import type { KeycloakJwtPayload } from "./keycloak.types.js";

/**
 * Central Keycloak realm / client role interpretation (avoid scattered string checks).
 */
@Injectable()
export class KeycloakRoleMappingService {
  private readonly adminPortalRealmRoles: Set<string>;

  constructor() {
    const env = parseServerEnv(process.env);
    const raw = env.KEYCLOAK_ADMIN_REALM_ROLES ?? "admin";
    this.adminPortalRealmRoles = new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  collectRealmRoles(claims: KeycloakJwtPayload): string[] {
    return claims.realm_access?.roles ?? [];
  }

  collectResourceRoles(claims: KeycloakJwtPayload): Record<string, string[]> {
    const ra = claims.resource_access;
    if (!ra) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(ra).map(([k, v]) => [k, v.roles ?? []])
    );
  }

  /** Realm or resource roles that should map to `authz.admin_role.code` (additive sync). */
  rolesForInternalAdminSync(claims: KeycloakJwtPayload): string[] {
    const realm = this.collectRealmRoles(claims);
    const fromResource = Object.values(this.collectResourceRoles(claims)).flat();
    return [...new Set([...realm, ...fromResource])];
  }

  tokenHasAdminPortalAccess(claims: KeycloakJwtPayload): boolean {
    const realm = this.collectRealmRoles(claims);
    if (realm.some((r) => this.adminPortalRealmRoles.has(r))) {
      return true;
    }
    for (const roles of Object.values(this.collectResourceRoles(claims))) {
      if (roles.some((r) => this.adminPortalRealmRoles.has(r))) {
        return true;
      }
    }
    return false;
  }
}
