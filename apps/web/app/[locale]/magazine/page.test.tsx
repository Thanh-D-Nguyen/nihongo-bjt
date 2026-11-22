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

it("normalizes legacy ?kind=bjt URLs to bjt_phrase for the API request, client state, and retry link", async () => {
  vi.stubEnv("API_URL", "http://api.test");
  const article = {
    id: "magazine-bjt-1",
    slug: "2026-10-26-bjt_phrase-vi",
    widgetKind: "magazine_bjt_phrase",
    titleJp: "恐れ入りますが",
    titleVi: "Xin phép làm phiền",
    summaryVi: "Cách mở đầu lịch sự trong kinh doanh.",
    jlptLevel: "N2",
    publishDate: "2026-10-26",
    vocabWords: [],
  };
  const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({
    data: [article], total: 1, page: 1, limit: 12,
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const { default: page } = await import("./page");
  const tree = await page({
    params: Promise.resolve({ locale: "vi" }),
    searchParams: Promise.resolve({ kind: "bjt" }),
  });
  renderToStaticMarkup(tree);

  expect(
    fetchMock.mock.calls[0]?.[0],
    "legacy ?kind=bjt must normalize to API kind bjt_phrase",
  ).toBe("http://api.test/api/magazine?kind=bjt_phrase&page=1&limit=12");
  expect(mockMagazinePageClient).toHaveBeenCalledWith(expect.objectContaining({
    articles: [article],
    kind: "bjt_phrase",
    page: 1,
    totalPages: 1,
  }), undefined);

  // Also verify retry link uses normalized bjt_phrase when API fails.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
  const errorTree = await page({
    params: Promise.resolve({ locale: "vi" }),
    searchParams: Promise.resolve({ kind: "bjt", page: "2" }),
  });
  const errorMarkup = renderToStaticMarkup(errorTree);
  expect(errorMarkup).toContain('href="/vi/magazine?kind=bjt_phrase&amp;page=2"');
});

it("normalizes widgetKind aliases such as magazine_bjt_phrase and magazine_loto6 to canonical API kinds", async () => {
  vi.stubEnv("API_URL", "http://api.test");
  const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({
    data: [], total: 0, page: 1, limit: 12,
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const { default: page } = await import("./page");
  const cases = [
    ["BJT", "bjt_phrase"],
    ["magazine_bjt_phrase", "bjt_phrase"],
    ["magazine_vocab", "vocab"],
    ["magazine_weather", "weather"],
    ["magazine_horoscope", "horoscope"],
    ["magazine_loto6", "loto"],
  ] as const;

  for (const [input, expected] of cases) {
    fetchMock.mockClear();
    mockMagazinePageClient.mockClear();
    const tree = await page({
      params: Promise.resolve({ locale: "vi" }),
      searchParams: Promise.resolve({ kind: input }),
    });
    renderToStaticMarkup(tree);
    expect(
      fetchMock.mock.calls[0]?.[0],
      `alias ?kind=${input} must normalize to API kind ${expected}`,
    ).toBe(`http://api.test/api/magazine?kind=${expected}&page=1&limit=12`);
    expect(mockMagazinePageClient).toHaveBeenCalledWith(expect.objectContaining({
      kind: expected,
    }), undefined);
  }
});
