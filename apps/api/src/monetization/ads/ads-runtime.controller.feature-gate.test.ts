import "reflect-metadata";

import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { KEYCLOAK_AUTH_OPTIONAL } from "../../keycloak/keycloak-public.decorator.js";
import { AdsRuntimeController } from "./ads-runtime.controller.js";

describe("AdsRuntimeController feature gate", () => {
  it("blocks impression when ads are disabled", async () => {
    const runtime = { recordImpression: vi.fn(), recordClick: vi.fn(), decide: vi.fn() };
    const featureGate = {
      requireEnabled: vi.fn().mockRejectedValue(new ServiceUnavailableException("disabled"))
    };
    const controller = new AdsRuntimeController(runtime as any, featureGate as any);

    await expect(controller.impression(undefined, { userId: "u1" })).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(runtime.recordImpression).not.toHaveBeenCalled();
  });

  it("blocks click when ads are disabled", async () => {
    const runtime = { recordImpression: vi.fn(), recordClick: vi.fn(), decide: vi.fn() };
    const featureGate = {
      requireEnabled: vi.fn().mockRejectedValue(new ServiceUnavailableException("disabled"))
    };
    const controller = new AdsRuntimeController(runtime as any, featureGate as any);

    await expect(controller.click(undefined, { userId: "u1" })).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(runtime.recordClick).not.toHaveBeenCalled();
  });
});

describe("AdsRuntimeController optional authentication", () => {
  function setup() {
    const runtime = {
      decide: vi.fn().mockResolvedValue({ decisionKey: "local:default", eligible: true }),
      recordClick: vi.fn().mockResolvedValue({ ok: true }),
      recordImpression: vi.fn().mockResolvedValue({ ok: true })
    };
    const featureGate = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
    return {
      controller: new AdsRuntimeController(runtime as any, featureGate as any),
      runtime
    };
  }

  it("marks decision, impression, and click as optional-auth routes", () => {
    for (const method of ["decision", "impression", "click"] as const) {
      expect(
        Reflect.getMetadata(KEYCLOAK_AUTH_OPTIONAL, AdsRuntimeController.prototype[method])
      ).toBe(true);
    }
  });

  it("overrides every configured throttle window for public ad routes", () => {
    const expected = {
      click: { long: 20, medium: 10, short: 4 },
      decision: { long: 10, medium: 5, short: 2 },
      impression: { long: 20, medium: 10, short: 4 }
    } as const;

    for (const method of ["decision", "impression", "click"] as const) {
      for (const name of ["short", "medium", "long"] as const) {
        expect(
          Reflect.getMetadata(
            `THROTTLER:LIMIT${name}`,
            AdsRuntimeController.prototype[method]
          )
        ).toBe(expected[method][name]);
      }
    }
  });

  it("resolves an anonymous decision without accepting a user id", async () => {
    const { controller, runtime } = setup();

    await controller.decision(undefined, {
      learningContext: { sessionKind: "default" },
      locale: "vi",
      placementCode: "home_feed_inline"
    });

    expect(runtime.decide).toHaveBeenCalledWith({
      learningContext: { sessionKind: "default" },
      locale: "vi",
      placementCode: "home_feed_inline",
      userId: null
    });
  });

  it("rejects a spoofed user id from an anonymous request", async () => {
    const { controller, runtime } = setup();

    await expect(
      controller.decision(undefined, {
        placementCode: "home_feed_inline",
        userId: "22222222-2222-4222-8222-222222222222"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(runtime.decide).not.toHaveBeenCalled();
  });

  it("derives authenticated identity from the verified principal", async () => {
    const { controller, runtime } = setup();
    const user = {
      appUserId: "11111111-1111-4111-8111-111111111111",
      realmRoles: [],
      sub: "keycloak-subject"
    };

    await controller.impression(user, {
      campaignId: "33333333-3333-4333-8333-333333333333",
      kind: "impression",
      placementCode: "home_feed_inline"
    });

    expect(runtime.recordImpression).toHaveBeenCalledWith(
      user.appUserId,
      expect.objectContaining({ userId: user.appUserId })
    );
  });
});
