import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * `GET /api/health/live` and `ready` (`checks` on ready only: database, keycloak_realm_admin, ...).
 */
export class HealthStatusOpenApiDto {
  @ApiProperty({ type: () => String, enum: ["ok", "degraded"] })
  status!: "ok" | "degraded";

  @ApiProperty({ type: () => String, example: "nihongo-bjt-api" })
  service!: string;

  @ApiProperty({ type: () => String, example: "0.0.0" })
  version!: string;

  @ApiProperty({ type: () => String, example: "2026-01-15T00:00:00.000Z" })
  checkedAt!: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "Map of dependency name → { status: ok|degraded, message?: string }"
  })
  checks?: Record<string, { message?: string; status: "degraded" | "ok" }>;
}

export class VersionOpenApiDto {
  @ApiProperty({ type: () => String, example: "nihongo-bjt-api" })
  service!: string;

  @ApiProperty({ type: () => String, example: "0.0.0" })
  version!: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  keycloakRealmAdmin?: { disabledReasons?: string[]; enabled: boolean };
}
