import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { GamificationModule } from "../gamification/gamification.module.js";
import { MediaModule } from "../media/media.module.js";
import { AdaptiveDifficultyService } from "./adaptive-difficulty.service.js";
import { ExerciseAdminController } from "./exercise-admin.controller.js";
import { ExerciseController } from "./exercise.controller.js";
import { ExerciseGeneratorService } from "./exercise-generator.service.js";
import { ExerciseRepository } from "./exercise.repository.js";
import { ExerciseService } from "./exercise.service.js";
import { LexemeAudioService } from "./lexeme-audio.service.js";
import { TtsService } from "./tts.service.js";

@Module({
  controllers: [ExerciseController, ExerciseAdminController],
  exports: [ExerciseService, TtsService, LexemeAudioService, AdaptiveDifficultyService],
  imports: [AdminModule, GamificationModule, MediaModule],
  providers: [
    AdaptiveDifficultyService,
    ExerciseRepository,
    ExerciseService,
    ExerciseGeneratorService,
    TtsService,
    LexemeAudioService,
  ],
})
export class ExerciseModule {}
