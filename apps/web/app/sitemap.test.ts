import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "./sitemap";

// WEB-441: "explore" server-redirects to /{locale}/search and is excluded from sitemap.xml
// WEB-442: "magazine" (-> /{locale}/news) and "story/arcs" (-> /{locale}/scenarios) server-redirect and are excluded from sitemap.xml
// WEB-445: "cardgen" (-> /{locale}/flashcards?tab=library) server-redirects and is excluded from sitemap.xml
const EXPECTED_ROUTES = [
  "",
  "levels",
  "dictionary",
  "kanji",
  "grammar",
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

  it("lists all 14 public routes across vi, ja, and en locales using canonical base URL", () => {
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
      expect(urls, "sitemap must exclude redirected /cardgen route").not.toContain(
        `https://kiokoto.com/${locale}/cardgen`
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
