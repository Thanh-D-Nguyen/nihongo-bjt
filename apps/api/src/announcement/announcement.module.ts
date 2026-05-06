import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { AnnouncementAdminController } from "./announcement-admin.controller.js";
import { AnnouncementController } from "./announcement.controller.js";
import { AnnouncementRepository } from "./announcement.repository.js";

@Module({
  controllers: [AnnouncementController, AnnouncementAdminController],
  imports: [AdminModule],
  providers: [AnnouncementRepository],
})
export class AnnouncementModule {}
