import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination)
}));

import ArcDetailRoute from "./page";

afterEach(() => {
  redirectMock.mockClear();
});

describe("ArcDetailRoute server redirect", () => {
  it("redirects /[locale]/story/arcs/[slug] to /[locale]/scenarios across locales", async () => {
    for (const locale of ["vi", "ja", "en"] as const) {
      redirectMock.mockClear();
      let caught: unknown = null;
      try {
        await ArcDetailRoute({
          params: Promise.resolve({ locale, slug: "arc.business-manner-basics" })
        });
      } catch (err) {
        caught = err;
      }

      expect(
        redirectMock,
        `ArcDetailRoute must server-redirect /${locale}/story/arcs/arc.business-manner-basics to /${locale}/scenarios`
      ).toHaveBeenCalledWith(`/${locale}/scenarios`);
      expect(String(caught)).toContain(`NEXT_REDIRECT:/${locale}/scenarios`);
    }
  });
});
