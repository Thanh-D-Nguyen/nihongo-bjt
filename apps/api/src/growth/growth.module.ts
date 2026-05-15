import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { FlashcardsModule } from "../flashcards/flashcards.module.js";
import { OperationsModule } from "../operations/operations.module.js";
import { GrowthAdminController } from "./growth-admin.controller.js";
import { GrowthAnalyticsService } from "./growth-analytics.service.js";
import { GrowthCampaignsAdminController } from "./growth-campaigns-admin.controller.js";
import { GrowthCampaignsAdminRepository } from "./growth-campaigns-admin.repository.js";
import { GrowthPostcardsAdminController } from "./growth-postcards-admin.controller.js";
import { GrowthPostcardsAdminRepository } from "./growth-postcards-admin.repository.js";
import { GrowthReferralsAdminController } from "./growth-referrals-admin.controller.js";
import { GrowthReferralsAdminRepository } from "./growth-referrals-admin.repository.js";
import { GrowthSocialAdminController } from "./growth-social-admin.controller.js";
import { GrowthSocialAdminRepository } from "./growth-social-admin.repository.js";
import { LearnerGrowthController } from "./learner-growth.controller.js";
import { PublicGrowthController } from "./public-growth.controller.js";
import { ReferralService } from "./referral.service.js";
import { ShareService } from "./share.service.js";

@Module({
  controllers: [
    GrowthAdminController,
    GrowthCampaignsAdminController,
    GrowthPostcardsAdminController,
    GrowthReferralsAdminController,
    GrowthSocialAdminController,
    LearnerGrowthController,
    PublicGrowthController
  ],
  exports: [GrowthAnalyticsService, ReferralService, ShareService],
  imports: [AdminModule, FlashcardsModule, OperationsModule],
  providers: [
    GrowthAnalyticsService,
    GrowthCampaignsAdminRepository,
    GrowthPostcardsAdminRepository,
    GrowthReferralsAdminRepository,
    GrowthSocialAdminRepository,
    ReferralService,
    ShareService
  ]
})
export class GrowthModule {}
