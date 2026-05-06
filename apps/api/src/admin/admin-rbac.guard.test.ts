import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { AdminAuthService } from "./admin-auth.service.js";
import { AdminRbacGuard } from "./admin-rbac.guard.js";
import { ADMIN_RBAC_METADATA_KEY, ADMIN_RBAC_SESSION_BOOTSTRAP_KEY, ADMIN_RBAC_TEST_FIXTURES } from "./admin.rbac.js";

function buildContext(req: Record<string, unknown>) {
  return {
    getClass: () => ({ name: "Controller" }),
    getHandler: () => ({ name: "method" }),
    switchToHttp: () => ({
      getRequest: () => req
    })
  };
}

describe("AdminRbacGuard", () => {
  it("throws when metadata is missing", async () => {
    const auth = {
      requireOneOfPermissions: vi.fn(),
      requireAdminPortalSession: vi.fn()
    } as unknown as AdminAuthService;
    const reflector = {
      getAllAndOverride: vi.fn((key: unknown) => {
        if (key === ADMIN_RBAC_SESSION_BOOTSTRAP_KEY) {
          return false;
        }
        return undefined;
      })
    };
    const guard = new AdminRbacGuard(auth, reflector as any);

    await expect(guard.canActivate(buildContext({}) as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(auth.requireOneOfPermissions).not.toHaveBeenCalled();
    expect(auth.requireAdminPortalSession).not.toHaveBeenCalled();
  });

  it("throws when metadata has no permissions", async () => {
    const auth = {
      requireOneOfPermissions: vi.fn(),
      requireAdminPortalSession: vi.fn()
    } as unknown as AdminAuthService;
    const reflector = {
      getAllAndOverride: vi.fn((key: unknown) => {
        if (key === ADMIN_RBAC_SESSION_BOOTSTRAP_KEY) {
          return false;
        }
        if (key === ADMIN_RBAC_METADATA_KEY) {
          return { group: "operations", requires: [] };
        }
        return undefined;
      })
    };
    const guard = new AdminRbacGuard(auth, reflector as any);

    await expect(guard.canActivate(buildContext({}) as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(auth.requireOneOfPermissions).not.toHaveBeenCalled();
    expect(auth.requireAdminPortalSession).not.toHaveBeenCalled();
  });

  it("passes and stores principal when auth check succeeds", async () => {
    const req: Record<string, unknown> = {};
    const principal = {
      actorId: "actor-1",
      displayName: "Admin",
      permissions: new Set(["iam.manage"])
    };
    const auth = {
      requireOneOfPermissions: vi.fn().mockResolvedValue(principal),
      requireAdminPortalSession: vi.fn()
    } as unknown as AdminAuthService;
    const reflector = {
      getAllAndOverride: vi.fn((key: unknown) => {
        if (key === ADMIN_RBAC_SESSION_BOOTSTRAP_KEY) {
          return false;
        }
        if (key === ADMIN_RBAC_METADATA_KEY) {
          return { group: "operations", requires: ["iam.manage"] };
        }
        return undefined;
      })
    };
    const guard = new AdminRbacGuard(auth, reflector as any);

    await expect(guard.canActivate(buildContext(req) as any)).resolves.toBe(true);
    expect(auth.requireOneOfPermissions).toHaveBeenCalledWith(req, ["iam.manage"]);
    expect((req as any).adminPrincipal).toEqual(principal);
    expect(auth.requireAdminPortalSession).not.toHaveBeenCalled();
  });

  it("session bootstrap calls requireAdminPortalSession only", async () => {
    const req: Record<string, unknown> = {};
    const auth = {
      requireOneOfPermissions: vi.fn(),
      requireAdminPortalSession: vi.fn().mockResolvedValue({ actorId: "a", displayName: "A" })
    } as unknown as AdminAuthService;
    const reflector = {
      getAllAndOverride: vi.fn((key: unknown) => {
        if (key === ADMIN_RBAC_SESSION_BOOTSTRAP_KEY) {
          return true;
        }
        return undefined;
      })
    };
    const guard = new AdminRbacGuard(auth, reflector as any);

    await expect(guard.canActivate(buildContext(req) as any)).resolves.toBe(true);
    expect(auth.requireAdminPortalSession).toHaveBeenCalledWith(req);
    expect(auth.requireOneOfPermissions).not.toHaveBeenCalled();
  });

  it("provides deterministic role fixtures", () => {
    expect(ADMIN_RBAC_TEST_FIXTURES.superadmin.permissions).toEqual(["*"]);
    expect(ADMIN_RBAC_TEST_FIXTURES.admin.permissions).toContain("admin.content.write");
    expect(ADMIN_RBAC_TEST_FIXTURES.operator.permissions).toContain("iam.manage");
    expect(ADMIN_RBAC_TEST_FIXTURES.viewer.permissions).toContain("viewer.analytics");
  });
});
