import {
  adminAnalyticsBreakdownQuerySchema,
  adminAnalyticsCommonFilterSchema,
  adminAnalyticsExportQuerySchema,
  adminAnalyticsRefreshBodySchema,
  adminAnalyticsTimeseriesQuerySchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import {
  ANALYTICS_EXPORT_PERMISSIONS,
  ANALYTICS_READ_PERMISSIONS,
  ANALYTICS_REFRESH_PERMISSIONS,
  checkRefreshThrottle,
  rowsToCsv,
  setCsvDownloadHeaders
} from "./analytics-admin.shared.js";
import { AnalyticsLearningAdminRepository } from "./analytics-learning-admin.repository.js";

const DOMAIN = "learning";

@Controller(`admin/analytics/${DOMAIN}`)
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("analytics")
@LogAdminAction({ resourceType: `analytics.${DOMAIN}` })
@ApiTags("Admin Analytics", `Analytics ${DOMAIN}`)
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class AnalyticsLearningAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(AnalyticsLearningAdminRepository) private readonly repo: AnalyticsLearningAdminRepository
  ) {}

  @Get("summary")
  @ApiOperation({ summary: "Learning analytics KPI tiles + freshness." })
  async summary(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ANALYTICS_READ_PERMISSIONS);
    const parsed = adminAnalyticsCommonFilterSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.summary(parsed.data);
  }

  @Get("timeseries")
  @ApiOperation({ summary: "Learning analytics chart series. Metrics: reviews | active_studiers." })
  async timeseries(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ANALYTICS_READ_PERMISSIONS);
    const parsed = adminAnalyticsTimeseriesQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.timeseries(parsed.data);
  }

  @Get("breakdown")
  @ApiOperation({
    summary: "Learning analytics breakdown. Dimensions: top_studiers (default) | by_card_state | by_rating."
  })
  async breakdown(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ANALYTICS_READ_PERMISSIONS);
    const parsed = adminAnalyticsBreakdownQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.breakdown(parsed.data);
  }

  @Post("export")
  @HttpCode(200)
  @ApiOperation({ summary: "Export learning analytics view as CSV (audited)." })
  async export(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
    @Query() query: Record<string, string | undefined>,
    @Body() body: unknown
  ) {
    await this.auth.requireOneOfPermissions(req, ANALYTICS_EXPORT_PERMISSIONS);
    const parsed = adminAnalyticsExportQuerySchema.safeParse({ ...query, ...((body as object) ?? {}) });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    let rows: Record<string, unknown>[];
    let columns: string[] | undefined;
    if (parsed.data.view === "summary") {
      const s = await this.repo.summary(parsed.data);
      rows = s.kpis as unknown as Record<string, unknown>[];
      columns = ["id", "value", "previous", "deltaRatio", "format", "available", "unavailableCode"];
    } else if (parsed.data.view === "timeseries") {
      const s = await this.repo.timeseries({
        ...parsed.data,
        granularity: parsed.data.granularity,
        metric: parsed.data.metric ?? "reviews"
      });
      rows = (s.series ?? []) as unknown as Record<string, unknown>[];
      columns = ["t", "value"];
    } else {
      const s = await this.repo.breakdown({
        ...parsed.data,
        dimension: parsed.data.dimension ?? "top_studiers",
        page: 1,
        pageSize: 1000
      });
      rows = s.rows as unknown as Record<string, unknown>[];
    }
    const csv = rowsToCsv(rows as Record<string, string | number | boolean | null>[], columns);
    setCsvDownloadHeaders(res, `analytics-${DOMAIN}-${parsed.data.view}-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  }

  @Post("refresh")
  @HttpCode(202)
  @ApiOperation({ summary: "Request refresh of learning analytics rollups (rate-limited; audited)." })
  async refresh(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requireOneOfPermissions(req, ANALYTICS_REFRESH_PERMISSIONS);
    const parsed = adminAnalyticsRefreshBodySchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const t = checkRefreshThrottle(principal.actorId, DOMAIN);
    if (!t.allowed) {
      throw new ServiceUnavailableException({ code: "refresh_throttled", retryAfterMs: t.retryAfterMs });
    }
    return { domain: DOMAIN, reason: parsed.data.reason, requestedAt: new Date().toISOString(), status: "accepted" };
  }
}
