import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "./sitemap";

const EXPECTED_ROUTES = [
  "",
  "explore",
  "levels",
  "dictionary",
  "kanji",
  "grammar",
  "flashcards",
  "quiz",
  "exercises",
  "magazine",
  "news",
  "pricing",
  "help",
  "feedback",
  "privacy",
  "terms",
  "story/arcs",
];

describe("sitemap metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists all 17 public routes across vi, ja, and en locales using canonical base URL", () => {
    vi.stubEnv("WEB_PUBLIC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_WEB_PUBLIC_URL", "");

    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

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
