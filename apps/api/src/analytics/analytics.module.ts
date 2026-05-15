import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { AdminAnalyticsController, AnalyticsController } from "./analytics.controller.js";
import { AnalyticsRepository } from "./analytics.repository.js";
import { AnalyticsBattleAdminController } from "./analytics-battle-admin.controller.js";
import { AnalyticsBattleAdminRepository } from "./analytics-battle-admin.repository.js";
import { AnalyticsBjtAdminController } from "./analytics-bjt-admin.controller.js";
import { AnalyticsBjtAdminRepository } from "./analytics-bjt-admin.repository.js";
import { AnalyticsContentAdminController } from "./analytics-content-admin.controller.js";
import { AnalyticsContentAdminRepository } from "./analytics-content-admin.repository.js";
import { AnalyticsFlashcardsAdminController } from "./analytics-flashcards-admin.controller.js";
import { AnalyticsFlashcardsAdminRepository } from "./analytics-flashcards-admin.repository.js";
import { AnalyticsGrowthAdminController } from "./analytics-growth-admin.controller.js";
import { AnalyticsGrowthAdminRepository } from "./analytics-growth-admin.repository.js";
import { AnalyticsLearningAdminController } from "./analytics-learning-admin.controller.js";
import { AnalyticsLearningAdminRepository } from "./analytics-learning-admin.repository.js";
import { AnalyticsSearchAdminController } from "./analytics-search-admin.controller.js";
import { AnalyticsSearchAdminRepository } from "./analytics-search-admin.repository.js";
import { AnalyticsSystemAdminController } from "./analytics-system-admin.controller.js";
import { AnalyticsSystemAdminRepository } from "./analytics-system-admin.repository.js";
import { LearningHeatmapController } from "./learning-heatmap.controller.js";
import { LearningHeatmapService } from "./learning-heatmap.service.js";
import { WeeklyReportController } from "./weekly-report.controller.js";
import { WeeklyReportService } from "./weekly-report.service.js";

@Module({
  controllers: [
    AnalyticsController,
    AdminAnalyticsController,
    AnalyticsBattleAdminController,
    AnalyticsBjtAdminController,
    AnalyticsContentAdminController,
    AnalyticsFlashcardsAdminController,
    AnalyticsGrowthAdminController,
    AnalyticsLearningAdminController,
    AnalyticsSearchAdminController,
    AnalyticsSystemAdminController,
    LearningHeatmapController,
    WeeklyReportController
  ],
  exports: [AnalyticsRepository],
  imports: [AdminModule],
  providers: [
    AnalyticsRepository,
    AnalyticsBattleAdminRepository,
    AnalyticsBjtAdminRepository,
    AnalyticsContentAdminRepository,
    AnalyticsFlashcardsAdminRepository,
    AnalyticsGrowthAdminRepository,
    AnalyticsLearningAdminRepository,
    AnalyticsSearchAdminRepository,
    AnalyticsSystemAdminRepository,
    LearningHeatmapService,
    WeeklyReportService
  ]
})
export class AnalyticsModule {}
