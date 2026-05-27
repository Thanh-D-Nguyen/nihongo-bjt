import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { KeycloakAuthGuard } from "../../keycloak/keycloak-auth.guard.js";
import { LotoHubService } from "./loto-hub.service.js";
import type { LotoGame } from "./loto-types.js";

function gameParam(game?: string): LotoGame {
  return game === "loto7" ? "loto7" : "loto6";
}

@Controller("magazine/loto")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Magazine – Loto Hub")
@ApiBearerAuth("bearer")
export class LotoHubController {
  constructor(@Inject(LotoHubService) private readonly hub: LotoHubService) {}

  @Get("feed")
  @ApiOperation({ summary: "Loto prediction feed with matched results" })
  @ApiQuery({ name: "game", required: false, enum: ["loto6", "loto7"] })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  feed(
    @Query("game") game?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.hub.feed(gameParam(game), Number(page) || 1, Math.min(Number(limit) || 10, 50));
  }

  @Get("next-draw")
  @ApiOperation({ summary: "Latest prediction for upcoming draw (hero section)" })
  @ApiQuery({ name: "game", required: false, enum: ["loto6", "loto7"] })
  nextDraw(@Query("game") game?: string) {
    return this.hub.nextDraw(gameParam(game));
  }

  @Get("stats")
  @ApiOperation({ summary: "Hit rate summary and streak info" })
  @ApiQuery({ name: "game", required: false, enum: ["loto6", "loto7"] })
  stats(@Query("game") game?: string) {
    return this.hub.stats(gameParam(game));
  }
}
