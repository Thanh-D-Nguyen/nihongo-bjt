import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { GrowthAdminController } from "./growth-admin.controller.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("GrowthAdminController referral/share analytics", () => {
  it("requires admin.growth.read and returns aggregate analytics", async () => {
    const adminAuth = {
      requirePermission: vi.fn().mockResolvedValue({ actorId: "admin-1" })
    };
    const growthAnalytics = {
      referralShareFunnel: vi.fn().mockResolvedValue({ ok: true })
    };

    const controller = new GrowthAdminController(adminAuth as any, growthAnalytics as any);

    const result = await controller.referralShareAnalytics({} as any, { days: "14" });

    expect(result).toEqual({ ok: true });
    expect(adminAuth.requirePermission).toHaveBeenCalledWith({}, "admin.growth.read");
    expect(growthAnalytics.referralShareFunnel).toHaveBeenCalledWith(14);
  });

  it("rejects invalid query payload", async () => {
    const adminAuth = {
      requirePermission: vi.fn().mockResolvedValue({ actorId: "admin-1" })
    };
    const growthAnalytics = {
      referralShareFunnel: vi.fn()
    };

    const controller = new GrowthAdminController(adminAuth as any, growthAnalytics as any);

    await expect(controller.referralShareAnalytics({} as any, { days: "0" })).rejects.toBeInstanceOf(BadRequestException);
    expect(growthAnalytics.referralShareFunnel).not.toHaveBeenCalled();
  });
});
