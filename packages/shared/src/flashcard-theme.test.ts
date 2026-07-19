import { describe, expect, it } from "vitest";

import {
  DEFAULT_FLASHCARD_THEME,
  FLASHCARD_THEME_DEFINITIONS,
  flashcardThemeConfigSchema,
  resolveFlashcardThemeDefinition,
  safeFlashcardThemeConfig,
  validateFlashcardTheme
} from "./flashcard-theme.js";

describe("flashcard semantic themes", () => {
  it("defines every semantic token for every seeded theme", () => {
    for (const theme of FLASHCARD_THEME_DEFINITIONS) {
      expect(flashcardThemeConfigSchema.safeParse(theme.config), theme.slug).toMatchObject({
        success: true
      });
    }
  });

  it("does not contain duplicate theme ids", () => {
    const slugs = FLASHCARD_THEME_DEFINITIONS.map((theme) => theme.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("passes primary, muted, accent, control, border, and focus contrast policy", () => {
    for (const theme of FLASHCARD_THEME_DEFINITIONS) {
      const result = validateFlashcardTheme(theme.slug, theme.config);
      expect(result.errors, theme.slug).toEqual([]);
      expect(result.success, theme.slug).toBe(true);
      expect(
        result.contrast.find((pair) => pair.pair.startsWith("primary"))?.ratio
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        result.contrast.find((pair) => pair.pair.startsWith("secondary"))?.ratio
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        result.contrast.find((pair) => pair.pair.startsWith("accent"))?.ratio
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        result.contrast.find((pair) => pair.pair.startsWith("control"))?.ratio
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("requires a deterministic content surface for gradients", () => {
    const gradientThemes = FLASHCARD_THEME_DEFINITIONS.filter((theme) =>
      theme.config.background.startsWith("linear-gradient")
    );
    expect(gradientThemes.length).toBeGreaterThan(0);
    for (const theme of gradientThemes) {
      expect(theme.config.contentSurface).toMatch(/^#[0-9a-f]{6}$/i);
      expect("overlay" in theme.config ? theme.config.overlay : undefined).toMatch(
        /^#[0-9a-f]{6}$/i
      );
    }
  });

  it("rejects incomplete and low-contrast themes with actionable pair names", () => {
    const incomplete = validateFlashcardTheme("missing-tokens", {
      background: "#ffffff",
      foreground: "#111111"
    });
    expect(incomplete.success).toBe(false);
    expect(incomplete.errors.join(" ")).toContain("missing-tokens");

    const lowContrast = validateFlashcardTheme("washed-out", {
      ...DEFAULT_FLASHCARD_THEME.config,
      foreground: "#f5f5f5",
      mutedForeground: "#eeeeee"
    });
    expect(lowContrast.success).toBe(false);
    expect(lowContrast.errors.join(" ")).toContain("primary text/content surface");
    expect(lowContrast.errors.join(" ")).toContain("secondary text/content surface");
  });

  it("falls back safely for a removed stored theme id or invalid stored config", () => {
    expect(resolveFlashcardThemeDefinition("removed-theme").slug).toBe(
      DEFAULT_FLASHCARD_THEME.slug
    );
    expect(safeFlashcardThemeConfig({ background: "#ffffff" })).toEqual(
      DEFAULT_FLASHCARD_THEME.config
    );
  });
});
