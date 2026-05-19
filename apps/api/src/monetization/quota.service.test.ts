import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { MonetizationRepository } from "./monetization.repository.js";
import { QuotaService } from "./quota.service.js";

describe("QuotaService", () => {
  it("declares explicit Nest injection tokens for repository and runtime feature gates", () => {
    const selfParams = Reflect.getMetadata("self:paramtypes", QuotaService) as
      | Array<{ index: number; param: unknown }>
      | undefined;

    expect(selfParams).toEqual(
      expect.arrayContaining([
        { index: 0, param: MonetizationRepository },
        { index: 1, param: RuntimeFeatureGateService }
      ])
    );
  });
});
