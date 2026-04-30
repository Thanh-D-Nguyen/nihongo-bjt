import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { EntitlementService } from "./entitlement.service.js";

export const REQUIRES_ENTITLEMENT_KEY = "requiresEntitlement";

/**
 * Decorator: marks a route as requiring a specific entitlement key.
 * The `EntitlementGuard` resolves the user's plan and rejects with a structured
 * `{code, entitlementKey, planSlug}` 403 if the key is missing.
 *
 * Usage:
 *   @UseGuards(KeycloakAuthGuard, EntitlementGuard)
 *   @RequiresEntitlement(EntitlementKey.learner_basic)
 *   async myRoute(...) {}
 */
export const RequiresEntitlement = (entitlementKey: string) =>
  SetMetadata(REQUIRES_ENTITLEMENT_KEY, entitlementKey);

/**
 * Server-side entitlement guard. Must be used after `KeycloakAuthGuard` (which attaches
 * `req.keycloakUser`). Returns a structured 403 so the frontend can display an upgrade prompt
 * from backend response without any frontend-only `isPremium` logic.
 */
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly entitlementService: EntitlementService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredKey = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRES_ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredKey) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{
      keycloakUser?: KeycloakAuthenticatedUser;
    }>();

    const userId = req.keycloakUser?.appUserId;
    if (!userId) {
      throw new ForbiddenException({
        code: "ENTITLEMENT_DENIED",
        entitlementKey: requiredKey,
        message: "Authenticated user is required for entitlement check"
      });
    }

    const { entitlements, planSlug } = await this.entitlementService.listEntitlementKeysForUser(userId);

    if (!entitlements.includes(requiredKey)) {
      throw new ForbiddenException({
        code: "ENTITLEMENT_DENIED",
        entitlementKey: requiredKey,
        message: "Your current plan does not include this feature",
        planSlug,
        upgradeRequired: true
      });
    }

    return true;
  }
}
