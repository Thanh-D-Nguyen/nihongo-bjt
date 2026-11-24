import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination)
}));

import ArcsRoute from "./page";

afterEach(() => {
  redirectMock.mockClear();
});

describe("ArcsRoute server redirect", () => {
  it("redirects /[locale]/story/arcs to /[locale]/scenarios across locales", async () => {
    for (const locale of ["vi", "ja", "en"] as const) {
      redirectMock.mockClear();
      let caught: unknown = null;
      try {
        await ArcsRoute({ params: Promise.resolve({ locale }) });
      } catch (err) {
        caught = err;
      }

      expect(
        redirectMock,
        `ArcsRoute must server-redirect /${locale}/story/arcs to /${locale}/scenarios`
      ).toHaveBeenCalledWith(`/${locale}/scenarios`);
      expect(String(caught)).toContain(`NEXT_REDIRECT:/${locale}/scenarios`);
    }
  });
});
