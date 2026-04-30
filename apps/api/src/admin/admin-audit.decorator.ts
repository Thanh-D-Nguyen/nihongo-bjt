import { applyDecorators, SetMetadata, UseInterceptors } from "@nestjs/common";
import { ApiExtension } from "@nestjs/swagger";

import { AdminAuditInterceptor } from "./admin-audit.interceptor.js";

export const ADMIN_AUDIT_METADATA_KEY = "admin:audit:log";

export type LogAdminActionOptions = {
  action?: string;
  resourceType: string;
};

export function LogAdminAction(options: LogAdminActionOptions): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(ADMIN_AUDIT_METADATA_KEY, options),
    ApiExtension("x-admin-audit", true),
    UseInterceptors(AdminAuditInterceptor)
  );
}
