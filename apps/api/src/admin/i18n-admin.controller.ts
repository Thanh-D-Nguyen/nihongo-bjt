import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";

import { AdminAuthService } from "./admin-auth.service.js";
import { AdminRbacGuard } from "./admin-rbac.guard.js";
import { LogAdminAction } from "./admin-audit.decorator.js";
import { RequireAdminPermissions } from "./admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { I18nAdminRepository } from "./i18n-admin.repository.js";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  namespace: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  status: z.enum(["all", "untranslated", "complete"]).optional().default("all")
});

const updateTranslationSchema = z.object({
  locale: z.enum(["vi", "ja", "en"]),
  value: z.string().min(0).max(20000),
  reason: z.string().trim().min(3).max(500)
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
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(I18nAdminRepository) private readonly repo: I18nAdminRepository
  ) {}

  @Get("keys")
  @ApiOperation({
    summary:
      "List translation keys with per-locale (vi/ja/en) values + status. Supports namespace, q, status filters."
  })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "namespace", required: false })
  @ApiQuery({
    name: "status",
    required: false,
    schema: { type: "string", enum: ["all", "untranslated", "complete"] }
  })
  @ApiOkResponse({ description: "Paginated translation keys with per-locale status." })
  async listKeys(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get("pending")
  @ApiOperation({ summary: "Pending translations summary (count + top namespaces) for KPI tile." })
  async pending(@Req() req: Request) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    return this.repo.pendingSummary();
  }

  @Get("keys/:id")
  @ApiOperation({ summary: "Translation key detail with per-locale values + last 50 audit entries." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    if (!/^\d+$/.test(id)) throw new BadRequestException({ code: "invalid_translation_key_id" });
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "translation_key_not_found", id });
    return found;
  }

  @Patch("keys/:id/translation")
  @ApiOperation({ summary: "Upsert translation value for (keyId, locale). Audited per-locale." })
  async updateTranslation(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    if (!/^\d+$/.test(id)) throw new BadRequestException({ code: "invalid_translation_key_id" });
    const parsed = updateTranslationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.upsertTranslation({
      actorId: principal.actorId,
      keyId: id,
      locale: parsed.data.locale,
      reason: parsed.data.reason,
      value: parsed.data.value
    });
  }
}
