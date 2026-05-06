import { Module } from "@nestjs/common";

import { RuntimeFeatureGateService } from "./runtime-feature-gate.service.js";

/** Narrow module so Media (and others) can gate features without importing the full Operations graph (breaks ESM cycles). */
@Module({
  exports: [RuntimeFeatureGateService],
  providers: [RuntimeFeatureGateService]
})
export class RuntimeFeatureGateModule {}
