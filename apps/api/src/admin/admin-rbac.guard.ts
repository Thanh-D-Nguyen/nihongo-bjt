import { ForbiddenException, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import type { AdminPrincipal } from "./admin-auth.service.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { ADMIN_RBAC_METADATA_KEY, type AdminRbacRequirement } from "./admin.rbac.js";

export type AdminRequest = Request & {
  adminPrincipal?: AdminPrincipal;
};

@Injectable()
export class AdminRbacGuard implements CanActivate {
  constructor(
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(Reflector) private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<AdminRbacRequirement>(ADMIN_RBAC_METADATA_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requirement || requirement.requires.length === 0) {
      throw new ForbiddenException("Admin RBAC metadata missing");
    }

    const req = context.switchToHttp().getRequest<AdminRequest>();
    const principal = await this.adminAuth.requireOneOfPermissions(req, requirement.requires);
    req.adminPrincipal = principal;
    return true;
  }
}
