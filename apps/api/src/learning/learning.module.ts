import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { LearningAdminController } from "./learning-admin.controller.js";

@Module({
  controllers: [LearningAdminController],
  imports: [AdminModule]
})
export class LearningModule {}
