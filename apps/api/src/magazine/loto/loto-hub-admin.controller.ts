import { BadRequestException, Body, Controller, Get, Inject, Param, Put, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../../admin/admin-auth.service.js";
import { LogAdminAction } from "../../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../../admin/admin.rbac.js";
import { LotoHubAdminService } from "./loto-hub-admin.service.js";
import type { LotoGame } from "./loto-types.js";

function gameParam(game?: string): LotoGame {
  if (game === "loto6" || game === "loto7") return game;
  throw new BadRequestException("game must be loto6 or loto7");
}

@Controller("admin/magazine/loto/predictions")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("content")
@LogAdminAction({ resourceType: "admin.magazine.loto.predictions" })
@ApiTags("Admin – Loto Predictions")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
export class LotoHubAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(LotoHubAdminService) private readonly service: LotoHubAdminService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List loto predictions with approval status filter" })
  @ApiQuery({ name: "game", required: true, enum: ["loto6", "loto7"] })
  @ApiQuery({ name: "status", required: false, enum: ["pending", "approved", "rejected", "auto_approved"] })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  list(
    @Query("game") game?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.listPredictions(
      gameParam(game),
      status || undefined,
      Number(page) || 1,
      Math.min(Number(limit) || 20, 100),
    );
  }

  @Put(":id/approve")
  @ApiOperation({ summary: "Approve a loto prediction for publication" })
  @ApiParam({ name: "id", description: "MagazineArticle UUID" })
  async approve(@Param("id") id: string, @Req() req: Request) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    return this.service.approve(id, principal.actorId);
  }

  @Put(":id/reject")
  @ApiOperation({ summary: "Reject a loto prediction" })
  @ApiParam({ name: "id", description: "MagazineArticle UUID" })
  async reject(@Param("id") id: string, @Req() req: Request) {
    await this.auth.requirePermission(req, "admin.content.write");
    return this.service.reject(id);
  }

  @Post("results")
  @ApiOperation({ summary: "Input actual draw result" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        game: { type: "string", enum: ["loto6", "loto7"] },
        drawNumber: { type: "number" },
        drawDate: { type: "string", format: "date" },
        mainNumbers: { type: "array", items: { type: "number" } },
        bonusNumbers: { type: "array", items: { type: "number" } },
      },
      required: ["game", "drawNumber", "drawDate", "mainNumbers", "bonusNumbers"],
    },
  })
  async inputResult(
    @Req() req: Request,
    @Body() body: { game: string; drawNumber: number; drawDate: string; mainNumbers: number[]; bonusNumbers: number[] },
  ) {
    await this.auth.requirePermission(req, "admin.content.write");
    return this.service.inputResult(body);
  }

  @Get("analytics")
  @ApiOperation({ summary: "Loto prediction analytics (hit rates, engagement)" })
  @ApiQuery({ name: "game", required: true, enum: ["loto6", "loto7"] })
  analytics(@Query("game") game?: string) {
    return this.service.analytics(gameParam(game));
  }
}
