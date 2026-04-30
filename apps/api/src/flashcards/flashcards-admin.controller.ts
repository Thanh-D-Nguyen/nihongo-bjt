import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
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

@Controller("admin/flashcards")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.flashcards" })
@ApiTags("Admin Flashcards")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class FlashcardsAdminController {
  private readonly prisma = createPrismaClient();

  @Get("variants")
  @ApiOperation({ summary: "List flashcard variants (templates) with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of flashcard variants." })
  async listVariants(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const where: Record<string, unknown> = {};
    if (parsed.status) where.status = parsed.status;

    const [items, total] = await Promise.all([
      this.prisma.flashcardVariant.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sourceType: true,
          sourceId: true,
          frontText: true,
          backText: true,
          reading: true,
          status: true,
          createdAt: true
        },
        skip: parsed.offset,
        take: parsed.limit,
        where
      }),
      this.prisma.flashcardVariant.count({ where })
    ]);
    return { items, total };
  }

  @Get("decks")
  @ApiOperation({ summary: "List decks with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of decks." })
  async listDecks(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const where: Record<string, unknown> = {};
    if (parsed.status) where.status = parsed.status;

    const [items, total] = await Promise.all([
      this.prisma.deck.findMany({
        include: { _count: { select: { cards: true } } },
        orderBy: { createdAt: "desc" },
        skip: parsed.offset,
        take: parsed.limit,
        where
      }),
      this.prisma.deck.count({ where })
    ]);
    return { items, total };
  }
}
