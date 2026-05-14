import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

import { AutofillService, type AutofillMode, type AutofillFormType } from "./autofill.service.js";

const VALID_FORM_TYPES: AutofillFormType[] = [
  "battle-bot",
  "battle-config",
  "mock-exam",
  "quiz-template",
  "remediation",
  "question-bank",
  "growth-social",
  "growth-postcard",
  "daily-hub",
  "daily-radar-module",
  "daily-radar-card",
];

const VALID_MODES: AutofillMode[] = ["template", "ai"];

@Controller("admin/autofill")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("content")
@LogAdminAction({ resourceType: "admin.autofill" })
@ApiTags("Admin Autofill")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class AutofillController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(AutofillService) private readonly svc: AutofillService
  ) {}

  @Post("generate")
  @ApiOperation({ summary: "Generate auto-fill data for an admin form" })
  @ApiOkResponse({ description: "Generated field values" })
  async generate(
    @Req() req: Request,
    @Body() body: { formType?: string; mode?: string; locale?: string; context?: Record<string, unknown> }
  ) {
    await this.auth.requireOneOfPermissions(req, [
      "battle.manage",
      "assessment.manage",
      "admin.content.write",
    ]);

    const formType = body.formType as AutofillFormType | undefined;
    const mode = (body.mode ?? "template") as AutofillMode;

    if (!formType || !VALID_FORM_TYPES.includes(formType)) {
      throw new BadRequestException(
        `Invalid formType. Must be one of: ${VALID_FORM_TYPES.join(", ")}`
      );
    }
    if (!VALID_MODES.includes(mode)) {
      throw new BadRequestException(`Invalid mode. Must be one of: ${VALID_MODES.join(", ")}`);
    }

    const fields = await this.svc.generate({
      formType,
      mode,
      locale: body.locale ?? "vi",
      context: body.context,
    });

    return { formType, mode, fields };
  }
}
