import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { PrivacyRequestService } from "./privacy-request.service.js";

const PRIVACY_READ_PERMS = [
  "iam.manage",
  "support.user.read",
  "support.user.write",
  "viewer.audit",
  "admin.privacy.read",
  "admin.privacy.write",
  "privacy.manage"
];
const PRIVACY_WRITE_PERMS = [
  "iam.manage",
  "admin.privacy.write",
  "privacy.manage"
];

const listQuerySchema = z.object({
  kind: z.enum(["export", "delete"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional()
});

const reasonSchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

const fulfillSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  /** Optional download URL or summary payload. Privacy-safe. */
  downloadUrl: z.string().trim().url().max(2000).optional(),
  notes: z.string().trim().max(2000).optional()
});

const erasureConfirmSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  /** Must equal the request id; client requires admin to type the id to confirm irreversible erasure. */
  confirmationToken: z.string().trim().min(1).max(100)
});

@Controller("admin/privacy")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.privacy_request" })
@ApiTags("Admin Privacy")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class PrivacyAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(PrivacyRequestService) private readonly privacyService: PrivacyRequestService
  ) {}

  @Get("requests")
  @ApiOperation({
    summary:
      "List privacy data-subject requests (export/erasure) with optional kind/status filters and pagination."
  })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "kind", required: false, schema: { type: "string", enum: ["export", "delete"] } })
  @ApiQuery({
    name: "status",
    required: false,
    schema: { type: "string", enum: ["pending", "processing", "completed", "failed"] }
  })
  @ApiOkResponse({ description: "Paginated list of privacy requests." })
  async listRequests(@Req() req: Request, @Query() query: Record<string, unknown>) {
    await this.auth.requireOneOfPermissions(req, PRIVACY_READ_PERMS);
    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.privacyService.adminListRequests(parsed.data);
  }

  @Get("requests/:id")
  @ApiOperation({ summary: "Privacy request detail with audit trail." })
  async detail(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string) {
    await this.auth.requireOneOfPermissions(req, PRIVACY_READ_PERMS);
    const found = await this.privacyService.adminGetRequest(id);
    if (!found) throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND" });
    return found;
  }

  @Patch("requests/:id/acknowledge")
  @ApiOperation({
    summary:
      "Acknowledge a pending privacy request (status pending→processing). Requires reason; audited."
  })
  async acknowledge(
    @Req() req: Request,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown
  ) {
    const principal = await this.auth.requireOneOfPermissions(req, PRIVACY_WRITE_PERMS);
    const parsed = reasonSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.privacyService.adminTransition({
      actorId: principal.actorId,
      from: ["pending"],
      id,
      reason: parsed.data.reason,
      to: "processing"
    });
  }

  @Post("requests/:id/fulfill")
  @ApiOperation({
    summary:
      "Fulfil an export/access request: marks status=completed and stores resultPayload (downloadUrl/notes). Audited."
  })
  async fulfill(
    @Req() req: Request,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown
  ) {
    const principal = await this.auth.requireOneOfPermissions(req, PRIVACY_WRITE_PERMS);
    const parsed = fulfillSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.privacyService.adminFulfill({
      actorId: principal.actorId,
      downloadUrl: parsed.data.downloadUrl ?? null,
      id,
      notes: parsed.data.notes ?? null,
      reason: parsed.data.reason
    });
  }

  @Post("requests/:id/reject")
  @ApiOperation({
    summary:
      "Reject a privacy request with mandatory reason (status→failed, lastError=reason). Audited."
  })
  async reject(
    @Req() req: Request,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown
  ) {
    const principal = await this.auth.requireOneOfPermissions(req, PRIVACY_WRITE_PERMS);
    const parsed = reasonSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.privacyService.adminReject({
      actorId: principal.actorId,
      id,
      reason: parsed.data.reason
    });
  }

  @Post("requests/:id/erasure-confirm")
  @ApiOperation({
    summary:
      "Irreversibly fulfil an erasure (delete) request. Requires confirmationToken === request id. Audited."
  })
  async erasureConfirm(
    @Req() req: Request,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown
  ) {
    const principal = await this.auth.requireOneOfPermissions(req, PRIVACY_WRITE_PERMS);
    const parsed = erasureConfirmSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.confirmationToken !== id) {
      throw new BadRequestException({
        code: "PRIVACY_ERASURE_CONFIRMATION_MISMATCH",
        message: "confirmationToken must match request id"
      });
    }
    return this.privacyService.adminEraseConfirm({
      actorId: principal.actorId,
      id,
      reason: parsed.data.reason
    });
  }
}
