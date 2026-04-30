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
  status: z.string().trim().min(1).max(32).optional()
});

@Controller("admin/learning")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.learning" })
@ApiTags("Admin Learning")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class LearningAdminController {
  private readonly prisma = createPrismaClient();

  @Get("paths")
  @ApiOperation({ summary: "List learning paths with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of learning paths." })
  async listPaths(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const where: Record<string, unknown> = {};
    if (parsed.status) where.status = parsed.status;

    const [items, total] = await Promise.all([
      this.prisma.learningPath.findMany({
        orderBy: { displayOrder: "asc" },
        skip: parsed.offset,
        take: parsed.limit,
        where
      }),
      this.prisma.learningPath.count({ where })
    ]);
    return { items, total };
  }

  @Get("competencies")
  @ApiOperation({ summary: "List competency framework entries with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of competencies." })
  async listCompetencies(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const where: Record<string, unknown> = {};
    if (parsed.status) where.status = parsed.status;

    const [items, total] = await Promise.all([
      this.prisma.competency.findMany({
        orderBy: { createdAt: "desc" },
        skip: parsed.offset,
        take: parsed.limit,
        where
      }),
      this.prisma.competency.count({ where })
    ]);
    return { items, total };
  }
}
