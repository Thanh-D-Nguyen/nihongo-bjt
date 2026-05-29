import { BadRequestException, Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../../admin/admin-auth.service.js";
import { LogAdminAction } from "../../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../../openapi/common-decorators.js";
import { LotoLabService } from "./loto-lab.service.js";
import type { LotoGame, LotoGenerationInput } from "./loto-types.js";

function gameFromQuery(game?: string): LotoGame {
  if (game === "loto6" || game === "loto7") return game;
  throw new BadRequestException("game must be loto6 or loto7");
}

@Controller("admin/magazine/loto")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("content")
@LogAdminAction({ resourceType: "admin.magazine.loto" })
@ApiTags("Admin – Magazine Loto Lab")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class LotoLabAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(LotoLabService) private readonly loto: LotoLabService,
  ) {}

  @Get("summary")
  @ApiOperation({ summary: "Loto6/Loto7 data health and statistics summary." })
  @ApiQuery({ name: "game", required: true, enum: ["loto6", "loto7"] })
  summary(@Query("game") game?: string) {
    return this.loto.summary(gameFromQuery(game));
  }

  @Get("draws")
  @ApiOperation({ summary: "Recent imported/synced Loto draws." })
  @ApiQuery({ name: "game", required: true, enum: ["loto6", "loto7"] })
  @ApiQuery({ name: "limit", required: false })
  draws(@Query("game") game?: string, @Query("limit") limit?: string) {
    return this.loto.listDraws(gameFromQuery(game), Number(limit) || 20);
  }

  @Post("import-csv")
  @ApiOperation({ summary: "Import Loto6/Loto7 historical draws from CSV. Upserts by game + draw number." })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        game: { type: "string", enum: ["loto6", "loto7"] },
        csvText: { type: "string" },
      },
      required: ["csvText"],
    },
  })
  @ApiOkResponse({ description: "Import counts." })
  async importCsv(@Req() req: Request, @Body() body: { game?: string; csvText?: string }) {
    await this.auth.requirePermission(req, "admin.content.write");
    if (!body.csvText?.trim()) throw new BadRequestException("csvText is required");
    return this.loto.importCsv(body.csvText, body.game);
  }

  @Post("generate")
  @ApiOperation({ summary: "Generate 1-5 Loto candidate sets with weighted algorithms and contextual text signals." })
  async generate(@Req() req: Request, @Body() body: LotoGenerationInput) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    return this.loto.generate(body, principal.actorId);
  }

  @Post("publish")
  @ApiOperation({ summary: "Publish selected generated sets as a Magazine prediction article." })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "LotoGenerationRun UUID" },
        setIds: { type: "array", items: { type: "string" }, description: "Selected LotoGeneratedSet UUIDs to publish" },
      },
      required: ["runId", "setIds"],
    },
  })
  async publish(@Req() req: Request, @Body() body: { runId?: string; setIds?: string[] }) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    if (!body.runId) throw new BadRequestException("runId is required");
    if (!body.setIds?.length) throw new BadRequestException("At least one setId is required");
    return this.loto.publishToMagazine(body.runId, body.setIds, principal.actorId);
  }
}
