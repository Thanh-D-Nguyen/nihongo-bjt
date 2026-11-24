import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});
const notFoundMock = vi.fn((): never => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination),
  notFound: () => notFoundMock()
}));

import MagazineArticlePage from "./page";

afterEach(() => {
  redirectMock.mockClear();
  notFoundMock.mockClear();
  vi.unstubAllGlobals();
});

// WEB-442 contract change (ENGINEERING_POLICY.md §5):
// Auto-Magazine article route /[locale]/magazine/[slug] is sunset under Strategy (a)
// and now server-redirects directly to /{locale}/news without calling /api/magazine/:slug.
describe("MagazineArticlePage server redirect", () => {
  it("redirects /[locale]/magazine/[slug] to /[locale]/news across locales without fetching the magazine API", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "magazine-1",
          slug: "business-phrase",
          titleJp: "会議の表現",
          titleVi: "Cụm từ cuộc họp",
          publishDate: "2026-10-08",
          vocabWords: []
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    for (const locale of ["vi", "ja", "en"] as const) {
      redirectMock.mockClear();
      let caught: unknown = null;
      try {
        await MagazineArticlePage({
          params: Promise.resolve({ locale, slug: "business-phrase" })
        });
      } catch (err) {
        caught = err;
      }

      expect(
        redirectMock,
        `MagazineArticlePage must server-redirect /${locale}/magazine/business-phrase to /${locale}/news`
      ).toHaveBeenCalledWith(`/${locale}/news`);
      expect(String(caught)).toContain(`NEXT_REDIRECT:/${locale}/news`);
    }

    expect(fetchMock, "MagazineArticlePage redirect must not call /api/magazine/:slug").not.toHaveBeenCalled();
  });

  it("redirects missing or unknown slugs to /[locale]/news instead of calling notFound", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown = null;
    try {
      await MagazineArticlePage({
        params: Promise.resolve({ locale: "vi", slug: "missing-article" })
      });
    } catch (err) {
      caught = err;
    }

    expect(
      redirectMock,
      "MagazineArticlePage must server-redirect unknown slugs to /vi/news"
    ).toHaveBeenCalledWith("/vi/news");
    expect(String(caught)).toContain("NEXT_REDIRECT:/vi/news");
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
