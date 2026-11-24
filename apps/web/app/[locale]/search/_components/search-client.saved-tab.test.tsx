// @vitest-environment jsdom

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams(),
  userId: "learner-1" as string | null,
  learnerApiFetch: vi.fn(),
  fetch: vi.fn(),
  originalFetch: null as typeof fetch | null
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/vi/search",
  useRouter: () => ({ replace: mocks.replace, push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => mocks.params
}));
vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: mocks.userId })
}));
vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetch: mocks.learnerApiFetch
}));
vi.mock("../../../../lib/use-recent-searches", () => ({
  useRecentSearches: () => ({ searches: ["会議"], addSearch: vi.fn() })
}));
vi.mock("../../../_components/search-advanced-inputs", () => ({ VoiceSearchButton: () => null }));
vi.mock("../../../_components/nav-icons", () => ({ IconSearch: () => null }));
vi.mock("../../../_components/search-dropdown", () => ({ SearchDropdown: () => null }));
vi.mock("../../_components/ads/ad-slot", () => ({ AdSlot: () => null }));
vi.mock("./search-detail-panel", () => ({
  SearchDetailPanel: ({ result }: { result: { id: string } | null }) => (
    <div data-search-selected>{result?.id}</div>
  ),
  normalizeKanjiDetailDto: () => ({ character: "" })
}));
vi.mock("./search-highlight", () => ({
  HighlightMatch: ({ text }: { text: string }) => <span>{text}</span>
}));

import viMessages from "../../../../messages/vi.json";
import { SearchClient } from "./search-client";

