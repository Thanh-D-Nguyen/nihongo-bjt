import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { CardgenAdminController } from "./cardgen-admin.controller.js";
import { CardgenController } from "./cardgen.controller.js";
import { CardgenRepository } from "./cardgen.repository.js";
import { CardgenService } from "./cardgen.service.js";

@Module({
  controllers: [CardgenController, CardgenAdminController],
  exports: [CardgenService],
  imports: [AdminModule],
  providers: [CardgenRepository, CardgenService]
})
export class CardgenModule {}
