import { Module } from "@nestjs/common";

import { GrowthModule } from "../growth/growth.module.js";
import { OperationsModule } from "../operations/operations.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { GoogleOAuthController } from "./google-oauth.controller.js";
import { GoogleOAuthService } from "./google-oauth.service.js";

@Module({
  controllers: [AuthController, GoogleOAuthController],
  exports: [AuthService],
  imports: [GrowthModule, OperationsModule],
  providers: [AuthService, GoogleOAuthService]
})
export class AuthModule {}