function jsonResp(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

async function renderSearch(): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  host = container;
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <SearchClient adLabels={viMessages.adSurface} labels={viMessages.search} locale="vi" />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

describe("SearchClient inline Saved tab and filter alias (WEB-446)", () => {
  beforeEach(() => {
    mocks.params = new URLSearchParams();
    mocks.userId = "learner-1";
    mocks.replace.mockReset();
    mocks.learnerApiFetch.mockReset();
    mocks.fetch.mockReset();
    mocks.originalFetch = globalThis.fetch;
    globalThis.fetch = mocks.fetch;
    window.matchMedia =
      window.matchMedia ??
      ((() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })) as typeof window.matchMedia);

    mocks.learnerApiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/bookmarks/words")) {
        return jsonResp({
          items: [
            {
              id: "bm-1",
              targetId: "word-1",
              type: "lexeme",
              createdAt: "2026-10-11T00:00:00Z"
            }
          ],
          limit: 50,
          type: "lexeme"
        });
      }
      if (path === "/api/content/lexemes/word-1") {
        return jsonResp({ id: "word-1", headword: "稟議書" });
      }
      return jsonResp({ items: [], limit: 50, type: "kanji" });
    });

    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/search?")) {
        return jsonResp([
          {
            description: "cuộc họp",
            id: "lex-1",
            jlptLevel: "N2",
            kind: "lexeme",
            reading: "かいぎ",
            title: "会議"
          }
        ]);
      }
      if (url.includes("/api/content/lexemes/lex-1")) {
        return jsonResp({ id: "lex-1", headword: "会議" });
      }
      return jsonResp({});
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    host?.remove();
    root = null;
    host = null;
    if (mocks.originalFetch) globalThis.fetch = mocks.originalFetch;
    vi.restoreAllMocks();
  });

  it("renders the Saved tab inline when opened with ?tab=saved without nested main or duplicate h1", async () => {
    mocks.params = new URLSearchParams("tab=saved");
    const container = await renderSearch();

    expect(
      container.textContent ?? "",
      "inline saved tab must display resolved bookmarked item"
    ).toContain("稟議書");
    expect(container.textContent ?? "").toContain(viMessages.saved.openInSearch);
    expect(mocks.learnerApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/bookmarks/words")
    );
    expect(
      container.querySelectorAll("main"),
      "embedded Saved view must not introduce a nested <main> landmark"
    ).toHaveLength(1);
    expect(
      container.querySelectorAll("h1"),
      "embedded Saved view must not introduce a duplicate <h1>"
    ).toHaveLength(1);
  });

  it("switches inline to the Saved tab when clicking the Đã lưu pill and returns to search on kind pill click", async () => {
    mocks.params = new URLSearchParams();
    const container = await renderSearch();

    const savedPill = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (btn) => btn.textContent?.trim() === viMessages.saved.title
    );
    expect(savedPill, "search filter bar must include the Saved tab pill").toBeDefined();

    await act(async () => {
      savedPill!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.replace).toHaveBeenCalledWith("/vi/search?tab=saved", { scroll: false });
    expect(container.textContent ?? "").toContain(viMessages.saved.openInSearch);
    expect(container.textContent ?? "").toContain("稟議書");

    const kanjiPill = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (btn) => btn.textContent?.trim() === viMessages.search.kindKanji
    );
    expect(kanjiPill).toBeDefined();
    await act(async () => {
      kanjiPill!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.replace).toHaveBeenLastCalledWith("/vi/search?scope=kanji", { scroll: false });
    expect(container.textContent ?? "").not.toContain(viMessages.saved.openInSearch);
  });

  it("accepts ?kind=lexeme as a filter alias alongside ?scope=lexeme on mount", async () => {
    mocks.params = new URLSearchParams("kind=lexeme");
    const container = await renderSearch();

    const vocabPill = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (btn) => btn.textContent?.trim() === viMessages.search.kindLexeme
    );
    expect(
      vocabPill?.getAttribute("aria-pressed"),
      "vocabulary filter pill must be active when ?kind=lexeme is in URL"
    ).toBe("true");
  });

  it("keeps the Saved tab open without overwriting ?tab=saved when switching from an active search", async () => {
    mocks.params = new URLSearchParams("q=会議");
    const container = await renderSearch();

    mocks.replace.mockClear();
    const savedPill = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (btn) => btn.textContent?.trim() === viMessages.saved.title
    );
    expect(savedPill, "search filter bar must include the Saved tab pill").toBeDefined();

    await act(async () => {
      savedPill!.click();
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(mocks.replace).toHaveBeenLastCalledWith("/vi/search?tab=saved", { scroll: false });
    expect(container.textContent ?? "").toContain(viMessages.saved.openInSearch);

    // Returning from Saved via a kind pill must not fire a stale 350ms debounced overwrite
    mocks.params = new URLSearchParams("tab=saved");
    const kanjiPill = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (btn) => btn.textContent?.trim() === viMessages.search.kindKanji
    );
    expect(kanjiPill).toBeDefined();
    mocks.replace.mockClear();
    await act(async () => {
      kanjiPill!.click();
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenLastCalledWith("/vi/search?scope=kanji", { scroll: false });
  });

  it("clears ?scope= from the URL when clicking All on an empty scoped search", async () => {
    mocks.params = new URLSearchParams("scope=kanji");
    const container = await renderSearch();

    const allPill = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (btn) => btn.textContent?.trim() === viMessages.search.kindAll
    );
    expect(allPill).toBeDefined();
    await act(async () => {
      allPill!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.replace).toHaveBeenLastCalledWith("/vi/search", { scroll: false });
  });

  it("cancels loading state when switching to Saved mid-search and restores search landing on return", async () => {
    mocks.params = new URLSearchParams("q=会議");
    let resolveSearch: ((value: unknown) => void) | null = null;
    mocks.fetch.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes("/api/search?")) {
        return new Promise((resolve) => {
          resolveSearch = resolve;
        });
      }
      return Promise.resolve(jsonResp({}));
    });

    const container = await renderSearch();
    expect(container.querySelector(".animate-spin")).not.toBeNull();

    const savedPill = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (btn) => btn.textContent?.trim() === viMessages.saved.title
    );
    await act(async () => {
      savedPill!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(
      container.querySelector(".animate-spin"),
      "search spinner must stop immediately when entering Saved tab"
    ).toBeNull();

    // Resolve the cancelled search response after leaving Search
    await act(async () => {
      resolveSearch?.(jsonResp([]));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const allPill = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (btn) => btn.textContent?.trim() === viMessages.search.kindAll
    );
    await act(async () => {
      allPill!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(
      container.querySelector(".search-landing"),
      "returning to Search after cancelling in-flight search must render search landing, not a blank screen"
    ).not.toBeNull();
  });

  it("renders signed-out embedded Saved view without nested main, duplicate h1, or private fetches", async () => {
    mocks.userId = null;
    mocks.params = new URLSearchParams("tab=saved");
    const container = await renderSearch();

    expect(container.textContent ?? "").toContain(viMessages.saved.signInTitle);
    expect(mocks.learnerApiFetch).not.toHaveBeenCalled();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });
});
