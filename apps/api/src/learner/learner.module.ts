import { Module } from "@nestjs/common";

import { LearnerController } from "./learner.controller.js";
import { LearnerRepository } from "./learner.repository.js";
import { LearnerService } from "./learner.service.js";

@Module({
  controllers: [LearnerController],
  providers: [LearnerRepository, LearnerService]
})
export class LearnerModule {}
