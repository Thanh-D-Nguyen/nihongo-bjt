// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({ learnerApiFetch: vi.fn(), userId: "learner-1" as string | null }));
vi.mock("../../../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ userId: mocks.userId }) }));
vi.mock("../../../../lib/learner-api", () => ({ learnerApiFetch: mocks.learnerApiFetch }));

import messages from "../../../../messages/vi.json";
import { SavedPageClient } from "./saved-page-client";

function response(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

describe("SavedPageClient", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    mocks.userId = "learner-1";
  });

  it("does not request or render private bookmarks anonymously", async () => {
    mocks.userId = null;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<SavedPageClient labels={messages.saved} locale="vi" />));

    expect(container.textContent).toContain(messages.saved.signInTitle);
    expect(mocks.learnerApiFetch).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    container.remove();
  });

  it("shows a recoverable error rather than an empty state when the list request fails", async () => {
    mocks.learnerApiFetch.mockRejectedValue(new Error("offline"));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SavedPageClient labels={messages.saved} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(messages.saved.error);
    expect(container.textContent).not.toContain(messages.saved.emptyWords);
    await act(async () => root.unmount());
    container.remove();
  });

  it("resolves saved word titles from the canonical content detail endpoint", async () => {
    mocks.learnerApiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/bookmarks/words")) return response({ items: [{ id: "bookmark-1", targetId: "word-1", type: "lexeme", createdAt: "2026-10-11T00:00:00Z" }], limit: 50, type: "lexeme" });
      if (path.startsWith("/api/bookmarks/kanji")) return response({ items: [{ id: "bookmark-2", targetId: "kanji-1", type: "kanji", createdAt: "2026-10-11T00:00:00Z" }], limit: 50, type: "kanji" });
      if (path.startsWith("/api/bookmarks/grammar")) return response({ items: [{ id: "bookmark-3", targetId: "grammar-1", type: "grammar", createdAt: "2026-10-11T00:00:00Z" }], limit: 50, type: "grammar" });
      if (path === "/api/content/lexemes/word-1") return response({ id: "word-1", headword: "会議" });
      if (path === "/api/kanji/kanji-1") return response({ id: "kanji-1", character: "会" });
      if (path === "/api/content/grammar/grammar-1") return response({ id: "grammar-1", pattern: "〜ために" });
      return response({}, false);
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SavedPageClient labels={messages.saved} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.learnerApiFetch).toHaveBeenCalledWith("/api/content/lexemes/word-1");
    expect(container.textContent).toContain("会議");
    expect(container.textContent).not.toContain(messages.saved.unknownTitle);
    expect(Array.from(container.querySelectorAll("a")).some((link) => link.href.includes("entry=lexeme%3Aword-1") && link.href.includes("q=%E4%BC%9A%E8%AD%B0"))).toBe(true);

    const tabs = container.querySelectorAll<HTMLButtonElement>("[role=tab]");
    await act(async () => {
      tabs[1]?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.learnerApiFetch).toHaveBeenCalledWith("/api/kanji/kanji-1");
    expect(container.textContent).toContain("会");
    expect(container.textContent).not.toContain(messages.saved.unknownTitle);

    await act(async () => {
      tabs[2]?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.learnerApiFetch).toHaveBeenCalledWith("/api/content/grammar/grammar-1");
    expect(container.textContent).toContain("〜ために");
    expect(container.textContent).not.toContain(messages.saved.unknownTitle);

    await act(async () => root.unmount());
    container.remove();
  });
});
