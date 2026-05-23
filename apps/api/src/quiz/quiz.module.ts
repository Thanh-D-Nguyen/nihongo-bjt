import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { GamificationModule } from "../gamification/gamification.module.js";
import { MonetizationModule } from "../monetization/monetization.module.js";
import { OperationsModule } from "../operations/operations.module.js";
import { QuizAdminController } from "./quiz-admin.controller.js";
import { QuizController } from "./quiz.controller.js";
import { QuizRepository } from "./quiz.repository.js";
import { QuizService } from "./quiz.service.js";
import { RevengeModeController } from "./revenge-mode.controller.js";
import { RevengeModeService } from "./revenge-mode.service.js";

@Module({
  controllers: [QuizController, QuizAdminController, RevengeModeController],
  imports: [GamificationModule, MonetizationModule, OperationsModule, AdminModule],
  providers: [QuizRepository, QuizService, RevengeModeService]
})
export class QuizModule {}
