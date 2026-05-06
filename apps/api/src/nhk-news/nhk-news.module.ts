import { Module } from "@nestjs/common";

import { NhkNewsController } from "./nhk-news.controller.js";
import { NhkNewsRepository } from "./nhk-news.repository.js";

@Module({
  controllers: [NhkNewsController],
  providers: [NhkNewsRepository],
})
export class NhkNewsModule {}
