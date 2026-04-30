import {
  adminAssignUserPlanBodySchema,
  adminContentKindSchema,
  adminContentQuerySchema,
  adminContentSummaryQuerySchema,
  adminCreateContentSchema,
  adminCreateLexemeExampleBodySchema,
  adminDeleteLexemeExampleBodySchema,
  adminPatchContentBodySchema,
  adminPatchLexemeExampleBodySchema,
  adminPatchUserStatusBodySchema,
  adminReadingAssistReportsQuerySchema,
  adminUpdateContentStatusSchema,
  adminUserListQuerySchema,
  adminUserSupportNoteBodySchema,
  ADMIN_PERMISSION,
  canReadSensitiveUserProfile,
  createUserProfileSchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
  ApiConflictResponse,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";

import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import {
  AdminUserInviteRequestOpenApiDto,
  AdminUserInviteResponseOpenApiDto
} from "../openapi/dto/admin-user-invite-openapi.dto.js";
import { AdminModuleContractOpenApiDto } from "../openapi/dto/backend-api-openapi.dto.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { LogAdminAction } from "./admin-audit.decorator.js";
import { AdminRbacGuard } from "./admin-rbac.guard.js";
import { RequireAdminPermissions } from "./admin.rbac.js";
import { ADMIN_MODULE_CONTRACTS } from "./admin-module-contracts.js";
import { AdminRepository } from "./admin.repository.js";
import { AdminUserInviteService } from "./admin-user-invite.service.js";

@Controller("admin")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.core" })
@ApiTags("Admin")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@ApiOkResponse({ description: "Successful admin response." })
export class AdminController {
  constructor(
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(AdminRepository) private readonly adminRepository: AdminRepository,
    @Inject(AdminUserInviteService) private readonly adminUserInvite: AdminUserInviteService
  ) {}

  @Get("session")
  @ApiTags("Auth", "RBAC")
  @ApiOperation({
    summary: "Validate admin portal session (Keycloak JWT + realm role gate, linked `admin_actor`)."
  })
  @DocumentedHttpErrors()
  async session(@Req() req: Request) {
    return this.adminAuth.requireAdminPortalSession(req);
  }

  @Get("me")
  @ApiTags("Auth", "RBAC")
  @ApiOperation({
    summary: "Current admin principal: actor, display name, **permission codes** (from `authz`, not from JWT alone).",
    description:
      "Requires usable auth (Bearer or `x-admin-actor-id` in local dev). Used by the admin app shell (IAM)."
  })
  @DocumentedHttpErrors()
  async me(@Req() req: Request) {
    const principal = await this.adminAuth.loadAdminPrincipal(req);
    return this.adminRepository.me(principal.actorId);
  }

  @Get("module-contracts")
  @ApiTags("Admin", "Operations")
  @ApiOperation({
    summary: "List admin module contract readiness (implemented/partial/planned) for shell parity."
  })
  @ApiOkResponse({ type: AdminModuleContractOpenApiDto, isArray: true })
  @DocumentedHttpErrors()
  async moduleContracts(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "iam.manage",
      "admin.content.read",
      ADMIN_PERMISSION.supportUserRead,
      ADMIN_PERMISSION.supportUserWrite,
      ADMIN_PERMISSION.supportUserLegacy
    ]);
    return ADMIN_MODULE_CONTRACTS;
  }

  @Get("iam/roles")
  @ApiTags("IAM")
  @ApiOperation({ summary: "List IAM roles for admin governance console." })
  @DocumentedHttpErrors()
  async iamRoles(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["iam.manage", "viewer.audit"]);
    return this.adminRepository.iamRoles();
  }

  @Get("iam/permissions")
  @ApiTags("IAM")
  @ApiOperation({ summary: "List IAM permissions and role mapping counts." })
  @DocumentedHttpErrors()
  async iamPermissions(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["iam.manage", "viewer.audit"]);
    return this.adminRepository.iamPermissions();
  }

  @Get("iam/admins")
  @ApiTags("IAM")
  @ApiOperation({ summary: "List admin actors and their assigned role codes." })
  @DocumentedHttpErrors()
  async iamAdmins(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["iam.manage", "viewer.audit"]);
    return this.adminRepository.iamAdmins();
  }

  @Get("iam/role-audit")
  @ApiTags("IAM", "Audit")
  @ApiOperation({ summary: "Recent IAM role/permission related audit records." })
  @ApiQuery({ name: "limit", required: false, example: 50 })
  @DocumentedHttpErrors()
  async iamRoleAudit(@Req() req: Request, @Query("limit") limit: string | undefined) {
    await this.adminAuth.requireOneOfPermissions(req, ["iam.manage", "viewer.audit"]);
    return this.adminRepository.iamRoleAudit(Math.min(Math.max(Number(limit ?? 50), 1), 200));
  }

  @Get("content/summary")
  @ApiTags("Content")
  @ApiOperation({
    summary: "KPI + chart aggregates for content CMS (filtered).",
    description: "**RBAC:** `admin.content.read`. Supports filters: type, q, status, category, level, JLPT, stroke counts, etc."
  })
  @ApiQuery({ name: "type", required: true })
  @DocumentedHttpErrors()
  async contentSummary(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.adminAuth.requirePermission(req, "admin.content.read");
    const parsed = adminContentSummaryQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.adminRepository.contentSummary(
      parsed.data.type,
      parsed.data.q,
      parsed.data.status,
      {
        category: parsed.data.category,
        categoryGroup: parsed.data.categoryGroup,
        jlptLevel: parsed.data.jlptLevel,
        level: parsed.data.level,
        reading: parsed.data.reading,
        strokeCountMax: parsed.data.strokeCountMax,
        strokeCountMin: parsed.data.strokeCountMin
      }
    );
  }

  @Post("lexemes/:id/examples")
  @ApiTags("Content", "Dictionary")
  @ApiOperation({ summary: "Add example sentence link to a lexeme.", description: "**RBAC:** `admin.content.write`." })
  @ApiParam({ name: "id", description: "Lexeme id" })
  @DocumentedHttpErrors()
  async createLexemeExample(
    @Req() req: Request,
    @Param("id") lexemeId: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requirePermission(req, "admin.content.write");
    const parsed = adminCreateLexemeExampleBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.adminRepository.createLexemeExample(principal.actorId, lexemeId, parsed.data);
  }

  @Patch("lexemes/:id/examples/:linkId")
  @ApiTags("Content", "Dictionary")
  @ApiOperation({ summary: "Update linked example; **requires audit `reason` in body (Zod).**" })
  @ApiParam({ name: "id" })
  @ApiParam({ name: "linkId" })
  @DocumentedHttpErrors()
  async patchLexemeExample(
    @Req() req: Request,
    @Param("id") lexemeId: string,
    @Param("linkId") linkId: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requirePermission(req, "admin.content.write");
    const parsed = adminPatchLexemeExampleBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.adminRepository.updateLexemeExample(principal.actorId, lexemeId, linkId, parsed.data);
  }

  @Delete("lexemes/:id/examples/:linkId")
  @ApiTags("Content", "Dictionary")
  @ApiOperation({ summary: "Remove example link; body includes **reason** (audit).", description: "**RBAC:** `admin.content.write`." })
  @ApiParam({ name: "id" })
  @ApiParam({ name: "linkId" })
  @DocumentedHttpErrors()
  async deleteLexemeExample(
    @Req() req: Request,
    @Param("id") lexemeId: string,
    @Param("linkId") linkId: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requirePermission(req, "admin.content.write");
    const parsed = adminDeleteLexemeExampleBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.adminRepository.deleteLexemeExample(
      principal.actorId,
      lexemeId,
      linkId,
      parsed.data.reason
    );
  }

  @Get("content")
  @ApiTags("Content")
  @ApiOperation({
    summary: "Paginated content list (lexeme, kanji, grammar, example) with filters / search.",
    description: "**RBAC:** `admin.content.read`. Pagination: `page`, `pageSize` (see shared `adminContentQuerySchema`)."
  })
  @DocumentedHttpErrors()
  async content(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.adminAuth.requirePermission(req, "admin.content.read");
    const parsed = adminContentQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.adminRepository.content(
      parsed.data.type,
      parsed.data.q,
      parsed.data.status,
      parsed.data.page,
      parsed.data.pageSize,
      {
        category: parsed.data.category,
        categoryGroup: parsed.data.categoryGroup,
        jlptLevel: parsed.data.jlptLevel,
        level: parsed.data.level,
        reading: parsed.data.reading,
        strokeCountMax: parsed.data.strokeCountMax,
        strokeCountMin: parsed.data.strokeCountMin
      }
    );
  }

  @Post("content")
  @ApiTags("Content")
  @ApiOperation({ summary: "Create dictionary / kanji / grammar item (CMS).", description: "**RBAC:** `admin.content.write`." })
  @DocumentedHttpErrors()
  async createContent(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "admin.content.write");
    const parsed = adminCreateContentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.adminRepository.createContent(principal.actorId, parsed.data);
  }

  @Patch("content/:type/:id/status")
  @ApiTags("Content")
  @ApiOperation({
    summary: "Transition content status (active / archived / …) with **audit reason**.",
    description: "**RBAC:** `admin.content.write`."
  })
  @ApiParam({ name: "type", enum: ["lexeme", "kanji", "grammar", "example"] })
  @ApiParam({ name: "id" })
  @DocumentedHttpErrors()
  async updateContentStatus(
    @Req() req: Request,
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requirePermission(req, "admin.content.write");
    const parsedType = adminContentKindSchema.safeParse(type);
    const parsedBody = adminUpdateContentStatusSchema.safeParse(body);
    if (!parsedType.success || !parsedBody.success) {
      throw new BadRequestException("Invalid content status request");
    }

    return this.adminRepository.updateContentStatus({
      actorId: principal.actorId,
      id,
      reason: parsedBody.data.reason,
      status: parsedBody.data.status,
      type: parsedType.data
    });
  }

  @Patch("content/:type/:id")
  @ApiTags("Content")
  @ApiOperation({ summary: "Patch fields on content item; **not** for `example` (returns 400).", description: "**RBAC:** `admin.content.write`." })
  @ApiParam({ name: "type" })
  @ApiParam({ name: "id" })
  @DocumentedHttpErrors()
  async patchContent(
    @Req() req: Request,
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requirePermission(req, "admin.content.write");
    const parsedType = adminContentKindSchema.safeParse(type);
    if (!parsedType.success) {
      throw new BadRequestException("Invalid content type");
    }
    if (parsedType.data === "example") {
      throw new BadRequestException("This content type does not support field updates from admin");
    }
    const parsedBody = adminPatchContentBodySchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException(parsedBody.error.flatten());
    }
    return this.adminRepository.patchContent(principal.actorId, parsedType.data, id, parsedBody.data);
  }

  @Get("users/kpis")
  @ApiTags("Admin Users")
  @ApiOperation({
    summary: "KPIs for the user management console (totals, paid-like, suspended, onboarding open).",
    description: "One of: `support.user.read` | `support.user.write` | `support.user` (legacy)."
  })
  @DocumentedHttpErrors()
  async usersKpis(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [
      ADMIN_PERMISSION.supportUserRead,
      ADMIN_PERMISSION.supportUserWrite,
      ADMIN_PERMISSION.supportUserLegacy
    ]);
    return this.adminRepository.usersConsoleKpis();
  }

  @Get("users")
  @ApiTags("Admin Users")
  @ApiOperation({
    summary: "Paginated user list: filters `q`, `status`, `plan`, `uiLocale`, `lastActiveAfter`/`Before`, `page`, `pageSize` (Zod, ISO datetimes for dates).",
    description: "Support permissions; returns plan summary, auth sync, quota usage."
  })
  @DocumentedHttpErrors()
  async usersConsoleList(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.adminAuth.requireOneOfPermissions(req, [
      ADMIN_PERMISSION.supportUserRead,
      ADMIN_PERMISSION.supportUserWrite,
      ADMIN_PERMISSION.supportUserLegacy
    ]);
    const parsed = adminUserListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.adminRepository.usersConsoleList(parsed.data);
  }

  @Get("users/:id/audit")
  @ApiTags("Admin Users", "Audit")
  @ApiOperation({ summary: "Admin audit log rows for a user (targeted)." })
  @ApiParam({ name: "id", description: "`user_profile` id" })
  @ApiQuery({ name: "limit", example: 50, required: false })
  @DocumentedHttpErrors()
  async userAudit(
    @Req() req: Request,
    @Param("id") id: string,
    @Query("limit") limit: string | undefined
  ) {
    await this.adminAuth.requireOneOfPermissions(req, [
      ADMIN_PERMISSION.supportUserRead,
      ADMIN_PERMISSION.supportUserWrite,
      ADMIN_PERMISSION.supportUserLegacy
    ]);
    return this.adminRepository.userAuditForTarget(
      id,
      Math.min(Math.max(Number(limit ?? 50), 1), 200)
    );
  }

  @Get("users/:id")
  @ApiTags("Admin Users")
  @ApiOperation({ summary: "User detail: profile, plan, learning, login events, usage counters (support read; sensitive fields privacy-gated)." })
  @ApiParam({ name: "id" })
  @DocumentedHttpErrors()
  async userDetail(@Req() req: Request, @Param("id") id: string) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [
      ADMIN_PERMISSION.supportUserRead,
      ADMIN_PERMISSION.supportUserWrite,
      ADMIN_PERMISSION.supportUserLegacy
    ]);
    const includeSensitive = canReadSensitiveUserProfile(principal.permissions);
    await this.adminRepository.recordUserDetailAccess(principal.actorId, id, includeSensitive);
    return this.adminRepository.userConsoleDetail(id, { includeSensitive });
  }

  @Patch("users/:id/status")
  @ApiTags("Admin Users")
  @ApiOperation({
    summary: "Set **user_profile.status** (pending, active, disabled, suspended, deleted).",
    description:
      "Requires **reason** (audit). RBAC: `support.user.write` or legacy `support.user`."
  })
  @ApiParam({ name: "id" })
  @ApiBody({ description: "Zod: `{ status, reason }` — reason min length for audit." })
  @DocumentedHttpErrors()
  async userPatchStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [
      ADMIN_PERMISSION.supportUserWrite,
      ADMIN_PERMISSION.supportUserLegacy
    ]);
    const parsed = adminPatchUserStatusBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.adminRepository.patchUserAccountStatus(principal.actorId, id, parsed.data);
  }

  @Patch("users/:id/plan")
  @ApiTags("Admin Users", "Monetization")
  @ApiOperation({
    summary: "Assign plan / subscription (admin). **reason** in body for audit + monetization audit log.",
    description: "**RBAC:** `admin.monetization.write`."
  })
  @ApiParam({ name: "id" })
  @DocumentedHttpErrors()
  async userPatchPlan(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requirePermission(req, "admin.monetization.write");
    const parsed = adminAssignUserPlanBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.adminRepository.assignUserPlan(principal.actorId, id, parsed.data);
  }

  @Post("users/:id/support-notes")
  @ApiTags("Admin Users")
  @ApiOperation({
    summary: "Append support note (audited) with **reason**.",
    description: "RBAC: `support.user.write` or `support.user`."
  })
  @ApiParam({ name: "id" })
  @DocumentedHttpErrors()
  async userSupportNote(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [
      ADMIN_PERMISSION.supportUserWrite,
      ADMIN_PERMISSION.supportUserLegacy
    ]);
    const parsed = adminUserSupportNoteBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.adminRepository.addUserSupportNote(principal.actorId, id, parsed.data);
  }

  /** Production create / invite (Keycloak-aware, audited). Prefer over legacy POST /admin/users. */
  @Post("users/invite")
  @ApiTags("Admin Users", "Auth")
  @ApiOperation({
    summary: "Create or invite user (no password in DB; Keycloak optional).",
    description:
      "RBAC: one of `admin.users.create`, `user.create`, `support.user.write`, `support.user`. " +
      "Non-free / quota override needs `admin.monetization.write`. " +
      "Body validated by `adminUserInviteBodySchema` — includes `creationReason`, `planReason`, " +
      "`creationMode` (invite_only | create_keycloak_user | sync_existing_keycloak_user), learner fields if account is learner, **no** password or keycloak_id from client. " +
      "409: duplicate email (see `message.code: email_taken`)."
  })
  @ApiBody({ type: AdminUserInviteRequestOpenApiDto, description: "Full schema in @nihongo-bjt/shared (Zod) — this DTO is a non-exhaustive OpenAPI view." })
  @ApiOkResponse({ description: "Invite result: user row, `keycloak` sync summary (no secrets), optional subscription", type: AdminUserInviteResponseOpenApiDto })
  @ApiConflictResponse({ description: "Email already registered (body may include `userId` for existing profile)." })
  @DocumentedHttpErrors()
  async inviteUser(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [
      "admin.users.create",
      "user.create",
      ADMIN_PERMISSION.supportUserWrite,
      ADMIN_PERMISSION.supportUserLegacy
    ]);
    return this.adminUserInvite.inviteOrCreate(principal.actorId, body, principal.permissions);
  }

  /** @deprecated Minimal profile row; prefer POST /admin/users/invite */
  @Post("users")
  @ApiTags("Admin Users")
  @ApiOperation({ summary: "Legacy create profile row (deprecated; no Keycloak/invite flow).", description: "RBAC: support write. Prefer `POST /admin/users/invite`." })
  @DocumentedHttpErrors()
  async createUser(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [
      ADMIN_PERMISSION.supportUserWrite,
      ADMIN_PERMISSION.supportUserLegacy
    ]);
    const parsed = createUserProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.adminRepository.createUser(principal.actorId, parsed.data);
  }

  @Get("audit")
  @ApiTags("Audit")
  @ApiOperation({ summary: "Global admin audit log (recent).", description: "**RBAC:** `viewer.audit`." })
  @ApiQuery({ name: "limit", required: false, example: 20 })
  @DocumentedHttpErrors()
  async audit(@Req() req: Request, @Query("limit") limit: string | undefined) {
    await this.adminAuth.requirePermission(req, "viewer.audit");
    return this.adminRepository.audit(Math.min(Math.max(Number(limit ?? 20), 1), 100));
  }

  @Get("support/notes")
  @ApiTags("Admin Users", "Support")
  @ApiOperation({ summary: "List support notes (audit entries for support_note actions).", description: "**RBAC:** `support.user.read` or `support.user.write`." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "userId", required: false, schema: { type: "string" } })
  @DocumentedHttpErrors()
  async supportNotes(
    @Req() req: Request,
    @Query("limit") limit: string | undefined,
    @Query("offset") offset: string | undefined,
    @Query("userId") userId: string | undefined
  ) {
    await this.adminAuth.requireOneOfPermissions(req, [
      ADMIN_PERMISSION.supportUserRead,
      ADMIN_PERMISSION.supportUserWrite,
      ADMIN_PERMISSION.supportUserLegacy
    ]);
    return {
      items: await this.adminRepository.supportNotes({
        limit: Math.min(Math.max(Number(limit ?? 50), 1), 200),
        offset: Math.max(Number(offset ?? 0), 0),
        userId: userId?.trim() || undefined
      })
    };
  }

  @Get("reading-assist/reports")
  @ApiTags("Reading Assist", "Admin")
  @ApiOperation({ summary: "Admin reports (dictionary gaps, tokenization failures, …).", description: "**RBAC:** `admin.content.read`." })
  @DocumentedHttpErrors()
  async readingAssistReports(
    @Req() req: Request,
    @Query() query: Record<string, string | undefined>
  ) {
    await this.adminAuth.requirePermission(req, "admin.content.read");
    const parsed = adminReadingAssistReportsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.adminRepository.readingAssistReports({
      kind: parsed.data.kind,
      limit: parsed.data.limit
    });
  }
}
