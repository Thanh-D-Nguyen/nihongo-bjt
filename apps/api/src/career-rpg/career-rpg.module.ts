import { Module } from "@nestjs/common";

import { CareerController, StoryController } from "./career-rpg.controller.js";
import { CareerRpgService } from "./career-rpg.service.js";

@Module({
  controllers: [CareerController, StoryController],
  providers: [CareerRpgService]
})
export class CareerRpgModule {}
