import { createPrismaClient } from "@nihongo-bjt/database";
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException
} from "@nestjs/common";
import type { Request } from "express";

import { KeycloakRoleMappingService } from "../keycloak/keycloak-role-mapping.service.js";
import { KeycloakTokenService } from "../keycloak/keycloak-token.service.js";
import { KeycloakUserService } from "../keycloak/keycloak-user.service.js";

export interface AdminPrincipal {
  actorId: string;
  displayName: string;
  /** Effective permission codes from `authz` roles; this is the source of truth for admin API enforcement. */
  permissions: Set<string>;
}

/**
 * Binds an HTTP request to an `authz.admin_actor` and enforces **internal RBAC** (permission strings).
 *
 * **Why backend checks matter:** the admin UI may hide buttons for UX, but all mutating and sensitive
 * reads must be denied here; never rely on the SPA alone (tokens can be replayed, UI can be bypassed).
 *
 * **Keycloak layer:** with issuer configured, the caller must present a valid Bearer token, pass the
 * portal **realm role** gate, and have a linked `admin_actor` row (`keycloak_subject`). The header-based
 * path exists for local dev only when OIDC to Keycloak is disabled.
 */
@Injectable()
export class AdminAuthService {
  private readonly prisma = createPrismaClient();
  private readonly log = new Logger(AdminAuthService.name);

  constructor(
    @Inject(KeycloakTokenService) private readonly keycloakTokens: KeycloakTokenService,
    @Inject(KeycloakUserService) private readonly keycloakUsers: KeycloakUserService,
    @Inject(KeycloakRoleMappingService) private readonly keycloakRoles: KeycloakRoleMappingService
  ) {}

  /**
   * Validates Keycloak JWT, portal role gate, and linked admin actor. Does not check fine-grained permissions.
   */
  async requireAdminPortalSession(req: Request): Promise<{ actorId: string; displayName: string }> {
    const { actorId, displayName } = await this.resolveAdminActor(req);
    return { actorId, displayName };
  }

  /**
   * Resolves admin actor: Keycloak JWT + realm role gate when configured, else legacy header (local only).
   */
  private async resolveAdminActor(req: Request): Promise<{ actorId: string; displayName: string }> {
    if (this.keycloakTokens.isEnabled()) {
      const auth = req.headers.authorization;
      if (typeof auth !== "string" || !auth.startsWith("Bearer ")) {
        throw new UnauthorizedException("Authorization Bearer token required for admin API");
      }
      const claims = await this.keycloakTokens.verifyAccessToken(auth.slice(7).trim());
      const sub = claims.sub;
      if (!sub) {
        throw new UnauthorizedException("Token missing sub");
      }

      if (!this.keycloakRoles.tokenHasAdminPortalAccess(claims)) {
        this.log.warn(`Admin portal denied: missing Keycloak admin role (sub=${sub})`);
        throw new ForbiddenException(
          "Keycloak admin role required for this application (code: admin_role_required)"
        );
      }

      const actor = await this.prisma.adminActor.findFirst({
        where: { keycloakSubject: sub, status: "active" }
      });
      if (!actor) {
        this.log.warn(`Admin portal denied: actor not linked (sub=${sub})`);
        throw new ForbiddenException(
          "Admin account not linked: set authz.admin_actor.keycloak_subject (code: admin_actor_not_linked)"
        );
      }

      const kcRoles = this.keycloakRoles.rolesForInternalAdminSync(claims);
      await this.keycloakUsers.syncAdminRealmRoles({
        actorId: actor.id,
        realmRoles: kcRoles
      });

      return { actorId: actor.id, displayName: actor.displayName };
    }

    const header = req.headers["x-admin-actor-id"];
    if (typeof header !== "string" || !header.trim()) {
      throw new UnauthorizedException(
        "Missing admin actor (x-admin-actor-id) — configure Keycloak for production"
      );
    }
    const actor = await this.prisma.adminActor.findFirst({
      where: { id: header.trim(), status: "active" }
    });
    if (!actor) {
      throw new UnauthorizedException("Admin actor is not active");
    }
    return { actorId: actor.id, displayName: actor.displayName };
  }

  /** Loads the actor and expands role → permission codes from PostgreSQL (not from JWT claims alone). */
  private async loadPrincipal(actorId: string): Promise<AdminPrincipal> {
    const actor = await this.prisma.adminActor.findFirst({
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        }
      },
      where: { id: actorId, status: "active" }
    });

    if (!actor) {
      throw new UnauthorizedException("Admin actor is not active");
    }

    const permissions = new Set(
      actor.roles.flatMap((roleLink) =>
        roleLink.role.permissions.map((permissionLink) => permissionLink.permission.code)
      )
    );

    return {
      actorId: actor.id,
      displayName: actor.displayName,
      permissions
    };
  }

  /**
   * Fails with 403 if the actor lacks `permission`. Use for coarse admin routes (e.g. CMS) or when a single
   * capability gate is enough.
   */
  async requirePermission(req: Request, permission: string): Promise<AdminPrincipal> {
    const { actorId } = await this.resolveAdminActor(req);
    const principal = await this.loadPrincipal(actorId);
    if (!principal.permissions.has("*") && !principal.permissions.has(permission)) {
      this.log.warn(`Admin RBAC denied: actor=${actorId} missing ${permission}`);
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    return principal;
  }

  /**
   * Linked admin actor with full permission set (for `/admin/me` shell, no coarse gate like `admin.content.read`).
   */
  async loadAdminPrincipal(req: Request): Promise<AdminPrincipal> {
    const { actorId } = await this.resolveAdminActor(req);
    return this.loadPrincipal(actorId);
  }

  /**
   * Fails with 403 if none of `candidates` is granted. Prefer this over ad-hoc OR checks in controllers
   * so permission evolution (e.g. splitting `support.user`) stays centralized.
   */
  async requireOneOfPermissions(req: Request, candidates: readonly string[]): Promise<AdminPrincipal> {
    const { actorId } = await this.resolveAdminActor(req);
    const principal = await this.loadPrincipal(actorId);
    const ok = principal.permissions.has("*") || candidates.some((c) => principal.permissions.has(c));
    if (!ok) {
      this.log.warn(`Admin RBAC denied: actor=${actorId} missing one of [${candidates.join(", ")}]`);
      throw new ForbiddenException(`Missing one of permissions: ${candidates.join(", ")}`);
    }
    return principal;
  }
}
