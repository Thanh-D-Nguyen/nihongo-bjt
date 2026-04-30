import { describe, expect, it, vi } from "vitest";

import { HealthService } from "./health.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("HealthService ready", () => {
  it("returns ok when dependencies are healthy and keycloak admin is enabled", async () => {
    const service = new HealthService({
      getDisabledReasons: vi.fn().mockReturnValue([]),
      isEnabled: vi.fn().mockReturnValue(true)
    } as any);

    (service as any).prisma = {
      $queryRaw: vi.fn().mockResolvedValue(1)
    };

    vi.spyOn(service as any, "checkRedis").mockResolvedValue({ status: "ok" });
    vi.spyOn(service as any, "checkSearch").mockResolvedValue({ status: "ok" });

    const result = await service.ready();

    expect(result.status).toBe("ok");
    expect(result.checks?.database?.status).toBe("ok");
    expect(result.checks?.redis?.status).toBe("ok");
    expect(result.checks?.search?.status).toBe("ok");
    expect(result.checks?.keycloak_realm_admin?.status).toBe("ok");
  });

  it("returns degraded when keycloak admin provider is not configured", async () => {
    const service = new HealthService({
      getDisabledReasons: vi.fn().mockReturnValue(["KEYCLOAK_USER_ADMIN_CLIENT_ID is not set"]),
      isEnabled: vi.fn().mockReturnValue(false)
    } as any);

    (service as any).prisma = {
      $queryRaw: vi.fn().mockResolvedValue(1)
    };

    vi.spyOn(service as any, "checkRedis").mockResolvedValue({ status: "ok" });
    vi.spyOn(service as any, "checkSearch").mockResolvedValue({ status: "ok" });

    const result = await service.ready();

    expect(result.status).toBe("degraded");
    expect(result.checks?.keycloak_realm_admin?.status).toBe("degraded");
    expect(result.checks?.keycloak_realm_admin?.message).toContain("not_configured");
  });

  it("does not expose database error details in readiness payload", async () => {
    const service = new HealthService({
      getDisabledReasons: vi.fn().mockReturnValue([]),
      isEnabled: vi.fn().mockReturnValue(true)
    } as any);

    (service as any).prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error("postgresql://user:secret@db:5432/nihongo_bjt"))
    };

    vi.spyOn(service as any, "checkRedis").mockResolvedValue({ status: "ok" });
    vi.spyOn(service as any, "checkSearch").mockResolvedValue({ status: "ok" });

    const result = await service.ready();

    expect(result.status).toBe("degraded");
    expect(result.checks?.database?.message).toBe("database_unreachable");
    expect(result.checks?.database?.message).not.toContain("secret");
  });
});
