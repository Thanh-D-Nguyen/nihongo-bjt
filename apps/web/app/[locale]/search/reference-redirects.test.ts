import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

import DictionaryPage from "../dictionary/page";
import LexemeDetailPage from "../dictionary/[id]/page";
import ExercisesPage from "../exercises/page";
import GrammarPage from "../grammar/page";
import GrammarDetailPage from "../grammar/[id]/page";
import KanjiPage from "../kanji/page";
import KanjiDetailPage from "../kanji/[id]/page";
import SavedPage from "../saved/page";
import SearchHistoryPage from "./history/page";

describe("Reference list-page redirects and detail-page preservation (WEB-446)", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("redirects /dictionary, /kanji, /grammar, /saved, and /search/history list pages to /{locale}/search across vi, ja, and en", async () => {
    for (const locale of ["vi", "ja", "en"] as const) {
      await expect(
        DictionaryPage({ params: Promise.resolve({ locale }) })
      ).rejects.toThrow(`NEXT_REDIRECT:/${locale}/search?scope=lexeme`);
      expect(redirectMock).toHaveBeenLastCalledWith(`/${locale}/search?scope=lexeme`);

      await expect(
        KanjiPage({ params: Promise.resolve({ locale }) })
      ).rejects.toThrow(`NEXT_REDIRECT:/${locale}/search?scope=kanji`);
      expect(redirectMock).toHaveBeenLastCalledWith(`/${locale}/search?scope=kanji`);

      await expect(
        GrammarPage({ params: Promise.resolve({ locale }) })
      ).rejects.toThrow(`NEXT_REDIRECT:/${locale}/search?scope=grammar`);
      expect(redirectMock).toHaveBeenLastCalledWith(`/${locale}/search?scope=grammar`);

      await expect(
        SavedPage({ params: Promise.resolve({ locale }) })
      ).rejects.toThrow(`NEXT_REDIRECT:/${locale}/search?tab=saved`);
      expect(redirectMock).toHaveBeenLastCalledWith(`/${locale}/search?tab=saved`);

      await expect(
        SearchHistoryPage({ params: Promise.resolve({ locale }) })
      ).rejects.toThrow(`NEXT_REDIRECT:/${locale}/search`);
      expect(redirectMock).toHaveBeenLastCalledWith(`/${locale}/search`);
    }

    expect(redirectMock).toHaveBeenCalledTimes(15);
  });

  it("keeps /dictionary/[id], /kanji/[id], /grammar/[id] detail pages and /exercises rendering without redirecting", async () => {
    const lexeme = await LexemeDetailPage({
      params: Promise.resolve({ id: "lexeme-1", locale: "vi" })
    });
    const kanji = await KanjiDetailPage({
      params: Promise.resolve({ id: "kanji-1", locale: "vi" })
    });
    const grammar = await GrammarDetailPage({
      params: Promise.resolve({ id: "grammar-1", locale: "vi" })
    });
    const exercises = await ExercisesPage({
      params: Promise.resolve({ locale: "vi" })
    });

    expect(lexeme).toBeTruthy();
    expect(kanji).toBeTruthy();
    expect(grammar).toBeTruthy();
    expect(exercises).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
