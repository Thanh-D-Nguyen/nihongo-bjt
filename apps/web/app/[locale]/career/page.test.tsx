import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination)
}));

import CareerRoute from "./page";

afterEach(() => {
  redirectMock.mockClear();
});

describe("CareerRoute server redirect", () => {
  it("redirects /[locale]/career to /[locale]/scenarios across locales", async () => {
    for (const locale of ["vi", "ja", "en"] as const) {
      redirectMock.mockClear();
      let caught: unknown = null;
      try {
        await CareerRoute({ params: Promise.resolve({ locale }) });
      } catch (err) {
        caught = err;
      }

      expect(
        redirectMock,
        `CareerRoute must server-redirect /${locale}/career to /${locale}/scenarios`
      ).toHaveBeenCalledWith(`/${locale}/scenarios`);
      expect(String(caught)).toContain(`NEXT_REDIRECT:/${locale}/scenarios`);
    }
  });
});
