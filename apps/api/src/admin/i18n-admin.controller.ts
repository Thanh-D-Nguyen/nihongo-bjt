import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { createPrismaClient } from "@nihongo-bjt/database";
import { z } from "zod";

import { AdminRbacGuard } from "./admin-rbac.guard.js";
import { LogAdminAction } from "./admin-audit.decorator.js";
import { RequireAdminPermissions } from "./admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  namespace: z.string().trim().min(1).max(100).optional()
});

@Controller("admin/i18n")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.i18n" })
@ApiTags("Admin i18n")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class I18nAdminController {
  private readonly prisma = createPrismaClient();

  @Get("keys")
  @ApiOperation({ summary: "List translation keys with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "namespace", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of translation keys." })
  async listKeys(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const where: Record<string, unknown> = {};
    if (parsed.namespace) where.namespace = parsed.namespace;

    const [items, total] = await Promise.all([
      this.prisma.translationKey.findMany({
        include: { _count: { select: { translations: true } } },
        orderBy: { createdAt: "desc" },
        skip: parsed.offset,
        take: parsed.limit,
        where
      }),
      this.prisma.translationKey.count({ where })
    ]);
    return { items, total };
  }
}
