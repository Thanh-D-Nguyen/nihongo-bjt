import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AdsRuntimeController } from "./ads-runtime.controller.js";

describe("AdsRuntimeController feature gate", () => {
  it("blocks impression when ads are disabled", async () => {
    const runtime = { recordImpression: vi.fn(), recordClick: vi.fn(), decide: vi.fn() };
    const featureGate = {
      requireEnabled: vi.fn().mockRejectedValue(new ServiceUnavailableException("disabled"))
    };
    const controller = new AdsRuntimeController(runtime as any, featureGate as any);

    await expect(controller.impression(undefined, { userId: "u1" })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(runtime.recordImpression).not.toHaveBeenCalled();
  });

  it("blocks click when ads are disabled", async () => {
    const runtime = { recordImpression: vi.fn(), recordClick: vi.fn(), decide: vi.fn() };
    const featureGate = {
      requireEnabled: vi.fn().mockRejectedValue(new ServiceUnavailableException("disabled"))
    };
    const controller = new AdsRuntimeController(runtime as any, featureGate as any);

    await expect(controller.click(undefined, { userId: "u1" })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(runtime.recordClick).not.toHaveBeenCalled();
  });
});
