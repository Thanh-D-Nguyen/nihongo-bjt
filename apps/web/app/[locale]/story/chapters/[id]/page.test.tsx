import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination)
}));

import ChapterRoute from "./page";

afterEach(() => {
  redirectMock.mockClear();
});

describe("ChapterRoute server redirect", () => {
  it("redirects /[locale]/story/chapters/[id] to /[locale]/scenarios across locales", async () => {
    for (const locale of ["vi", "ja", "en"] as const) {
      redirectMock.mockClear();
      let caught: unknown = null;
      try {
        await ChapterRoute({
          params: Promise.resolve({ locale, id: "chapter-1" })
        });
      } catch (err) {
        caught = err;
      }

      expect(
        redirectMock,
        `ChapterRoute must server-redirect /${locale}/story/chapters/chapter-1 to /${locale}/scenarios`
      ).toHaveBeenCalledWith(`/${locale}/scenarios`);
      expect(String(caught)).toContain(`NEXT_REDIRECT:/${locale}/scenarios`);
    }
  });
});
