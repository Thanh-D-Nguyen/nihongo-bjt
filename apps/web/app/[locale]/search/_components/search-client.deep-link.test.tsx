// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  params: null as URLSearchParams | null,
  fetch: vi.fn(),
  originalFetch: null as typeof fetch | null
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/vi/search",
  useRouter: () => ({ replace: mocks.replace, push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => mocks.params
}));
vi.mock("../../../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ userId: "learner-1" }) }));
vi.mock("../../../../lib/use-recent-searches", () => ({
  useRecentSearches: () => ({ searches: [], addSearch: vi.fn() })
}));
vi.mock("../../../_components/search-advanced-inputs", () => ({ VoiceSearchButton: () => null }));
vi.mock("../../../_components/nav-icons", () => ({ IconSearch: () => null }));
vi.mock("../../../_components/search-dropdown", () => ({ SearchDropdown: () => null }));
vi.mock("../../_components/ads/ad-slot", () => ({ AdSlot: () => null }));
vi.mock("./search-detail-panel", () => ({
  SearchDetailPanel: ({ result }: { result: { id: string } | null }) => <div data-search-selected>{result?.id}</div>,
  normalizeKanjiDetailDto: () => ({ character: "" })
}));
vi.mock("./search-highlight", () => ({ HighlightMatch: ({ text }: { text: string }) => <span>{text}</span> }));

import messages from "../../../../messages/vi.json";
import { SearchClient } from "./search-client";

describe("SearchClient saved-entry deep links", () => {
  beforeEach(() => {
    mocks.params = new URLSearchParams({
      entry: "lexeme:lexeme-1",
      q: "会議"
    });
    mocks.replace.mockReset();
    mocks.fetch.mockReset();
    mocks.originalFetch = globalThis.fetch;
    globalThis.fetch = mocks.fetch;
    window.matchMedia = window.matchMedia ?? (() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })) as typeof window.matchMedia;
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/search?")) {
        return { ok: true, json: async () => [{
          description: "meeting",
          id: "lexeme-1",
          jlptLevel: "N4",
          kind: "lexeme",
          reading: "かいぎ",
          title: "会議"
        }] };
      }
      if (url.includes("/api/content/lexemes/lexeme-1")) {
        return { ok: true, json: async () => ({ id: "lexeme-1", headword: "会議" }) };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  afterEach(() => {
    if (mocks.originalFetch) globalThis.fetch = mocks.originalFetch;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("keeps the requested entry and loads its exact detail after search results arrive", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SearchClient adLabels={messages.adSurface} labels={messages.search} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/content/lexemes/lexeme-1"));
    expect(mocks.replace).not.toHaveBeenCalledWith("/vi/search?q=%E4%BC%9A%E8%AD%B0", expect.anything());
    expect(container.textContent).toContain("会議");

    await act(async () => root.unmount());
    container.remove();

    mocks.params = new URLSearchParams({ entry: "lexeme:missing-id", q: "会議" });
    mocks.fetch.mockClear();
    mocks.replace.mockReset();
    const missingContainer = document.createElement("div");
    document.body.appendChild(missingContainer);
    const missingRoot = createRoot(missingContainer);
    await act(async () => {
      missingRoot.render(<SearchClient adLabels={messages.adSurface} labels={messages.search} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/content/lexemes/lexeme-1"));
    expect(mocks.replace).not.toHaveBeenCalledWith(expect.stringContaining("entry=lexeme%3Alexeme-1"), expect.anything());

    await act(async () => missingRoot.unmount());
    missingContainer.remove();
  });

  it("does not replace a missing entry target with the first search result", async () => {
    mocks.params = new URLSearchParams({ entry: "lexeme:missing-id", q: "会議" });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SearchClient adLabels={messages.adSurface} labels={messages.search} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/content/lexemes/lexeme-1"));
    expect(mocks.replace).not.toHaveBeenCalledWith(expect.stringContaining("entry=lexeme%3Alexeme-1"), expect.anything());

    await act(async () => root.unmount());
    container.remove();
  });

  it("selectsClickedResultDespiteStaleUrlEntry", async () => {
    mocks.params = new URLSearchParams({ entry: "lexeme:old-entry", q: "会議" });
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/search?")) {
        return { ok: true, json: async () => [
          { description: "meeting", id: "lexeme-1", kind: "lexeme", reading: "かいぎ", title: "会議" }
        ] };
      }
      return { ok: true, json: async () => ({ id: "lexeme-1", headword: "会議" }) };
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SearchClient adLabels={messages.adSurface} labels={messages.search} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const result = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("会議"));
    expect(result).toBeDefined();
    await act(async () => {
      result?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/content/lexemes/lexeme-1"));
    expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("entry=lexeme%3Alexeme-1"), expect.anything());
    await act(async () => root.unmount());
    container.remove();
  });

  it("keepsAutomaticallySelectedEntryAfterBootstrapDebounce", async () => {
    mocks.params = new URLSearchParams({ q: "会議" });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<SearchClient adLabels={messages.adSurface} labels={messages.search} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(container.querySelector("[data-search-selected]")?.textContent, "bootstrap query must retain selected detail").toContain("lexeme-1");
    await act(async () => root.unmount());
    container.remove();
  });

  it("honors an entry added to an already-mounted query without replacing its identity", async () => {
    mocks.params = new URLSearchParams({ q: "会議" });
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/search?")) {
        return { ok: true, json: async () => [
          { description: "meeting", id: "lexeme-1", kind: "lexeme", reading: "かいぎ", title: "会議" },
          { description: "meeting room", id: "lexeme-2", kind: "lexeme", reading: "かいぎしつ", title: "会議室" }
        ] };
      }
      return { ok: true, json: async () => ({ id: "lexeme-2", headword: "会議室" }) };
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SearchClient adLabels={messages.adSurface} labels={messages.search} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    mocks.replace.mockClear();
    mocks.fetch.mockClear();
    mocks.params = new URLSearchParams({ entry: "lexeme:lexeme-2", q: "会議" });

    await act(async () => {
      root.render(<SearchClient adLabels={messages.adSurface} labels={messages.search} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.replace).not.toHaveBeenCalledWith(expect.stringContaining("entry=lexeme%3Alexeme-1"), expect.anything());
    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/content/lexemes/lexeme-2"));

    await act(async () => root.unmount());
    container.remove();
  });
});
