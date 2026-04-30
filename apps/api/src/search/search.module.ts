import { Module } from "@nestjs/common";

import { ContentModule } from "../content/content.module.js";
import { SearchController } from "./search.controller.js";
import { SearchService } from "./search.service.js";

@Module({
  controllers: [SearchController],
  exports: [SearchService],
  imports: [ContentModule],
  providers: [SearchService]
})
export class SearchModule {}
