import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination)
}));

import InboxRoute from "./page";

afterEach(() => {
  redirectMock.mockClear();
});

describe("InboxRoute server redirect", () => {
  it("redirects /[locale]/review-inbox-preview to /[locale]/flashcards?tab=review across locales", async () => {
    for (const locale of ["vi", "ja", "en"] as const) {
      redirectMock.mockClear();
      let caught: unknown = null;
      try {
        await InboxRoute({ params: Promise.resolve({ locale }) });
      } catch (err) {
        caught = err;
      }

      expect(
        redirectMock,
        `InboxRoute must server-redirect /${locale}/review-inbox-preview to /${locale}/flashcards?tab=review`
      ).toHaveBeenCalledWith(`/${locale}/flashcards?tab=review`);
      expect(String(caught)).toContain(`NEXT_REDIRECT:/${locale}/flashcards?tab=review`);
    }
  });
});
