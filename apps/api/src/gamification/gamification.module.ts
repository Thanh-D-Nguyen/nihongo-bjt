import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { ComebackExperienceCron } from "./comeback-experience.cron.js";
import { ComebackExperienceService } from "./comeback-experience.service.js";
import { CompanionPetService } from "./companion-pet.service.js";
import { DailyStudyGoalService } from "./daily-study-goal.service.js";
import { GamificationAdminController } from "./gamification-admin.controller.js";
import { GamificationController } from "./gamification.controller.js";
import { GamificationRepository } from "./gamification.repository.js";
import { GamificationService } from "./gamification.service.js";
import { LoginBonusService } from "./login-bonus.service.js";
import { MysteryBoxService } from "./mystery-box.service.js";
import { SeasonalEventController } from "./seasonal-event.controller.js";
import { SeasonalEventService } from "./seasonal-event.service.js";
import { StudyGroupController } from "./study-group.controller.js";
import { StudyGroupService } from "./study-group.service.js";
import { StudyTimerService } from "./study-timer.service.js";

@Module({
  controllers: [GamificationController, GamificationAdminController, SeasonalEventController, StudyGroupController],
  exports: [GamificationService, DailyStudyGoalService, LoginBonusService, MysteryBoxService, StudyTimerService, CompanionPetService, SeasonalEventService, StudyGroupService, ComebackExperienceService],
  imports: [AdminModule],
  providers: [GamificationRepository, GamificationService, DailyStudyGoalService, LoginBonusService, MysteryBoxService, StudyTimerService, CompanionPetService, SeasonalEventService, StudyGroupService, ComebackExperienceService, ComebackExperienceCron]
})
export class GamificationModule {}
