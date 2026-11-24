import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "./sitemap";

// WEB-441: "explore" server-redirects to /{locale}/search and is excluded from sitemap.xml
// WEB-442: "magazine" (-> /{locale}/news) and "story/arcs" (-> /{locale}/scenarios) server-redirect and are excluded from sitemap.xml
// WEB-444: "modules" server-redirects to /{locale}/levels and stays excluded from sitemap.xml
// WEB-446: "dictionary", "kanji", "grammar", "saved", and "search/history" server-redirect to /{locale}/search; index "search" instead.
const EXPECTED_ROUTES = [
  "",
  "levels",
  "search",
  "flashcards",
  "quiz",
  "exercises",
  "news",
  "pricing",
  "help",
  "feedback",
  "privacy",
  "terms",
];

describe("sitemap metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists all 12 public routes across vi, ja, and en locales using canonical base URL", () => {
    vi.stubEnv("WEB_PUBLIC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_WEB_PUBLIC_URL", "");

    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    for (const locale of ["vi", "ja", "en"] as const) {
      expect(urls, "sitemap must exclude redirected /explore route").not.toContain(
        `https://kiokoto.com/${locale}/explore`
      );
      expect(urls, "sitemap must exclude redirected /magazine route").not.toContain(
        `https://kiokoto.com/${locale}/magazine`
      );
      expect(urls, "sitemap must exclude redirected /story/arcs route").not.toContain(
        `https://kiokoto.com/${locale}/story/arcs`
      );
      expect(urls, "sitemap must exclude redirected /modules route").not.toContain(
        `https://kiokoto.com/${locale}/modules`
      );
      expect(urls, "sitemap must exclude redirected /dictionary route").not.toContain(
        `https://kiokoto.com/${locale}/dictionary`
      );
      expect(urls, "sitemap must exclude redirected /kanji route").not.toContain(
        `https://kiokoto.com/${locale}/kanji`
      );
      expect(urls, "sitemap must exclude redirected /grammar route").not.toContain(
        `https://kiokoto.com/${locale}/grammar`
      );
      expect(urls, "sitemap must exclude redirected /saved route").not.toContain(
        `https://kiokoto.com/${locale}/saved`
      );
      expect(urls, "sitemap must exclude redirected /search/history route").not.toContain(
        `https://kiokoto.com/${locale}/search/history`
      );
    }

    expect(entries).toHaveLength(EXPECTED_ROUTES.length * 3);
    expect(new Set(urls).size).toBe(EXPECTED_ROUTES.length * 3);

    for (const locale of ["vi", "ja", "en"] as const) {
      for (const route of EXPECTED_ROUTES) {
        const expectedUrl = route ? `https://kiokoto.com/${locale}/${route}` : `https://kiokoto.com/${locale}`;
        expect(urls).toContain(expectedUrl);
      }
    }
  });

  it("respects WEB_PUBLIC_URL without trailing slashes", () => {
    vi.stubEnv("WEB_PUBLIC_URL", "https://staging.kiokoto.com/");

    const entries = sitemap();

    expect(entries[0]?.url).toBe("https://staging.kiokoto.com/vi");
    expect(entries.every((entry) => entry.url.startsWith("https://staging.kiokoto.com/"))).toBe(true);
  });
});
