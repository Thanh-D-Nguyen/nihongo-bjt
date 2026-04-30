import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { AdminAnalyticsController, AnalyticsController } from "./analytics.controller.js";
import { AnalyticsRepository } from "./analytics.repository.js";

@Module({
  controllers: [AnalyticsController, AdminAnalyticsController],
  exports: [AnalyticsRepository],
  imports: [AdminModule],
  providers: [AnalyticsRepository]
})
export class AnalyticsModule {}
