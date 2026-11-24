// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import viMessages from "../../../../messages/vi.json";

vi.mock("./search-detail-learner-actions", () => ({
  SearchBookmarkToggle: () => null,
  SearchReadAloudButton: () => null
}));

import { SearchDetailPanel, type SearchDetailLabels } from "./search-detail-panel";

describe("SearchDetailPanel reference CTAs", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("removes the Đấu bot (/battle) CTA while preserving /quiz and /flashcards reference actions", async () => {
    await act(async () => {
      root.render(
        <SearchDetailPanel
          detail={null}
          detailError={false}
          detailLoading={false}
          labels={viMessages.search as unknown as SearchDetailLabels}
          locale="vi"
          query="会議"
          result={{
            id: "lex-1",
            kind: "lexeme",
            title: "会議",
            reading: "かいぎ",
            description: "cuộc họp"
          }}
          userId="user-1"
          variant="desktop"
        />
      );
    });

    expect(
      host.querySelector('a[href="/vi/battle"]'),
      "SearchDetailPanel must remove the /vi/battle Đấu bot CTA"
    ).toBeNull();
    expect(host.textContent).not.toContain(viMessages.search.bjtCtaBattle);
    expect(host.querySelector('a[href="/vi/quiz"]')).not.toBeNull();
    expect(host.querySelector('a[href="/vi/flashcards"]')).not.toBeNull();
  });

  it("links the saved-items shortcut directly to /{locale}/search?tab=saved", async () => {
    await act(async () => {
      root.render(
        <SearchDetailPanel
          detail={null}
          detailError={false}
          detailLoading={false}
          labels={viMessages.search as unknown as SearchDetailLabels}
          locale="vi"
          query="会議"
          result={{
            id: "lex-1",
            kind: "lexeme",
            title: "会議",
            reading: "かいぎ",
            description: "cuộc họp"
          }}
          userId="user-1"
          variant="desktop"
        />
      );
    });

    expect(
      host.querySelector('a[href="/vi/search?tab=saved"]'),
      "saved-list shortcut must open inline Saved tab directly"
    ).not.toBeNull();
  });
});
