import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { PrivacyRequestService } from "./privacy-request.service.js";

const listQuerySchema = z.object({
  kind: z.enum(["export", "delete"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.string().trim().min(1).max(32).optional()
});

@Controller("admin/privacy")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.privacy" })
@ApiTags("Admin Privacy")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class PrivacyAdminController {
  constructor(@Inject(PrivacyRequestService) private readonly privacyService: PrivacyRequestService) {}

  @Get("requests")
  @ApiOperation({ summary: "List all privacy requests (export/delete) across users with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "kind", required: false, schema: { type: "string", enum: ["export", "delete"] } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of privacy requests." })
  async listRequests(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    return this.privacyService.adminListRequests(parsed);
  }
}
