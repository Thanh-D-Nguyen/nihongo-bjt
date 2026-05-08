import {
  adminExerciseConfigSchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Put,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { ExerciseRepository } from "./exercise.repository.js";

@Controller("admin/exercises")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.exercises" })
@ApiTags("Admin Exercises")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class ExerciseAdminController {
  constructor(
    @Inject(ExerciseRepository) private readonly repo: ExerciseRepository,
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService
  ) {}

  @Get("config")
  @ApiOperation({ summary: "List all exercise configurations." })
  async listConfigs(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "content.manage",
      "viewer.audit"
    ]);
    return this.repo.listConfigs();
  }

  @Put("config")
  @ApiOperation({
    summary: "Create or update an exercise configuration.",
    description:
      "Upserts an exercise config keyed by (exerciseType + placement). Controls which exercise types appear in each surface and their ordering."
  })
  async upsertConfig(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(
      req,
      "content.manage"
    );

    const parsed = adminExerciseConfigSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.repo.upsertConfig({
      exerciseType: parsed.data.exerciseType,
      placement: parsed.data.placement,
      displayOrder: parsed.data.displayOrder,
      enabled: parsed.data.enabled,
      minLevel: parsed.data.minLevel ?? null,
      maxLevel: parsed.data.maxLevel ?? null,
      timeLimitSec: parsed.data.timeLimitSec ?? null,
      pointsPerCorrect: parsed.data.pointsPerCorrect,
      actorId: principal.actorId
    });
  }

  @Delete("config/:id")
  @ApiOperation({ summary: "Delete an exercise configuration." })
  @ApiParam({ name: "id", description: "Exercise config ID (UUID)" })
  async deleteConfig(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requirePermission(req, "content.manage");
    return this.repo.deleteConfig(id);
  }
}
