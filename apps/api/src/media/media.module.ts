import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { OperationsModule } from "../operations/operations.module.js";
import { MediaAdminController } from "./media-admin.controller.js";
import { MediaController } from "./media.controller.js";
import { MediaService } from "./media.service.js";

@Module({
  controllers: [MediaController, MediaAdminController],
  exports: [MediaService],
  imports: [OperationsModule, AdminModule],
  providers: [MediaService]
})
export class MediaModule {}
