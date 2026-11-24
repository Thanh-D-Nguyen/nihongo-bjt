import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination)
}));

import DailyRadarModulePlaceholder from "./page";

afterEach(() => {
  redirectMock.mockClear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// WEB-444 contract change (ENGINEERING_POLICY.md §5):
// /modules/[moduleKey] previously fetched /api/daily-radar/modules and /cards to render
// an early-preview dev placeholder. Under WEB-444 Strategy (a), the route now server-redirects
// directly to /{locale}/levels with zero daily-radar API fetches.
describe("DailyRadarModulePlaceholder server redirect", () => {
  it("redirects /[locale]/modules/[moduleKey] to /[locale]/levels across locales without fetching daily-radar APIs", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    vi.stubEnv("API_URL", "http://127.0.0.1:4001");
    const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    for (const locale of ["vi", "ja", "en"] as const) {
      redirectMock.mockClear();
      let caught: unknown = null;
      try {
        await DailyRadarModulePlaceholder({
          params: Promise.resolve({ locale, moduleKey: "audit_probe_module" })
        });
      } catch (err) {
        caught = err;
      }

      expect(
        redirectMock,
        `DailyRadarModulePlaceholder must server-redirect /${locale}/modules/audit_probe_module to /${locale}/levels`
      ).toHaveBeenCalledWith(`/${locale}/levels`);
      expect(String(caught)).toContain(`NEXT_REDIRECT:/${locale}/levels`);
    }

    expect(
      fetchMock,
      "DailyRadarModulePlaceholder redirect must not call /api/daily-radar/* endpoints"
    ).not.toHaveBeenCalled();
  });
});
