import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { DailyRadarAdminController, DailyRadarController } from "./daily-radar.controller.js";
import { DailyRadarRepository } from "./daily-radar.repository.js";

@Module({
  controllers: [DailyRadarController, DailyRadarAdminController],
  imports: [AdminModule],
  providers: [DailyRadarRepository]
})
export class DailyRadarModule {}
