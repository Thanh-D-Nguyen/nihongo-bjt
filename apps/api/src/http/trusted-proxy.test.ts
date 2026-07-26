import { describe, expect, it, vi } from "vitest";

import { configureTrustedProxy } from "./trusted-proxy.js";

describe("configureTrustedProxy", () => {
  it("trusts only the configured Express proxy preset", () => {
    const app = { set: vi.fn() };

    configureTrustedProxy(app, "loopback");

    expect(app.set).toHaveBeenCalledWith("trust proxy", "loopback");
  });

  it("rejects blanket or unknown trust settings", () => {
    expect(() => configureTrustedProxy({ set: vi.fn() }, "true")).toThrow(
      "Unsupported trusted proxy preset"
    );
  });
});

