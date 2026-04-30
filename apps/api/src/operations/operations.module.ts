import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { SearchModule } from "../search/search.module.js";
import { OperationsController } from "./operations.controller.js";
import { OperationsService } from "./operations.service.js";
import { RuntimeFeatureGateService } from "./runtime-feature-gate.service.js";

@Module({
  controllers: [OperationsController],
  exports: [RuntimeFeatureGateService],
  imports: [AdminModule, SearchModule],
  providers: [OperationsService, RuntimeFeatureGateService]
})
export class OperationsModule {}
