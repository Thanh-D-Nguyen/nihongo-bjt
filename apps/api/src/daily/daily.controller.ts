import {
  adminDailyWidgetUpdateSchema,
  dailyActionSchema,
  dailyHomeQuerySchema,
  dailyQuickQuizCompleteSchema
} from "@nihongo-bjt/shared";
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
import type { Request } from "express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { KeycloakAuthOptional, PublicRoute } from "../keycloak/keycloak-public.decorator.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { DailyRepository } from "./daily.repository.js";

@Controller("daily")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Daily Hub")
@DocumentedHttpErrors()
export class DailyController {
  constructor(@Inject(DailyRepository) private readonly dailyRepository: DailyRepository) {}

  @Get("home")
  @KeycloakAuthOptional()
  @ApiOperation({
    summary: "Daily hub home (anonymous or with Bearer JWT for personalization; Keycloak-issued access token)"
  })
  @ApiQuery({ name: "locale", required: true, description: "UI/content locale" })
  @ApiQuery({ name: "userId", required: false, description: "Dev override; normally from session" })
  home(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const parsed = dailyHomeQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const userId = resolveLearnerUserId(user, parsed.data.userId, { required: false });
    return this.dailyRepository.home(parsed.data.locale, userId);
  }

  @Get("widgets")
  @PublicRoute()
  @ApiOperation({ summary: "Widget catalog for locale (public)." })
  @ApiQuery({ name: "locale", required: true })
  widgets(@Query() query: Record<string, string | undefined>) {
    const parsed = dailyHomeQuerySchema.pick({ locale: true }).safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.dailyRepository.widgets(parsed.data.locale);
  }

  @Post("items/:id/generate-flashcards")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Generate flashcards from a daily item (requires Bearer access token from Keycloak)." })
  @ApiParam({ name: "id", description: "Daily content item id" })
  @ApiBody({ description: "Body must include `userId` in dev/override; validated by `dailyActionSchema`." })
  generateFlashcards(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = dailyActionSchema.required({ userId: true }).safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.dailyRepository.generateFlashcards(id, parsed.data.userId);
  }

  @Post("items/:id/quick-quiz")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Start or fetch quick quiz for a daily item." })
  @ApiParam({ name: "id", description: "Daily content item id" })
  @ApiBody({ description: "Optional `userId` override; see `dailyActionSchema`." })
  quickQuiz(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const raw = (body ?? {}) as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: false });
    const parsed = dailyActionSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.dailyRepository.quickQuiz(id, parsed.data.userId);
  }

  @Post("items/:id/quick-quiz/complete")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Submit quick quiz answers." })
  @ApiParam({ name: "id", description: "Daily content item id" })
  @ApiBody({ description: "Payload per `dailyQuickQuizCompleteSchema` (includes `userId`)." })
  quickQuizComplete(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = dailyQuickQuizCompleteSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.dailyRepository.completeQuickQuiz(id, parsed.data);
  }

  @Post("items/:id/mark-useful")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Mark daily item as useful (feedback)." })
  @ApiParam({ name: "id", description: "Daily content item id" })
  @ApiBody({ description: "Optional `userId` per `dailyActionSchema`." })
  markUseful(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const raw = (body ?? {}) as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: false });
    const parsed = dailyActionSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.dailyRepository.markUseful(id, parsed.data.userId);
  }
}

@Controller("admin/daily")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("daily")
@LogAdminAction({ resourceType: "admin.daily" })
@ApiTags("Daily Hub", "Admin")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class AdminDailyController {
  constructor(
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(DailyRepository) private readonly dailyRepository: DailyRepository
  ) {}

  @Get("widgets")
  @ApiOperation({
    summary: "List admin widget configuration",
    description: "RBAC: `admin.content.read`"
  })
  @ApiQuery({ name: "locale", required: true })
  async widgets(
    @Req() req: Request,
    @Query() query: Record<string, string | undefined>
  ) {
    await this.adminAuth.requirePermission(req, "admin.content.read");
    const parsed = dailyHomeQuerySchema.pick({ locale: true }).safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.dailyRepository.adminWidgets(parsed.data.locale);
  }

  @Patch("widgets/:id")
  @ApiOperation({ summary: "Update widget", description: "RBAC: `admin.content.write`. Body: `adminDailyWidgetUpdateSchema`." })
  @ApiParam({ name: "id", description: "Widget id" })
  @ApiBody({ description: "Partial widget fields per Zod `adminDailyWidgetUpdateSchema`." })
  async updateWidget(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    await this.adminAuth.requirePermission(req, "admin.content.write");
    const parsed = adminDailyWidgetUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.dailyRepository.updateWidget(id, parsed.data);
  }
}
