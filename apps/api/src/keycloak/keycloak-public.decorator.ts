import { SetMetadata } from "@nestjs/common";

/** Skip JWT validation (public route). */
export const IS_KEYCLOAK_PUBLIC = "keycloakPublic";
export const PublicRoute = () => SetMetadata(IS_KEYCLOAK_PUBLIC, true);

/** When Keycloak is enabled: validate Bearer if present, provision user; allow anonymous if absent. */
export const KEYCLOAK_AUTH_OPTIONAL = "keycloakAuthOptional";
export const KeycloakAuthOptional = () => SetMetadata(KEYCLOAK_AUTH_OPTIONAL, true);
