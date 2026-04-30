import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { OperationsModule } from "../operations/operations.module.js";
import { GrowthAdminController } from "./growth-admin.controller.js";
import { GrowthAnalyticsService } from "./growth-analytics.service.js";
import { LearnerGrowthController } from "./learner-growth.controller.js";
import { PublicGrowthController } from "./public-growth.controller.js";
import { ReferralService } from "./referral.service.js";
import { ShareService } from "./share.service.js";

@Module({
  controllers: [GrowthAdminController, LearnerGrowthController, PublicGrowthController],
  exports: [GrowthAnalyticsService, ReferralService, ShareService],
  imports: [AdminModule, OperationsModule],
  providers: [GrowthAnalyticsService, ReferralService, ShareService]
})
export class GrowthModule {}
