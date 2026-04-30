import { describe, expect, it } from "vitest";

import { isSupportedLocale, parseServerEnv } from "./index.js";

describe("parseServerEnv", () => {
  it("normalizes comma-separated CORS origins", () => {
    const env = parseServerEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/nihongo_bjt",
      CORS_ORIGINS: "http://localhost:3000, http://localhost:3001"
    });

    expect(env.CORS_ORIGINS).toEqual(["http://localhost:3000", "http://localhost:3001"]);
  });

  it("keeps locale support explicit", () => {
    expect(isSupportedLocale("vi")).toBe(true);
    expect(isSupportedLocale("ja")).toBe(true);
    expect(isSupportedLocale("en")).toBe(false);
  });
});
