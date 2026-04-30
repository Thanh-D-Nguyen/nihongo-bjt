import { Global, Module } from "@nestjs/common";

import { KeycloakAuthGuard } from "./keycloak-auth.guard.js";
import { KeycloakRealmAdminService } from "./keycloak-realm-admin.service.js";
import { KeycloakRoleMappingService } from "./keycloak-role-mapping.service.js";
import { KeycloakTokenService } from "./keycloak-token.service.js";
import { KeycloakUserService } from "./keycloak-user.service.js";

@Global()
@Module({
  exports: [
    KeycloakAuthGuard,
    KeycloakRealmAdminService,
    KeycloakRoleMappingService,
    KeycloakTokenService,
    KeycloakUserService
  ],
  providers: [
    KeycloakAuthGuard,
    KeycloakRealmAdminService,
    KeycloakRoleMappingService,
    KeycloakTokenService,
    KeycloakUserService
  ]
})
export class KeycloakModule {}
