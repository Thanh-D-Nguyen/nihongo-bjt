// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({ removeSearch: vi.fn(), clearAll: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../../../../../lib/use-recent-searches", () => ({
  useRecentSearches: () => ({ searches: ["会議", "学生"], removeSearch: mocks.removeSearch, clearAll: mocks.clearAll })
}));

import { SearchHistoryClient } from "./search-history-client";

describe("SearchHistoryClient", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("keeps each individual remove control visible and touch-sized on mobile", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<SearchHistoryClient locale="vi" labels={{ title: "History", empty: "Empty", clearAll: "Clear all", searchAgain: "Search again", remove: "Remove" }} />));

    const removeButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('button[title="Remove"]'));
    expect(removeButtons).toHaveLength(2);
    for (const button of removeButtons) {
      expect(button.className.split(" ")).toContain("opacity-100");
      expect(button.className.split(" ")).toEqual(expect.arrayContaining(["h-11", "w-11", "md:opacity-0"]));
      expect(button.className.split(" ")).not.toContain("opacity-0");
    }

    await act(async () => removeButtons[0]?.click());
    expect(mocks.removeSearch).toHaveBeenCalledExactlyOnceWith("会議");
    await act(async () => root.unmount());
    container.remove();
  });
});
