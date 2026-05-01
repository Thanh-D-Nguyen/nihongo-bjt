import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { AdminDailyController, DailyController } from "./daily.controller.js";
import { DailyItemsAdminController } from "./daily-items-admin.controller.js";
import { DailyItemsAdminRepository } from "./daily-items-admin.repository.js";
import { DailyRepository } from "./daily.repository.js";

@Module({
  controllers: [DailyController, AdminDailyController, DailyItemsAdminController],
  imports: [AdminModule],
  providers: [DailyRepository, DailyItemsAdminRepository]
})
export class DailyModule {}
