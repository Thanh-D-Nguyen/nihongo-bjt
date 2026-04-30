import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { EntitlementGuard } from "./entitlement.guard.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

function makeContext(
  userId: string | undefined,
  handlerMeta: string | undefined,
  classMeta?: string
) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(handlerMeta ?? classMeta ?? undefined)
  };
  const req = { keycloakUser: userId ? { appUserId: userId } : undefined };
  return {
    handler: {},
    class: {},
    context: {
      getClass: vi.fn().mockReturnValue({}),
      getHandler: vi.fn().mockReturnValue({}),
      switchToHttp: vi.fn().mockReturnValue({ getRequest: () => req })
    },
    reflector
  };
}

describe("EntitlementGuard", () => {
  it("passes when no entitlement key is required on the route", async () => {
    const { context, reflector } = makeContext("user-1", undefined);
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const entitlementService = { listEntitlementKeysForUser: vi.fn() };
    const guard = new EntitlementGuard(entitlementService as any, reflector as any);
    const result = await guard.canActivate(context as any);
    expect(result).toBe(true);
    expect(entitlementService.listEntitlementKeysForUser).not.toHaveBeenCalled();
  });

  it("passes when user has the required entitlement", async () => {
    const { context, reflector } = makeContext("user-2", "learner.basic");
    reflector.getAllAndOverride.mockReturnValue("learner.basic");
    const entitlementService = {
      listEntitlementKeysForUser: vi
        .fn()
        .mockResolvedValue({ entitlements: ["learner.basic"], planSlug: "free" })
    };
    const guard = new EntitlementGuard(entitlementService as any, reflector as any);
    const result = await guard.canActivate(context as any);
    expect(result).toBe(true);
  });

  it("throws ENTITLEMENT_DENIED (403) with structured body when entitlement is missing", async () => {
    const { context, reflector } = makeContext("user-3", "learner.basic");
    reflector.getAllAndOverride.mockReturnValue("learner.basic");
    const entitlementService = {
      listEntitlementKeysForUser: vi
        .fn()
        .mockResolvedValue({ entitlements: [], planSlug: "free" })
    };
    const guard = new EntitlementGuard(entitlementService as any, reflector as any);
    const err = await guard.canActivate(context as any).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      code: "ENTITLEMENT_DENIED",
      entitlementKey: "learner.basic",
      upgradeRequired: true
    });
  });

  it("throws ENTITLEMENT_DENIED (403) when no user is attached to request", async () => {
    const { context, reflector } = makeContext(undefined, "learner.basic");
    reflector.getAllAndOverride.mockReturnValue("learner.basic");
    const entitlementService = { listEntitlementKeysForUser: vi.fn() };
    const guard = new EntitlementGuard(entitlementService as any, reflector as any);
    const err = await guard.canActivate(context as any).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      code: "ENTITLEMENT_DENIED"
    });
    expect(entitlementService.listEntitlementKeysForUser).not.toHaveBeenCalled();
  });

  it("includes planSlug in denial body for upgrade UX", async () => {
    const { context, reflector } = makeContext("user-4", "ads.reduced");
    reflector.getAllAndOverride.mockReturnValue("ads.reduced");
    const entitlementService = {
      listEntitlementKeysForUser: vi
        .fn()
        .mockResolvedValue({ entitlements: ["learner.basic"], planSlug: "free" })
    };
    const guard = new EntitlementGuard(entitlementService as any, reflector as any);
    const err = await guard.canActivate(context as any).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      code: "ENTITLEMENT_DENIED",
      entitlementKey: "ads.reduced",
      planSlug: "free",
      upgradeRequired: true
    });
  });
});
