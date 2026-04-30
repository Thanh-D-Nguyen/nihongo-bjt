import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module.js";
import { FlashcardsModule } from "../flashcards/flashcards.module.js";
import { OperationsModule } from "../operations/operations.module.js";
import { DictionaryLookupService } from "./dictionary-lookup.service.js";
import { ReadingAssistController } from "./reading-assist.controller.js";
import { ReadingAssistService } from "./reading-assist.service.js";

@Module({
  controllers: [ReadingAssistController],
  exports: [ReadingAssistService],
  imports: [AnalyticsModule, FlashcardsModule, OperationsModule],
  providers: [DictionaryLookupService, ReadingAssistService]
})
export class ReadingAssistModule {}
