import { afterEach, expect, it, vi } from "vitest";

const mockMagazinePageClient = vi.hoisted(() => vi.fn(() => null));

vi.mock("./_components/magazine-page-client", () => ({
  MagazinePageClient: mockMagazinePageClient,
}));

import { renderToStaticMarkup } from "react-dom/server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  mockMagazinePageClient.mockClear();
});

it("passes the paged published list and requested filter to the visible magazine view", async () => {
  vi.stubEnv("API_URL", "http://api.test");
  const article = {
    id: "magazine-1",
    slug: "business-phrase",
    widgetKind: "magazine_bjt_phrase",
    titleJp: "会議の表現",
    titleVi: "Cụm từ cuộc họp",
    summaryVi: "Một cụm từ dùng trong cuộc họp.",
    jlptLevel: "N3",
    publishDate: "2026-10-08",
    publishedAt: "2026-10-08T00:00:00Z",
    vocabWords: [{ word: "会議", reading: "かいぎ", meaning: "cuộc họp" }],
  };
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    data: [article], total: 14, page: 2, limit: 12,
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const { default: page } = await import("./page");
  const tree = await page({
    params: Promise.resolve({ locale: "vi" }),
    searchParams: Promise.resolve({ kind: "bjt_phrase", page: "2" }),
  });
  renderToStaticMarkup(tree);

  expect(fetchMock).toHaveBeenCalledWith(
    "http://api.test/api/magazine?kind=bjt_phrase&page=2&limit=12",
    { cache: "no-store" },
  );
  expect(mockMagazinePageClient).toHaveBeenCalledWith(expect.objectContaining({
    articles: [article],
    kind: "bjt_phrase",
    page: 2,
    totalPages: 2,
  }), undefined);
});

it("shows the API's clamped page when the requested page is past the catalog", async () => {
  vi.stubEnv("API_URL", "http://api.test");
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    data: [{ id: "magazine-last", slug: "last-article", widgetKind: "magazine_vocab", titleJp: "語彙", titleVi: "Từ vựng", publishDate: "2026-10-08", vocabWords: [] }],
    total: 14,
    page: 2,
    limit: 12,
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const { default: page } = await import("./page");
  const tree = await page({
    params: Promise.resolve({ locale: "vi" }),
    searchParams: Promise.resolve({ page: "999" }),
  });
  renderToStaticMarkup(tree);

  expect(mockMagazinePageClient).toHaveBeenCalledWith(expect.objectContaining({
    articles: expect.arrayContaining([expect.objectContaining({ slug: "last-article" })]),
    page: 2,
    totalPages: 2,
  }), undefined);
});

it("renders a retryable operational error instead of the empty-catalog state", async () => {
  vi.stubEnv("API_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));

  const { default: page } = await import("./page");
  const tree = await page({
    params: Promise.resolve({ locale: "vi" }),
    searchParams: Promise.resolve({}),
  });
  const markup = renderToStaticMarkup(tree);

  expect(markup).toContain('role="alert"');
  expect(markup).toContain("Chưa tải được tạp chí");
  expect(markup).not.toContain("Chưa có bài viết nào");
  expect(mockMagazinePageClient).not.toHaveBeenCalled();
});
