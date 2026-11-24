import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination)
}));

import ExplorePage from "./page";

describe("ExplorePage server redirect", () => {
  it("redirects /[locale]/explore to /[locale]/search", async () => {
    redirectMock.mockClear();
    let caught: unknown = null;
    try {
      await ExplorePage({ params: Promise.resolve({ locale: "vi" }) });
    } catch (err) {
      caught = err;
    }

    expect(
      redirectMock,
      "ExplorePage must server-redirect /vi/explore to /vi/search"
    ).toHaveBeenCalledWith("/vi/search");
    expect(String(caught)).toContain("NEXT_REDIRECT:/vi/search");
  });
});
