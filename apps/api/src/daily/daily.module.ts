import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { AdminDailyController, DailyController } from "./daily.controller.js";
import { DailyRepository } from "./daily.repository.js";

@Module({
  controllers: [DailyController, AdminDailyController],
  imports: [AdminModule],
  providers: [DailyRepository]
})
export class DailyModule {}
