import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { NhkNewsAdminController, NhkNewsController } from "./nhk-news.controller.js";
import { NhkNewsRepository } from "./nhk-news.repository.js";

@Module({
  controllers: [NhkNewsController, NhkNewsAdminController],
  imports: [AdminModule],
  providers: [NhkNewsRepository],
})
export class NhkNewsModule {}
