import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { RuntimeFeatureGateService } from "./runtime-feature-gate.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("RuntimeFeatureGateService", () => {
  it("denies when flag is disabled", async () => {
    const service = new RuntimeFeatureGateService();
    (service as any).prisma = {
      featureFlag: {
        findUnique: vi.fn().mockResolvedValue({ enabled: false, key: "social_growth", killSwitch: false })
      }
    };

    await expect(service.requireEnabled("social_growth")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("denies when kill switch is true", async () => {
    const service = new RuntimeFeatureGateService();
    (service as any).prisma = {
      featureFlag: {
        findUnique: vi.fn().mockResolvedValue({ enabled: true, key: "external_media_uploads", killSwitch: true })
      }
    };

    await expect(service.requireEnabled("external_media_uploads")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("allows missing key in fail-open mode", async () => {
    const service = new RuntimeFeatureGateService();
    (service as any).prisma = {
      featureFlag: {
        findUnique: vi.fn().mockResolvedValue(null)
      }
    };

    await expect(
      service.requireEnabled("billing.stripe.enabled", { missingBehavior: "allow" })
    ).resolves.toBeUndefined();
  });
});
