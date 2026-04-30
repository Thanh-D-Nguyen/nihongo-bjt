import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AdsAdminController } from "./ads-admin.controller.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("AdsAdminController destinationUrl validation", () => {
  it("rejects unsafe destinationUrl host before service call", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockResolvedValue({ actorId: "admin-1" })
    };
    const ads = { createCampaign: vi.fn() };
    const controller = new AdsAdminController(adminAuth as any, ads as any);

    await expect(
      controller.createCampaign({} as any, {
        destinationUrl: "https://127.0.0.1/secret",
        name: "Unsafe campaign",
        placementCodes: ["dashboard_banner"],
        providerKey: "local",
        reason: "test"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ads.createCampaign).not.toHaveBeenCalled();
  });

  it("rejects unsafe destinationUrl host on patch path", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockResolvedValue({ actorId: "admin-1" })
    };
    const ads = { updateCampaign: vi.fn() };
    const controller = new AdsAdminController(adminAuth as any, ads as any);

    await expect(
      controller.patchCampaign({} as any, "campaign-1", {
        destinationUrl: "https://127.0.0.1/internal",
        reason: "test"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ads.updateCampaign).not.toHaveBeenCalled();
  });
});
