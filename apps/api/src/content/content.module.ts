import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { ContentAdminController } from "./content-admin.controller.js";
import { ContentController } from "./content.controller.js";
import { ContentRepository } from "./content.repository.js";
import {
  DictionaryController,
  ExamplesController,
  GrammarController,
  KanjiController,
  VijaController
} from "./canonical-content.controller.js";

@Module({
  controllers: [
    ContentController,
    ContentAdminController,
    DictionaryController,
    KanjiController,
    GrammarController,
    ExamplesController,
    VijaController
  ],
  imports: [AdminModule],
  providers: [ContentRepository],
  exports: [ContentRepository]
})
export class ContentModule {}
