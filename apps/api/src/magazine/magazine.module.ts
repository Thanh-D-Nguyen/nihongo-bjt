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
import { LotoHubController } from "./loto/loto-hub.controller.js";
import { LotoHubService } from "./loto/loto-hub.service.js";
import { LotoHubAdminController } from "./loto/loto-hub-admin.controller.js";
import { LotoHubAdminService } from "./loto/loto-hub-admin.service.js";

@Module({
  imports: [AdminModule],
  controllers: [MagazineController, MagazineAdminController, LotoLabAdminController, LotoHubController, LotoHubAdminController],
  providers: [
    MagazineRepository,
    MagazineGenerationService,
    MagazineGenerationCron,
    AiContentProvider,
    JmaWeatherProvider,
    LotoDataProvider,
    LotoLabService,
    LotoHubService,
    LotoHubAdminService,
  ],
  exports: [MagazineRepository, MagazineGenerationService],
})
export class MagazineModule {}
