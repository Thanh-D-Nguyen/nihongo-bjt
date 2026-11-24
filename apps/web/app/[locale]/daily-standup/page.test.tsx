import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination)
}));

import DailyStandupRoute from "./page";

afterEach(() => {
  redirectMock.mockClear();
});

describe("DailyStandupRoute server redirect", () => {
  it("redirects /[locale]/daily-standup to /[locale]/scenarios across locales", async () => {
    for (const locale of ["vi", "ja", "en"] as const) {
      redirectMock.mockClear();
      let caught: unknown = null;
      try {
        await DailyStandupRoute({ params: Promise.resolve({ locale }) });
      } catch (err) {
        caught = err;
      }

      expect(
        redirectMock,
        `DailyStandupRoute must server-redirect /${locale}/daily-standup to /${locale}/scenarios`
      ).toHaveBeenCalledWith(`/${locale}/scenarios`);
      expect(String(caught)).toContain(`NEXT_REDIRECT:/${locale}/scenarios`);
    }
  });
});
