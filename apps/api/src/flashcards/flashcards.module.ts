import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { GamificationModule } from "../gamification/gamification.module.js";
import { MediaModule } from "../media/media.module.js";
import { MonetizationModule } from "../monetization/monetization.module.js";
import { FlashcardGenService } from "./flashcard-gen.service.js";
import { FlashcardStylesAdminController } from "./flashcard-styles-admin.controller.js";
import { FlashcardStylesController } from "./flashcard-styles.controller.js";
import { FlashcardStylesService } from "./flashcard-styles.service.js";
import { FlashcardsAdminController } from "./flashcards-admin.controller.js";
import { FlashcardsAdminRepository } from "./flashcards-admin.repository.js";
import { FlashcardsController } from "./flashcards.controller.js";
import { DecksController, ReviewController } from "./canonical-flashcards.controller.js";
import { FlashcardsRepository } from "./flashcards.repository.js";
import { FlashcardsService } from "./flashcards.service.js";

@Module({
  controllers: [
    FlashcardsController,
    DecksController,
    ReviewController,
    FlashcardsAdminController,
    FlashcardStylesController,
    FlashcardStylesAdminController
  ],
  exports: [FlashcardsRepository],
  imports: [AdminModule, GamificationModule, MediaModule, MonetizationModule],
  providers: [
    FlashcardsRepository,
    FlashcardsService,
    FlashcardsAdminRepository,
    FlashcardGenService,
    FlashcardStylesService
  ]
})
export class FlashcardsModule {}
