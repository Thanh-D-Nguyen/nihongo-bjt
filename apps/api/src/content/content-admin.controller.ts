import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { createPrismaClient } from "@nihongo-bjt/database";
import { z } from "zod";

import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.string().trim().min(1).max(32).optional(),
  entityType: z.string().trim().min(1).max(64).optional()
});

@Controller("admin/content")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.content" })
@ApiTags("Admin Content")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class ContentAdminController {
  private readonly prisma = createPrismaClient();

  @Get("versions")
  @ApiOperation({ summary: "List content versions with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiQuery({ name: "entityType", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of content versions." })
  async listVersions(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const where: Record<string, unknown> = {};
    if (parsed.status) where.status = parsed.status;
    if (parsed.entityType) where.entityType = parsed.entityType;

    const [items, total] = await Promise.all([
      this.prisma.contentVersion.findMany({
        orderBy: { createdAt: "desc" },
        skip: parsed.offset,
        take: parsed.limit,
        where
      }),
      this.prisma.contentVersion.count({ where })
    ]);
    return { items, total };
  }

  @Get("enrichment")
  @ApiOperation({ summary: "List content enrichment queue with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiQuery({ name: "entityType", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of enrichment queue items." })
  async listEnrichment(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const where: Record<string, unknown> = {};
    if (parsed.status) where.status = parsed.status;
    if (parsed.entityType) where.entityType = parsed.entityType;

    const [items, total] = await Promise.all([
      this.prisma.contentEnrichment.findMany({
        orderBy: { createdAt: "desc" },
        skip: parsed.offset,
        take: parsed.limit,
        where
      }),
      this.prisma.contentEnrichment.count({ where })
    ]);
    return { items, total };
  }
}
