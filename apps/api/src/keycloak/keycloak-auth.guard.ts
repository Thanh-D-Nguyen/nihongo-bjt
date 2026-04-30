import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { KeycloakTokenService } from "./keycloak-token.service.js";
import {
  IS_KEYCLOAK_PUBLIC,
  KEYCLOAK_AUTH_OPTIONAL
} from "./keycloak-public.decorator.js";
import type { KeycloakAuthenticatedUser } from "./keycloak.types.js";
import { KeycloakUserService } from "./keycloak-user.service.js";

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
  constructor(
    @Inject(KeycloakTokenService) private readonly tokens: KeycloakTokenService,
    @Inject(KeycloakUserService) private readonly users: KeycloakUserService,
    @Inject(Reflector) private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_KEYCLOAK_PUBLIC, [context.getHandler(), context.getClass()])) {
      return true;
    }

    if (!this.tokens.isEnabled()) {
      return true;
    }

    const optional = this.reflector.getAllAndOverride<boolean>(KEYCLOAK_AUTH_OPTIONAL, [
      context.getHandler(),
      context.getClass()
    ]);

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      keycloakUser?: KeycloakAuthenticatedUser;
    }>();

    const header = req.headers.authorization;
    if (optional) {
      if (header?.startsWith("Bearer ")) {
        const raw = header.slice(7).trim();
        if (raw) {
          await this.attachUser(req, raw);
        }
      }
      return true;
    }

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Authorization: Bearer access token");
    }
    const raw = header.slice(7).trim();
    if (!raw) {
      throw new UnauthorizedException("Empty bearer token");
    }
    await this.attachUser(req, raw);
    return true;
  }

  private async attachUser(
    req: { keycloakUser?: KeycloakAuthenticatedUser },
    rawToken: string
  ): Promise<void> {
    const claims = await this.tokens.verifyAccessToken(rawToken);
    const { appUserId } = await this.users.provisionLearner(claims);
    const realmRoles = claims.realm_access?.roles ?? [];
    req.keycloakUser = {
      appUserId,
      email: typeof claims.email === "string" ? claims.email : undefined,
      name:
        typeof claims.name === "string"
          ? claims.name
          : typeof claims.preferred_username === "string"
            ? claims.preferred_username
            : undefined,
      realmRoles,
      sub: claims.sub as string
    };
  }
}
