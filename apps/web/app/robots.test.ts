import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";

describe("robots metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("declares the canonical sitemap URL", () => {
    vi.stubEnv("WEB_PUBLIC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_WEB_PUBLIC_URL", "");

    const output = robots();

    expect(output.sitemap, "robots.ts must advertise the canonical sitemap.xml URL").toBe(
      "https://kiokoto.com/sitemap.xml",
    );
    expect(output.rules).toEqual([
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/onboarding"],
      },
    ]);
  });

  it("respects WEB_PUBLIC_URL when configured", () => {
    vi.stubEnv("WEB_PUBLIC_URL", "https://staging.kiokoto.com/");

    const output = robots();

    expect(output.sitemap).toBe("https://staging.kiokoto.com/sitemap.xml");
  });
});
