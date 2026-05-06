import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { MediaModule } from "../media/media.module.js";
import { ContentEnrichmentAdminController } from "./content-enrichment-admin.controller.js";
import { ContentEnrichmentAdminRepository } from "./content-enrichment-admin.repository.js";
import { ContentVersionsAdminController } from "./content-versions-admin.controller.js";
import { ContentVersionsAdminRepository } from "./content-versions-admin.repository.js";
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
    ContentEnrichmentAdminController,
    ContentVersionsAdminController,
    DictionaryController,
    KanjiController,
    GrammarController,
    ExamplesController,
    VijaController
  ],
  imports: [AdminModule, MediaModule],
  providers: [ContentRepository, ContentEnrichmentAdminRepository, ContentVersionsAdminRepository],
  exports: [ContentRepository]
})
export class ContentModule {}
