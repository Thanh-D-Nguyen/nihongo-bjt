import type { NextConfig } from "next";
import { describe, expect, it } from "vitest";

async function loadWebNextConfig(): Promise<NextConfig> {
  const configUrl = new URL("../next.config.mjs", import.meta.url).href;
  const mod = (await import(/* @vite-ignore */ configUrl)) as { default: NextConfig };
  return mod.default;
}

describe("web next.config.mjs", () => {
  it("rewrites /favicon.ico to /pwa-icon.svg while preserving the /api proxy rewrite", async () => {
    const config = await loadWebNextConfig();
    expect(typeof config.rewrites).toBe("function");

    const rewrites = await config.rewrites!();
    const afterFiles = Array.isArray(rewrites) ? rewrites : (rewrites.afterFiles ?? []);

    expect(
      afterFiles,
      "web rewrites must rewrite /favicon.ico to /pwa-icon.svg",
    ).toContainEqual({
      source: "/favicon.ico",
      destination: "/pwa-icon.svg",
    });

    const apiRewrite = afterFiles.find((rule) => rule.source === "/api/:path*");
    expect(apiRewrite, "existing /api/:path* proxy rewrite must remain intact").toBeDefined();
    expect(apiRewrite?.destination).toMatch(/\/api\/:path\*$/u);
  });

  it("sets the five admin-mirrored security headers without CSP or HSTS", async () => {
    const config = await loadWebNextConfig();
    expect(
      typeof config.headers,
      "web next.config.mjs must define headers() with security headers",
    ).toBe("function");

    const headerGroups = await config.headers!();
    const catchAll = headerGroups.find((group) => group.source === "/(.*)");
    expect(catchAll, "security headers must apply to /(.*)").toBeDefined();

    expect(catchAll?.headers).toEqual([
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-XSS-Protection", value: "0" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ]);

    const keys = (catchAll?.headers ?? []).map((h) => h.key.toLowerCase());
    expect(keys).not.toContain("content-security-policy");
    expect(keys).not.toContain("strict-transport-security");
  });
});
