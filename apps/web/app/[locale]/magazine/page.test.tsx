import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination)
}));

import MagazinePage from "./page";

type MagazinePageFn = (props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string; page?: string }>;
}) => Promise<unknown>;

const invokeMagazinePage: MagazinePageFn = MagazinePage;

afterEach(() => {
  redirectMock.mockClear();
  vi.unstubAllGlobals();
});

// WEB-442 contract change (ENGINEERING_POLICY.md §5):
// Auto-Magazine index route /[locale]/magazine is sunset under Strategy (a) and
// now server-redirects directly to /{locale}/news without calling /api/magazine.
// Underlying magazine/_components/* files and their unit tests remain on disk.
describe("MagazinePage server redirect", () => {
  it("redirects /[locale]/magazine to /[locale]/news across supported locales without fetching the magazine API", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [], total: 0, page: 1, limit: 12 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    for (const locale of ["vi", "ja", "en"] as const) {
      redirectMock.mockClear();
      let caught: unknown = null;
      try {
        await invokeMagazinePage({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({})
        });
      } catch (err) {
        caught = err;
      }

      expect(
        redirectMock,
        `MagazinePage must server-redirect /${locale}/magazine to /${locale}/news`
      ).toHaveBeenCalledWith(`/${locale}/news`);
      expect(String(caught)).toContain(`NEXT_REDIRECT:/${locale}/news`);
    }

    expect(fetchMock, "MagazinePage redirect must not call /api/magazine").not.toHaveBeenCalled();
  });

  it("redirects legacy magazine filter and pagination URLs directly to /[locale]/news", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [], total: 0, page: 1, limit: 12 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    for (const searchParams of [
      { kind: "bjt_phrase", page: "2" },
      { kind: "bjt" },
      { kind: "magazine_loto6", page: "999" }
    ]) {
      redirectMock.mockClear();
      let caught: unknown = null;
      try {
        await invokeMagazinePage({
          params: Promise.resolve({ locale: "vi" }),
          searchParams: Promise.resolve(searchParams)
        });
      } catch (err) {
        caught = err;
      }

      expect(
        redirectMock,
        "MagazinePage must server-redirect legacy query URLs to /vi/news"
      ).toHaveBeenCalledWith("/vi/news");
      expect(String(caught)).toContain("NEXT_REDIRECT:/vi/news");
    }

    expect(fetchMock, "MagazinePage redirect must not call /api/magazine for legacy queries").not.toHaveBeenCalled();
  });
});
