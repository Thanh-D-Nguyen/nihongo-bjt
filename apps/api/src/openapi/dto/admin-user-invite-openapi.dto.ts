import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Subset of `adminUserInviteBodySchema` for OpenAPI; validation remains Zod in the controller.
 * **No passwords** — identity is Keycloak; `creationReason` and plan reasons are for audit.
 */
export class AdminUserInviteRequestOpenApiDto {
  @ApiProperty({ type: String, example: "new.user@example.com" })
  email!: string;

  @ApiProperty({ type: String, example: "Yamada Taro" })
  displayName!: string;

  @ApiProperty({
    type: String,
    description: "Application role class (not the same as internal authz role codes in body).",
    enum: [
      "learner",
      "content_editor",
      "support_staff",
      "analytics_viewer",
      "billing_manager",
      "admin"
    ],
    example: "learner"
  })
  accountType!: string;

  @ApiProperty({ enum: ["en", "ja", "vi"], example: "vi" })
  uiLocale!: "en" | "ja" | "vi";

  @ApiProperty({ enum: ["en", "ja", "vi"], example: "vi" })
  explanationLocale!: "en" | "ja" | "vi";

  @ApiProperty({ type: String, example: "Asia/Tokyo" })
  timezone!: string;

  @ApiProperty({
    type: String,
    enum: ["create_keycloak_user", "invite_only", "sync_existing_keycloak_user"],
    example: "invite_only"
  })
  creationMode!: string;

  @ApiProperty({ type: String, example: "Create test learner for QA (onboarding)" })
  creationReason!: string;

  @ApiProperty({ type: String, example: "free" })
  planSlug!: string;

  @ApiProperty({ type: String, example: "Assigned free for QA" })
  planReason!: string;
}

class AdminUserInviteUserOpenApiDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ type: String })
  accountType!: string;

  @ApiProperty({ type: String, description: "User profile account status" })
  status!: string;

  @ApiProperty({ type: String, description: "Keycloak `sub` when linked" })
  keycloakSubject!: string;

  @ApiProperty({ type: String, description: "Keycloak / auth sync state" })
  authSyncStatus!: string;
}

class AdminUserInviteInvitationOpenApiDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  status!: string;
}

class AdminUserInviteKeycloakOpenApiDto {
  @ApiProperty({ type: Boolean })
  configured!: boolean;

  @ApiProperty({ type: Boolean })
  emailActionSent!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  keycloakError!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  keycloakUserId!: string | null;

  @ApiProperty({ type: [String] })
  missingConfigReasons!: string[];

  @ApiProperty({ type: String })
  mode!: string;

  @ApiProperty({ type: Boolean })
  usedInviteOnlyFallback!: boolean;
}

/**
 * @example
 * ```json
 * { "keycloak": { "configured": true, "usedInviteOnlyFallback": false, "keycloakError": null, "emailActionSent": true } }
 * ```
 */
export class AdminUserInviteResponseOpenApiDto {
  @ApiProperty({ type: () => AdminUserInviteUserOpenApiDto })
  user!: AdminUserInviteUserOpenApiDto;

  @ApiPropertyOptional({ type: () => AdminUserInviteInvitationOpenApiDto, nullable: true })
  invitation!: AdminUserInviteInvitationOpenApiDto | null;

  @ApiProperty({ type: () => AdminUserInviteKeycloakOpenApiDto })
  keycloak!: AdminUserInviteKeycloakOpenApiDto;
}
