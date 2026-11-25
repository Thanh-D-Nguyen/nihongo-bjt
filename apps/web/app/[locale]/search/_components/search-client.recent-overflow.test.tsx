// @vitest-environment jsdom

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  params: new URLSearchParams(),
  recentSearches: ["会議", "敬語", "お世話になっております"]
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/vi/search",
  useRouter: () => ({ replace: mocks.replace, push: mocks.push, prefetch: vi.fn() }),
  useSearchParams: () => mocks.params
}));
vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: null })
}));
vi.mock("../../../../lib/use-recent-searches", () => ({
  useRecentSearches: () => ({
    searches: mocks.recentSearches,
    addSearch: vi.fn(),
    removeSearch: vi.fn(),
    clearAll: vi.fn()
  })
}));
vi.mock("../../_components/ads/ad-slot", () => ({ AdSlot: () => null }));
vi.mock("./search-detail-panel", () => ({
  SearchDetailPanel: () => null,
  normalizeKanjiDetailDto: () => ({ character: "" })
}));
vi.mock("./search-highlight", () => ({ HighlightMatch: ({ text }: { text: string }) => <span>{text}</span> }));

import viMessages from "../../../../messages/vi.json";
import { SearchClient } from "./search-client";

describe("SearchClient recent searches and JLPT chip layout (WEB-451)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.params = new URLSearchParams();
    mocks.replace.mockReset();
    mocks.push.mockReset();
    window.matchMedia = (() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })) as unknown as typeof window.matchMedia;
    (window as unknown as Record<string, unknown>).SpeechRecognition = vi.fn();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    await act(async () => root.unmount());
    container.remove();
  });

  it("does not auto-open SearchDropdown over the N1-N5 filter bar on mount and anchors opened dropdown to full form width", async () => {
    await act(async () => {
      root.render(
        <SearchClient
          adLabels={viMessages.adSurface}
          labels={viMessages.search}
          locale="vi"
          savedLabels={viMessages.saved}
        />
      );
      await Promise.resolve();
    });

    const form = container.querySelector("form")!;
    expect(form, "search form must exist").not.toBeNull();

    // On initial mount with empty query, autofocus must NOT pop open the floating SearchDropdown
    // over the JLPT N1-N5 row (leaving N5 clipped beside "TÌM KIẾM GẦN ĐÂY").
    expect(
      form.textContent,
      "floating SearchDropdown must not auto-open over the filter bar on initial mount"
    ).not.toContain(viMessages.search.recentTitle);

    // The in-page landing recent-searches card still renders cleanly with flex-wrap.
    const landing = container.querySelector(".search-landing")!;
    expect(landing.textContent).toContain(viMessages.search.recentTitle);
    const landingJlptRow = Array.from(landing.querySelectorAll("div")).find((el) =>
      el.textContent?.includes("JLPT:") && el.textContent?.includes("N5")
    );
    expect(landingJlptRow?.className, "landing JLPT chip row must allow wrapping").toContain("flex-wrap");

    // Clicking the search input explicitly opens SearchDropdown anchored directly to <form>
    // (full search-bar width, never stopping short of VoiceSearchButton where N5 peeked out).
    const input = form.querySelector<HTMLInputElement>("#content-search")!;
    await act(async () => {
      input.click();
      await Promise.resolve();
    });

    const clearRecentBtn = Array.from(form.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === viMessages.search.clearRecent
    );
    expect(clearRecentBtn, "clicking search input must open SearchDropdown").toBeTruthy();
    const dropdownRoot = clearRecentBtn!.closest(".absolute")!;
    expect(
      dropdownRoot.parentElement,
      "SearchDropdown must be anchored to <form className='relative'> for full-width coverage"
    ).toBe(form);
  });
});
