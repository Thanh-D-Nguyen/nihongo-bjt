import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { SearchModule } from "../search/search.module.js";
import { RuntimeFeatureGateModule } from "./runtime-feature-gate.module.js";
import { OperationsController } from "./operations.controller.js";
import { OperationsService } from "./operations.service.js";

@Module({
  controllers: [OperationsController],
  exports: [RuntimeFeatureGateModule],
  imports: [AdminModule, SearchModule, RuntimeFeatureGateModule],
  providers: [OperationsService]
})
export class OperationsModule {}
