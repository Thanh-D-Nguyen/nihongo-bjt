import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { LegalConsentController } from "./legal-consent.controller.js";
import { LegalConsentService } from "./legal-consent.service.js";
import { LegalInfoController } from "./legal-info.controller.js";
import { LegalPolicyAdminController } from "./legal-policy-admin.controller.js";
import { LegalPolicyAdminService } from "./legal-policy-admin.service.js";

@Module({
  controllers: [LegalConsentController, LegalInfoController, LegalPolicyAdminController],
  exports: [LegalConsentService],
  imports: [AdminModule],
  providers: [LegalConsentService, LegalPolicyAdminService]
})
export class LegalModule {}
