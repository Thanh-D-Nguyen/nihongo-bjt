import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module.js";
import { MagazineController } from "./magazine.controller.js";
import { MagazineAdminController } from "./magazine-admin.controller.js";
import { MagazineRepository } from "./magazine.repository.js";
import { MagazineGenerationService } from "./magazine-generation.service.js";
import { MagazineGenerationCron } from "./magazine-generation.cron.js";
import { AiContentProvider } from "./providers/ai-content.provider.js";
import { JmaWeatherProvider } from "./providers/jma-weather.provider.js";
import { LotoDataProvider } from "./providers/loto-data.provider.js";
import { LotoLabAdminController } from "./loto/loto-lab-admin.controller.js";
import { LotoLabService } from "./loto/loto-lab.service.js";

@Module({
  imports: [AdminModule],
  controllers: [MagazineController, MagazineAdminController, LotoLabAdminController],
  providers: [
    MagazineRepository,
    MagazineGenerationService,
    MagazineGenerationCron,
    AiContentProvider,
    JmaWeatherProvider,
    LotoDataProvider,
    LotoLabService,
  ],
  exports: [MagazineRepository, MagazineGenerationService],
})
export class MagazineModule {}
