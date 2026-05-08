import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { GamificationModule } from "../gamification/gamification.module.js";
import { ExerciseAdminController } from "./exercise-admin.controller.js";
import { ExerciseController } from "./exercise.controller.js";
import { ExerciseGeneratorService } from "./exercise-generator.service.js";
import { ExerciseRepository } from "./exercise.repository.js";
import { ExerciseService } from "./exercise.service.js";

@Module({
  controllers: [ExerciseController, ExerciseAdminController],
  exports: [ExerciseService],
  imports: [AdminModule, GamificationModule],
  providers: [ExerciseRepository, ExerciseService, ExerciseGeneratorService]
})
export class ExerciseModule {}
