import type { HealthStatus } from "@nihongo-bjt/shared";
import { Controller, Get, HttpCode, HttpStatus, Inject } from "@nestjs/common";
import { ApiOperation, ApiOkResponse, ApiResponse, ApiTags } from "@nestjs/swagger";

import { ApiErrorResponseDto } from "../openapi/dto/api-error.dto.js";
import { HealthStatusOpenApiDto, VersionOpenApiDto } from "../openapi/dto/health-openapi.dto.js";
import { HealthService } from "./health.service.js";

@Controller("health")
@ApiTags("System Health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get("live")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Liveness: process is up (no deep dependency checks)." })
  @ApiOkResponse({ description: "OK", type: HealthStatusOpenApiDto })
  @ApiResponse({ description: "Unexpected server failure.", status: 500, type: ApiErrorResponseDto })
  live(): HealthStatus {
    return this.healthService.live();
  }

  @Get("ready")
  @ApiOperation({
    summary: "Readiness: DB and optional checks (e.g. `keycloak_realm_admin` configured message)."
  })
  @ApiOkResponse({ description: "OK or degraded if a check fails", type: HealthStatusOpenApiDto })
  @ApiResponse({ description: "Unexpected server failure.", status: 500, type: ApiErrorResponseDto })
  async ready(): Promise<HealthStatus> {
    return this.healthService.ready();
  }

  @Get("version")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Build/service version and Keycloak admin integration **flags** (no secrets)." })
  @ApiOkResponse({ description: "Version payload", type: VersionOpenApiDto })
  @ApiResponse({ description: "Unexpected server failure.", status: 500, type: ApiErrorResponseDto })
  version() {
    return this.healthService.version();
  }
}
