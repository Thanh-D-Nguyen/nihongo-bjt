import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

const prismaMock = {
  $transaction: vi.fn()
};

vi.mock("@nihongo-bjt/database", async () => {
  const actual =
    await vi.importActual<typeof import("@nihongo-bjt/database")>("@nihongo-bjt/database");
  return {
    ...actual,
    createPrismaClient: () => prismaMock
  };
});

import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { FeatureFlagKey } from "../monetization/monetization.constants.js";
import { ImageSearchService } from "./image-search.service.js";

describe("ImageSearchService", () => {
  const featureGate = {
    status: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.PIXABAY_API_KEY;
    delete process.env.GOOGLE_CSE_KEY;
    delete process.env.GOOGLE_CSE_CX;
  });

  it("does not consume image search quota when monetization enforcement is off", async () => {
    featureGate.status.mockResolvedValue({
      configured: true,
      enabled: false,
      key: FeatureFlagKey.monetization_enforcement,
      killSwitch: false
    });

    const service = new ImageSearchService(featureGate as unknown as RuntimeFeatureGateService);

    await expect(
      service.search("22222222-2222-4222-8222-222222222222", "会議", 6)
    ).resolves.toEqual([]);

    expect(featureGate.status).toHaveBeenCalledWith(FeatureFlagKey.monetization_enforcement, {
      missingBehavior: "allow"
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
