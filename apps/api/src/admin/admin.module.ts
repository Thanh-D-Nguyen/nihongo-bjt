import { Module } from "@nestjs/common";

import { AdminAuditInterceptor } from "./admin-audit.interceptor.js";
import { AdminAuditService } from "./admin-audit.service.js";
import { AdminRbacGuard } from "./admin-rbac.guard.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { AdminController } from "./admin.controller.js";
import { AdminRepository } from "./admin.repository.js";
import { AdminUserInviteService } from "./admin-user-invite.service.js";
import { I18nAdminController } from "./i18n-admin.controller.js";

@Module({
  controllers: [AdminController, I18nAdminController],
  exports: [AdminAuthService, AdminAuditService, AdminAuditInterceptor, AdminRbacGuard],
  providers: [
    AdminAuthService,
    AdminAuditService,
    AdminAuditInterceptor,
    AdminRbacGuard,
    AdminRepository,
    AdminUserInviteService
  ]
})
export class AdminModule {}
