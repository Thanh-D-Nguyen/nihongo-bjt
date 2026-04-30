import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { KeycloakAuthenticatedUser } from "./keycloak.types.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): KeycloakAuthenticatedUser | undefined => {
    const req = ctx.switchToHttp().getRequest<{ keycloakUser?: KeycloakAuthenticatedUser }>();
    return req.keycloakUser;
  }
);
