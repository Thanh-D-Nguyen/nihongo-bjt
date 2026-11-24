import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination)
}));

import ModulesIndexPage from "./page";

afterEach(() => {
  redirectMock.mockClear();
});

describe("ModulesIndexPage server redirect", () => {
  it("redirects /[locale]/modules to /[locale]/levels across locales", async () => {
    for (const locale of ["vi", "ja", "en"] as const) {
      redirectMock.mockClear();
      let caught: unknown = null;
      try {
        await ModulesIndexPage({ params: Promise.resolve({ locale }) });
      } catch (err) {
        caught = err;
      }

      expect(
        redirectMock,
        `ModulesIndexPage must server-redirect /${locale}/modules to /${locale}/levels`
      ).toHaveBeenCalledWith(`/${locale}/levels`);
      expect(String(caught)).toContain(`NEXT_REDIRECT:/${locale}/levels`);
    }
  });
});
