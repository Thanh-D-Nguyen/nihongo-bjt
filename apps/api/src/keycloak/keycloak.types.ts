import type { JWTPayload } from "jose";

export type KeycloakJwtPayload = JWTPayload & {
  email?: string;
  name?: string;
  picture?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
};

export type KeycloakAuthenticatedUser = {
  appUserId: string;
  email?: string;
  name?: string;
  realmRoles: string[];
  sub: string;
};
