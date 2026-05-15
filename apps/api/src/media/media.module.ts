import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { RuntimeFeatureGateModule } from "../operations/runtime-feature-gate.module.js";
import { ImageSearchService } from "./image-search.service.js";
import { MediaAdminController } from "./media-admin.controller.js";
import { MediaController } from "./media.controller.js";
import { MediaService } from "./media.service.js";

@Module({
  controllers: [MediaController, MediaAdminController],
  exports: [MediaService, ImageSearchService],
  imports: [RuntimeFeatureGateModule, AdminModule],
  providers: [MediaService, ImageSearchService]
})
export class MediaModule {}
