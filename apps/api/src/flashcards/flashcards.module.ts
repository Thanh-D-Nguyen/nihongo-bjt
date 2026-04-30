import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { MediaModule } from "../media/media.module.js";
import { MonetizationModule } from "../monetization/monetization.module.js";
import { FlashcardsAdminController } from "./flashcards-admin.controller.js";
import { FlashcardsController } from "./flashcards.controller.js";
import { DecksController, ReviewController } from "./canonical-flashcards.controller.js";
import { FlashcardsRepository } from "./flashcards.repository.js";
import { FlashcardsService } from "./flashcards.service.js";

@Module({
  controllers: [FlashcardsController, DecksController, ReviewController, FlashcardsAdminController],
  exports: [FlashcardsRepository],
  imports: [AdminModule, MediaModule, MonetizationModule],
  providers: [FlashcardsRepository, FlashcardsService]
})
export class FlashcardsModule {}
