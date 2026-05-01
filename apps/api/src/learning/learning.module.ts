import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { CompetenciesAdminController } from "./learning-competencies-admin.controller.js";
import { CompetenciesAdminRepository } from "./learning-competencies-admin.repository.js";
import { LearningPathsAdminController } from "./learning-paths-admin.controller.js";
import { LearningPathsAdminRepository } from "./learning-paths-admin.repository.js";
import { LearningReviewAdminController } from "./learning-review-admin.controller.js";
import { LearningReviewAdminRepository } from "./learning-review-admin.repository.js";

@Module({
  controllers: [
    LearningPathsAdminController,
    CompetenciesAdminController,
    LearningReviewAdminController
  ],
  imports: [AdminModule],
  providers: [
    LearningPathsAdminRepository,
    CompetenciesAdminRepository,
    LearningReviewAdminRepository
  ]
})
export class LearningModule {}
