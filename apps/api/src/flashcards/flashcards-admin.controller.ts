import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { FlashcardsAdminRepository } from "./flashcards-admin.repository.js";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  status: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s))
});

const deckListQuerySchema = listQuerySchema.extend({
  visibility: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s))
});

const variantListQuerySchema = listQuerySchema.extend({
  sourceType: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((s) => (s === "" || s === "all" ? undefined : s))
});

const transitionSchema = z.object({
  next: z.enum(["active", "archived", "draft"]),
  reason: z.string().trim().min(3).max(500)
});

const variantPatchSchema = z.object({
  frontText: z.string().trim().min(1).max(2000).optional(),
  backText: z.string().trim().min(1).max(4000).optional(),
  reading: z.string().trim().max(2000).nullable().optional(),
  reason: z.string().trim().min(3).max(500)
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
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(FlashcardsAdminRepository) private readonly repo: FlashcardsAdminRepository
  ) {}

  /* ----- Decks ("generated") ----- */
  @Get("decks")
  @ApiOperation({ summary: "List decks with workflow filters (q, status, visibility) and pagination." })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "visibility", required: false })
  @ApiOkResponse({ description: "Paginated decks." })
  async listDecks(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    const parsed = deckListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.listDecks(parsed.data);
  }

  @Get("decks/:id")
  @ApiOperation({ summary: "Deck detail with last 30 audit entries." })
  async deckDetail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    const found = await this.repo.deckDetail(id);
    if (!found) throw new BadRequestException({ code: "deck_not_found", id });
    return found;
  }

  @Post("decks/:id/transition")
  @ApiOperation({
    summary:
      "Transition a deck status. next: active (approve/publish) | archived (reject) | draft. Audited."
  })
  async transitionDeck(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.transitionDeck({
      actorId: principal.actorId,
      id,
      next: parsed.data.next,
      reason: parsed.data.reason
    });
  }

  /* ----- Variants ("templates") ----- */
  @Get("variants")
  @ApiOperation({ summary: "List flashcard variants with filters (q, status, sourceType) and pagination." })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "sourceType", required: false })
  @ApiOkResponse({ description: "Paginated flashcard variants." })
  async listVariants(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    const parsed = variantListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.listVariants(parsed.data);
  }

  @Get("variants/:id")
  @ApiOperation({ summary: "Flashcard variant detail with last 30 audit entries." })
  async variantDetail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    const found = await this.repo.variantDetail(id);
    if (!found) throw new BadRequestException({ code: "flashcard_variant_not_found", id });
    return found;
  }

  @Patch("variants/:id")
  @ApiOperation({ summary: "Update flashcard variant front/back/reading. Audited." })
  async patchVariant(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = variantPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patchVariant({
      actorId: principal.actorId,
      backText: parsed.data.backText,
      frontText: parsed.data.frontText,
      id,
      reading: parsed.data.reading,
      reason: parsed.data.reason
    });
  }

  @Post("variants/:id/transition")
  @ApiOperation({
    summary:
      "Transition variant status. next: active (publish) | archived | draft. Audited."
  })
  async transitionVariant(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.transitionVariant({
      actorId: principal.actorId,
      id,
      next: parsed.data.next,
      reason: parsed.data.reason
    });
  }
}
