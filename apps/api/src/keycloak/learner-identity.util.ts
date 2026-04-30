import { BadRequestException, ForbiddenException } from "@nestjs/common";

import type { KeycloakAuthenticatedUser } from "./keycloak.types.js";

/**
 * Resolves the **learner `user_profile.id`** for API handlers. With a real Keycloak session, the id **must**
 * come from the verified token’s `appUserId` — a mismatched `userId` in the body is rejected to prevent
 * horizontal privilege escalation. Dev-only unauthenticated paths may pass `userId` explicitly.
 */
export function resolveLearnerUserId(
  keycloakUser: KeycloakAuthenticatedUser | undefined,
  requestedUserId: string | undefined,
  options: { required: boolean }
): string | undefined {
  if (keycloakUser) {
    if (requestedUserId && requestedUserId !== keycloakUser.appUserId) {
      throw new ForbiddenException("Cannot access another user's data");
    }
    return keycloakUser.appUserId;
  }
  if (requestedUserId) {
    return requestedUserId;
  }
  if (options.required) {
    throw new BadRequestException("userId is required");
  }
  return undefined;
}
