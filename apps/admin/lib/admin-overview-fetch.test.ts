import { afterEach, describe, expect, it, vi } from "vitest";

import { adminApiFetch } from "./admin-api";
import { loadOverviewBundle } from "./admin-overview-fetch";

vi.mock("./admin-api", () => ({ adminApiFetch: vi.fn() }));

afterEach(() => vi.resetAllMocks());

describe("loadOverviewBundle readiness", () => {
  it("requests the canonical Go route and preserves dependency health", async () => {
    const readiness = {
      status: "ok",
      checks: { postgres: "ok", redis: "not_configured" },
      version: "test-version"
    };
    vi.mocked(adminApiFetch).mockImplementation(async (path) =>
      path === "/health/ready"
        ? Response.json(readiness)
        : new Response(null, { status: 404 })
    );

    const result = await loadOverviewBundle({ days: 7, permissions: [] });

    expect(adminApiFetch).toHaveBeenCalledExactlyOnceWith("/health/ready");
    expect(result.health).toEqual(readiness);
    expect(result.healthError).toBe(false);
    expect(result.partialDegradation).toBe(false);
  });
});
