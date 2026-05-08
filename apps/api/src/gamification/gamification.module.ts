import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { GamificationAdminController } from "./gamification-admin.controller.js";
import { GamificationController } from "./gamification.controller.js";
import { GamificationRepository } from "./gamification.repository.js";
import { GamificationService } from "./gamification.service.js";

@Module({
  controllers: [GamificationController, GamificationAdminController],
  exports: [GamificationService],
  imports: [AdminModule],
  providers: [GamificationRepository, GamificationService]
})
export class GamificationModule {}
