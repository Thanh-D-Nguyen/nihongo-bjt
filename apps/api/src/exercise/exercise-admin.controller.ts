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
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
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

  /* ── Exercise CRUD ───────────────────────────────────────────────────── */

  @Get()
  @ApiOperation({ summary: "List exercises with pagination and filters." })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "level", required: false })
  @ApiQuery({ name: "page", required: false, schema: { type: "integer", default: 1 } })
  @ApiQuery({ name: "pageSize", required: false, schema: { type: "integer", default: 20 } })
  async listExercises(
    @Req() req: Request,
    @Query("type") type?: string,
    @Query("level") level?: string,
    @Query("page") pageStr?: string,
    @Query("pageSize") pageSizeStr?: string
  ) {
    await this.adminAuth.requireOneOfPermissions(req, ["content.manage", "viewer.audit"]);
    const page = Math.max(parseInt(pageStr ?? "1", 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(pageSizeStr ?? "20", 10) || 20, 1), 100);
    return this.repo.listExercisesAdmin({ exerciseType: type, level, page, pageSize });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single exercise by ID." })
  @ApiParam({ name: "id", description: "Exercise ID (UUID)" })
  async getExercise(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requireOneOfPermissions(req, ["content.manage", "viewer.audit"]);
    const exercise = await this.repo.findExerciseById(id);
    if (!exercise) throw new BadRequestException("Exercise not found");
    return exercise;
  }

  @Post()
  @ApiOperation({ summary: "Create a new exercise manually." })
  async createExercise(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await this.adminAuth.requirePermission(req, "content.manage");
    const { exerciseType, sourceType, sourceId, level, prompt, choices, correctAnswer, explanation, difficulty, tags } = body;
    if (!exerciseType || !prompt || !correctAnswer) {
      throw new BadRequestException("exerciseType, prompt, and correctAnswer are required");
    }
    return this.repo.createExercise({
      exerciseType: String(exerciseType),
      sourceType: String(sourceType ?? "manual"),
      sourceId: String(sourceId ?? "admin"),
      level: level ? String(level) : null,
      prompt,
      choices: choices ?? [],
      correctAnswer,
      explanation: explanation ? String(explanation) : null,
      difficulty: String(difficulty ?? "medium"),
      tags: Array.isArray(tags) ? tags.map(String) : []
    });
  }

  @Put(":id")
  @ApiOperation({ summary: "Update an exercise." })
  @ApiParam({ name: "id", description: "Exercise ID (UUID)" })
  async updateExercise(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    await this.adminAuth.requirePermission(req, "content.manage");
    return this.repo.updateExercise(id, {
      prompt: body.prompt,
      choices: body.choices,
      correctAnswer: body.correctAnswer,
      explanation: body.explanation !== undefined ? (body.explanation ? String(body.explanation) : null) : undefined,
      difficulty: body.difficulty ? String(body.difficulty) : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
      level: body.level !== undefined ? (body.level ? String(body.level) : null) : undefined
    });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an exercise." })
  @ApiParam({ name: "id", description: "Exercise ID (UUID)" })
  async deleteExercise(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requirePermission(req, "content.manage");
    return this.repo.deleteExercise(id);
  }

  /* ── Performance Analytics ───────────────────────────────────────────── */

  @Get("analytics/performance")
  @ApiOperation({
    summary: "Get aggregated exercise performance analytics.",
    description: "Returns accuracy, time, and attempt statistics grouped by exercise type and level."
  })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "level", required: false })
  async getPerformanceAnalytics(
    @Req() req: Request,
    @Query("type") type?: string,
    @Query("level") level?: string
  ) {
    await this.adminAuth.requireOneOfPermissions(req, ["content.manage", "viewer.audit"]);
    return this.repo.getPerformanceAnalytics({ exerciseType: type, level });
  }
}
