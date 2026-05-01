import {
  adminLearningReviewForceReintroduceSchema,
  adminLearningReviewProblemQuerySchema,
  adminLearningReviewRetentionQuerySchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

import { LearningReviewAdminRepository } from "./learning-review-admin.repository.js";

/**
 * Learning Review admin: read-only retention dashboard plus an audited "force re-introduce"
 * action that resets a single user_flashcard to dueAt=now/intervalDays=0/state=relearning.
 *
 * The retention curve and problem-card list are read-only and visible to viewer.audit; the
 * force-reintroduce action requires `admin.content.write` and is always audited.
 *
 * Audit codes: `admin.learning.review.force_reintroduce`.
 */
@Controller("admin/learning/review")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("learning")
@LogAdminAction({ resourceType: "learning.user_flashcard" })
@ApiTags("Admin Learning", "Review")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class LearningReviewAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(LearningReviewAdminRepository) private readonly repo: LearningReviewAdminRepository
  ) {}

  @Get("summary")
  @ApiOperation({ summary: "Retention summary over a window (default 30d)." })
  @ApiQuery({ name: "windowDays", required: false, schema: { type: "integer", default: 30 } })
  @ApiOkResponse({ description: "Aggregate stats: cards, due-now, leeched, retentionPct, averages." })
  async summary(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.read",
      "admin.content.write",
      "viewer.audit"
    ]);
    const parsed = adminLearningReviewRetentionQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.summary(parsed.data);
  }

  @Get("retention-curve")
  @ApiOperation({ summary: "Daily retention ratio over the window." })
  @ApiQuery({ name: "windowDays", required: false, schema: { type: "integer", default: 30 } })
  @ApiOkResponse({ description: "Array of { day, total, good, retentionPct }." })
  async retentionCurve(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.read",
      "admin.content.write",
      "viewer.audit"
    ]);
    const parsed = adminLearningReviewRetentionQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.retentionCurve(parsed.data);
  }

  @Get("problem-cards")
  @ApiOperation({
    summary: "List problem cards (lapses ≥ minLapses, recent retention ≤ maxRetention)."
  })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "minLapses", required: false, schema: { type: "integer", default: 2 } })
  @ApiQuery({ name: "maxRetention", required: false, schema: { type: "integer", default: 60 } })
  @ApiQuery({ name: "leeched", required: false, enum: ["all", "leeched", "non_leeched"] })
  @ApiQuery({ name: "page", required: false, schema: { type: "integer", default: 1 } })
  @ApiQuery({ name: "pageSize", required: false, schema: { type: "integer", default: 25 } })
  async problemCards(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.read",
      "admin.content.write",
      "viewer.audit"
    ]);
    const parsed = adminLearningReviewProblemQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.problemCards(parsed.data);
  }

  @Get("cards/:id")
  @ApiOperation({ summary: "Detail of a user_flashcard with recent reviews and audit." })
  @ApiParam({ name: "id", description: "user_flashcard.id (UUID)" })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.read",
      "admin.content.write",
      "viewer.audit"
    ]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "user_flashcard_not_found", id });
    return found;
  }

  @Post("cards/:id/force-reintroduce")
  @ApiOperation({
    summary:
      "Force-reintroduce a card: dueAt=now, intervalDays=0, state=relearning. Always audited."
  })
  @ApiParam({ name: "id", description: "user_flashcard.id (UUID)" })
  async forceReintroduce(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminLearningReviewForceReintroduceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.forceReintroduce(principal.actorId, id, parsed.data.reason);
  }
}
