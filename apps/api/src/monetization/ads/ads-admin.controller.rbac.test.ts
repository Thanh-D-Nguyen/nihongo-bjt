import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ADS_PERMS, ANY_ADS_READ } from "./ads-permissions.js";
import { AdsAdminController } from "./ads-admin.controller.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("AdsAdminController RBAC denial paths", () => {
  const createContext = () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockRejectedValue(new ForbiddenException("forbidden"))
    };
    const ads = {
      auditLog: vi.fn(),
      createCampaign: vi.fn(),
      createPlacement: vi.fn(),
      listCampaigns: vi.fn(),
      listPlacements: vi.fn(),
      listProviders: vi.fn(),
      listRules: vi.fn(),
      overview: vi.fn(),
      performance: vi.fn(),
      tasks: vi.fn(),
      updateCampaign: vi.fn(),
      updatePlacement: vi.fn(),
      upsertProvider: vi.fn(),
      upsertRule: vi.fn()
    };
    return { adminAuth, ads, controller: new AdsAdminController(adminAuth as any, ads as any) };
  };

  it("denies all read and write sensitive routes when permissions are missing", async () => {
    const { adminAuth, ads, controller } = createContext();

    const deniedCalls: Array<{ invoke: () => Promise<unknown>; perms: readonly string[] }> = [
      { invoke: () => controller.overview({} as any), perms: ANY_ADS_READ },
      { invoke: () => controller.listPlacements({} as any), perms: ADS_PERMS.viewPlacements },
      {
        invoke: () => controller.createPlacement({} as any, { code: "banner_home", reason: "init" }),
        perms: ADS_PERMS.managePlacements
      },
      {
        invoke: () => controller.patchPlacement({} as any, "p1", { reason: "ops" }),
        perms: ADS_PERMS.managePlacements
      },
      { invoke: () => controller.listCampaigns({} as any), perms: ADS_PERMS.viewCampaigns },
      {
        invoke: () =>
          controller.createCampaign({} as any, {
            name: "Spring promo",
            placementCodes: ["dashboard_banner"],
            providerKey: "local",
            reason: "launch"
          }),
        perms: ADS_PERMS.manageCampaigns
      },
      {
        invoke: () => controller.patchCampaign({} as any, "c1", { reason: "ops" }),
        perms: ADS_PERMS.manageCampaigns
      },
      { invoke: () => controller.listProviders({} as any), perms: ADS_PERMS.viewProviders },
      {
        invoke: () => controller.patchProvider({} as any, "local", { reason: "ops" }),
        perms: ADS_PERMS.manageProviders
      },
      { invoke: () => controller.listRules({} as any), perms: ADS_PERMS.readRules },
      {
        invoke: () => controller.postRule({} as any, { ruleKey: "safety.blocklist", reason: "ops" }),
        perms: ADS_PERMS.manageRules
      },
      { invoke: () => controller.performance({} as any), perms: ADS_PERMS.readPerformance },
      { invoke: () => controller.audit({} as any), perms: ADS_PERMS.readAudit }
    ];

    for (const call of deniedCalls) {
      await expect(call.invoke()).rejects.toBeInstanceOf(ForbiddenException);
      expect(adminAuth.requireOneOfPermissions).toHaveBeenLastCalledWith({}, [...call.perms]);
    }

    expect(ads.overview).not.toHaveBeenCalled();
    expect(ads.tasks).not.toHaveBeenCalled();
    expect(ads.listPlacements).not.toHaveBeenCalled();
    expect(ads.createPlacement).not.toHaveBeenCalled();
    expect(ads.updatePlacement).not.toHaveBeenCalled();
    expect(ads.listCampaigns).not.toHaveBeenCalled();
    expect(ads.createCampaign).not.toHaveBeenCalled();
    expect(ads.updateCampaign).not.toHaveBeenCalled();
    expect(ads.listProviders).not.toHaveBeenCalled();
    expect(ads.upsertProvider).not.toHaveBeenCalled();
    expect(ads.listRules).not.toHaveBeenCalled();
    expect(ads.upsertRule).not.toHaveBeenCalled();
    expect(ads.performance).not.toHaveBeenCalled();
    expect(ads.auditLog).not.toHaveBeenCalled();
  });

  it("denies campaign create for unauthenticated actor", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockRejectedValue(new UnauthorizedException("unauthenticated"))
    };
    const ads = { createCampaign: vi.fn() };
    const controller = new AdsAdminController(adminAuth as any, ads as any);

    await expect(
      controller.createCampaign({} as any, {
        name: "Spring promo",
        placementCodes: ["dashboard_banner"],
        providerKey: "local",
        reason: "launch"
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, [...ADS_PERMS.manageCampaigns]);
    expect(ads.createCampaign).not.toHaveBeenCalled();
  });
});
