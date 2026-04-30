import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { AdminAuthService } from "../../admin/admin-auth.service.js";
import { LogAdminAction } from "../../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../../openapi/common-decorators.js";
import { BillingWebhookService } from "./billing-webhook.service.js";

const webhookIngestSchema = z.object({
  provider: z.enum(["local"]),
  eventType: z.string().min(1).max(120),
  idempotencyKey: z.string().uuid("Idempotency key must be a UUID"),
  payload: z.record(z.string(), z.unknown())
});

const WEBHOOK_READ_PERMS = ["admin.monetization.read", "billing.webhook.read"];
const WEBHOOK_MANAGE_PERMS = ["admin.monetization.write", "billing.webhook.manage"];

@Controller("admin/billing/webhook")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("billing_webhook")
@LogAdminAction({ resourceType: "admin.billing_webhook" })
@ApiTags("Admin", "Billing", "Webhook")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class BillingWebhookController {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly webhookService: BillingWebhookService
  ) {}

  @Post()
  @ApiOperation({
    summary: "Ingest billing webhook (local provider; signature verified; idempotent)",
    description: "Signature verification, idempotency, dead-letter, and audit enforced. rawPayload access-gated."
  })
  async ingest(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers("x-webhook-signature") signatureHeader?: string
  ) {
    await this.adminAuth.requireOneOfPermissions(req, WEBHOOK_MANAGE_PERMS);
    const parsed = webhookIngestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.webhookService.ingestWebhook({
      eventType: parsed.data.eventType,
      idempotencyKey: parsed.data.idempotencyKey,
      provider: parsed.data.provider,
      rawPayload: parsed.data.payload,
      signatureHeader
    });
  }

  @Get()
  @ApiOperation({ summary: "List webhook events for audit (no rawPayload; RBAC: billing read)" })
  async list(
    @Req() req: Request,
    @Query("provider") provider?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("take") take?: string
  ) {
    await this.adminAuth.requireOneOfPermissions(req, WEBHOOK_READ_PERMS);
    return this.webhookService.listForAdmin({
      from,
      provider,
      status,
      take: take ? parseInt(take, 10) : undefined,
      to
    });
  }

  @Get(":id/raw")
  @ApiParam({ name: "id", description: "Webhook event UUID" })
  @ApiOperation({
    summary: "Get raw webhook payload (RBAC: billing.webhook.manage)",
    description: "Raw payload only accessible by admin actors with explicit manage permission."
  })
  async getRaw(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string) {
    await this.adminAuth.requireOneOfPermissions(req, WEBHOOK_MANAGE_PERMS);
    return this.webhookService.getRawPayload(id);
  }
}
