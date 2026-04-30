import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { MediaService } from "./media.service.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  mimeType: z.string().trim().min(1).max(64).optional(),
  offset: z.coerce.number().int().min(0).optional().default(0),
  rightsStatus: z.string().trim().min(1).max(32).optional(),
  status: z.string().trim().min(1).max(32).optional()
});

@Controller("admin/media")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("media")
@LogAdminAction({ resourceType: "admin.media" })
@ApiTags("Admin Media")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class MediaAdminController {
  constructor(@Inject(MediaService) private readonly mediaService: MediaService) {}

  @Get()
  @ApiOperation({ summary: "List media assets with pagination and optional filters." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "rightsStatus", required: false, schema: { type: "string" } })
  @ApiQuery({ name: "mimeType", required: false, schema: { type: "string" } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of media assets." })
  async list(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    return this.mediaService.adminListAssets(parsed);
  }
}
