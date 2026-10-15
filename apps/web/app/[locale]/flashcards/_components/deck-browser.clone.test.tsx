// @vitest-environment jsdom

import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeckBrowser, type DeckLabels } from "./deck-browser";
import { learnerApiFetch } from "../../../../lib/learner-api";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/vi/flashcards",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("cloneToken=shared-token&tab=public")
}));
vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: "learner-1" })
}));
vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetch: vi.fn()
}));
vi.mock("./deck-grid", () => ({ DeckGrid: () => null }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const labels = new Proxy<Record<string, string>>(
  {},
  { get: (_target, property) => String(property) }
) as unknown as DeckLabels;

let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function renderBrowser() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(
    <StrictMode>
      <DeckBrowser
        createMode={false}
        filter="my"
        labels={labels}
        locale="vi"
        onCreateModeChange={() => undefined}
        searchQuery=""
      />
    </StrictMode>
  );
}

async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function clonePosts() {
  return vi.mocked(learnerApiFetch).mock.calls.filter(([path, init]) =>
    String(path).includes("/api/flashcards/decks/clone/") && init?.method === "POST"
  );
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.clearAllMocks();
});

describe("DeckBrowser shared-deck clone", () => {
  it("submits only once when StrictMode replays the clone effect", async () => {
    vi.mocked(learnerApiFetch).mockImplementation(async (_path, init) => {
      if (init?.method === "POST") {
        return { ok: true, json: async () => ({ id: "new-deck", cardCount: 1 }) } as Response;
      }
      return { ok: true, json: async () => [] } as Response;
    });
    await act(async () => renderBrowser());
    await flushEffects();

    expect(clonePosts()).toHaveLength(1);
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/vi/flashcards?tab=public", { scroll: false });
    expect(
      vi.mocked(learnerApiFetch).mock.calls.filter(([path, init]) =>
        String(path).startsWith("/api/flashcards/decks?") && !init?.method
      )
    ).toHaveLength(3);
    expect(host?.textContent).toContain("Clone thành công");
  });

  it("keeps a failed token retryable after a page reload", async () => {
    let failClone = true;
    vi.mocked(learnerApiFetch).mockImplementation(async (_path, init) => {
      if (init?.method === "POST") {
        return failClone
          ? ({ ok: false, json: async () => ({}) } as Response)
          : ({ ok: true, json: async () => ({ id: "new-deck", cardCount: 1 }) } as Response);
      }
      return { ok: true, json: async () => [] } as Response;
    });

    await act(async () => renderBrowser());
    await flushEffects();
    expect(clonePosts()).toHaveLength(1);
    expect(host?.textContent).toContain("Không thể clone bộ thẻ");
    expect(replace).not.toHaveBeenCalled();

    act(() => {
      root?.unmount();
      root = null;
    });
    failClone = false;
    await act(async () => renderBrowser());
    await flushEffects();

    expect(clonePosts()).toHaveLength(2);
    expect(replace).toHaveBeenCalledWith("/vi/flashcards?tab=public", { scroll: false });
    expect(host?.textContent).toContain("Clone thành công");
  });
});
