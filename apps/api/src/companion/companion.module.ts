import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module.js";
import { FlashcardsModule } from "../flashcards/flashcards.module.js";
import { MonetizationModule } from "../monetization/monetization.module.js";
import { CompanionController } from "./companion.controller.js";
import { CompanionHintRepository } from "./companion-hint.repository.js";
import { CompanionHintService } from "./companion-hint.service.js";

@Module({
  controllers: [CompanionController],
  imports: [AnalyticsModule, FlashcardsModule, MonetizationModule],
  providers: [CompanionHintRepository, CompanionHintService]
})
export class CompanionModule {}
