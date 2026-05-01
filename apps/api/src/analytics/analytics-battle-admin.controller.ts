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
import { AnalyticsBattleAdminRepository } from "./analytics-battle-admin.repository.js";

const DOMAIN = "battle";

/**
 * Admin Battle Analytics — read-only domain workflow with audited export and rate-limited refresh.
 *
 * Reads require any of `viewer.analytics`, `admin.analytics.view`, `analytics.view`, `viewer.audit`.
 * Exports/refresh require `analytics.export`/`analytics.manage`/`admin.analytics.view`/`iam.manage`
 * (permission_gap recorded in inventory; falls back to writer-class roles until dedicated permissions ship).
 */
@Controller(`admin/analytics/${DOMAIN}`)
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("analytics")
@LogAdminAction({ resourceType: `analytics.${DOMAIN}` })
@ApiTags("Admin Analytics", `Analytics ${DOMAIN}`)
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class AnalyticsBattleAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(AnalyticsBattleAdminRepository) private readonly repo: AnalyticsBattleAdminRepository
  ) {}

  @Get("summary")
  @ApiOperation({ summary: "Battle analytics KPI tiles + freshness." })
  async summary(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ANALYTICS_READ_PERMISSIONS);
    const parsed = adminAnalyticsCommonFilterSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.summary(parsed.data);
  }

  @Get("timeseries")
  @ApiOperation({ summary: "Battle analytics chart series. Metrics: matches | active_players | abuse_reports." })
  async timeseries(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ANALYTICS_READ_PERMISSIONS);
    const parsed = adminAnalyticsTimeseriesQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.timeseries(parsed.data);
  }

  @Get("breakdown")
  @ApiOperation({ summary: "Battle analytics drill-down rows. Dimensions: matches (default) | by_config." })
  async breakdown(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ANALYTICS_READ_PERMISSIONS);
    const parsed = adminAnalyticsBreakdownQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.breakdown(parsed.data);
  }

  @Post("export")
  @HttpCode(200)
  @ApiOperation({ summary: "Export battle analytics view as CSV (audited)." })
  async export(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
    @Query() query: Record<string, string | undefined>,
    @Body() body: unknown
  ) {
    const principal = await this.auth.requireOneOfPermissions(req, ANALYTICS_EXPORT_PERMISSIONS);
    void principal; // audit interceptor records actor
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
        metric: parsed.data.metric ?? "matches"
      });
      rows = (s.series ?? []) as unknown as Record<string, unknown>[];
      columns = ["t", "value"];
    } else {
      const s = await this.repo.breakdown({
        ...parsed.data,
        dimension: parsed.data.dimension ?? "matches",
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
  @ApiOperation({ summary: "Request refresh of battle analytics rollups (rate-limited; audited)." })
  async refresh(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requireOneOfPermissions(req, ANALYTICS_REFRESH_PERMISSIONS);
    const parsed = adminAnalyticsRefreshBodySchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const t = checkRefreshThrottle(principal.actorId, DOMAIN);
    if (!t.allowed) {
      throw new ServiceUnavailableException({
        code: "refresh_throttled",
        retryAfterMs: t.retryAfterMs
      });
    }
    return {
      domain: DOMAIN,
      reason: parsed.data.reason,
      requestedAt: new Date().toISOString(),
      // The actual MV refresh is run by a separate scheduled job; this endpoint records the operator
      // request via audit interceptor. Returning 202 communicates "accepted, eventually consistent".
      status: "accepted"
    };
  }
}
