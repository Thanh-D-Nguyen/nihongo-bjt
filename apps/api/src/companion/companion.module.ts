import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { AnalyticsModule } from "../analytics/analytics.module.js";
import { FlashcardsModule } from "../flashcards/flashcards.module.js";
import { MonetizationModule } from "../monetization/monetization.module.js";
import { CompanionAdminController } from "./companion-admin.controller.js";
import { CompanionController } from "./companion.controller.js";
import { CompanionHintRepository } from "./companion-hint.repository.js";
import { CompanionHintService } from "./companion-hint.service.js";
import { CompanionTipService } from "./companion-tip.service.js";

@Module({
  controllers: [CompanionController, CompanionAdminController],
  imports: [AdminModule, AnalyticsModule, FlashcardsModule, MonetizationModule],
  providers: [CompanionHintRepository, CompanionHintService, CompanionTipService]
})
export class CompanionModule {}
