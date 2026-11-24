import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

import CardgenPage from "./page";

describe("CardgenPage redirect (WEB-445)", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("redirects /{locale}/cardgen to /{locale}/flashcards?tab=library across vi, ja, and en", async () => {
    for (const locale of ["vi", "ja", "en"] as const) {
      await expect(
        CardgenPage({ params: Promise.resolve({ locale }) }),
        `/${locale}/cardgen must server-redirect to /${locale}/flashcards?tab=library`
      ).rejects.toThrow(`NEXT_REDIRECT:/${locale}/flashcards?tab=library`);
      expect(redirectMock).toHaveBeenLastCalledWith(`/${locale}/flashcards?tab=library`);
    }
    expect(redirectMock).toHaveBeenCalledTimes(3);
  });
});
