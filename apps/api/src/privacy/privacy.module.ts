import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { PrivacyAdminController } from "./privacy-admin.controller.js";
import { PrivacyRequestController } from "./privacy-request.controller.js";
import { PrivacyRequestService } from "./privacy-request.service.js";

@Module({
  controllers: [PrivacyRequestController, PrivacyAdminController],
  exports: [PrivacyRequestService],
  imports: [AdminModule],
  providers: [PrivacyRequestService]
})
export class PrivacyModule {}
