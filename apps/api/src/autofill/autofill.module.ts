import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";

import { AutofillController } from "./autofill.controller.js";
import { AutofillService } from "./autofill.service.js";

@Module({
  controllers: [AutofillController],
  imports: [AdminModule],
  providers: [AutofillService],
})
export class AutofillModule {}
