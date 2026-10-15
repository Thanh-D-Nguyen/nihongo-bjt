// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const { learnerApiFetchMock } = vi.hoisted(() => ({ learnerApiFetchMock: vi.fn() }));

vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetch: (...args: unknown[]) => learnerApiFetchMock(...args)
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) =>
    createElement("a", { href, ...props }, children)
}));

import viMessages from "../../../../messages/vi.json";
import { ExploreClient } from "./explore-client";

const mounted: Array<{ root: ReturnType<typeof createRoot>; host: HTMLDivElement }> = [];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status
  });
}

afterEach(() => {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
  learnerApiFetchMock.mockReset();
});

async function renderExplore() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  await act(async () => {
    root.render(<ExploreClient labels={viMessages.explore} locale="vi" />);
    await Promise.resolve();
  });
  return host;
}

describe("ExploreClient canonical content summary", () => {
  it("renders complete active totals", async () => {
    learnerApiFetchMock.mockResolvedValue(response({ lexemes: 12345, kanji: 2136, grammar: 724 }));
    const host = await renderExplore();

    expect(learnerApiFetchMock).toHaveBeenCalledExactlyOnceWith("/api/content/summary");
    expect(host.textContent).toContain("12,345");
    expect(host.textContent).toContain("2,136");
    expect(host.textContent).toContain("724");
    expect(host.querySelector('a[href="/vi/search"]')).toBeTruthy();
    expect(host.querySelector('a[href="/vi/dictionary"]')).toBeTruthy();
    expect(host.querySelector('a[href="/vi/kanji"]')).toBeTruthy();
    expect(host.querySelector('a[href="/vi/grammar"]')).toBeTruthy();
  });

  it("shows an unavailable marker instead of false zero totals after an API failure", async () => {
    learnerApiFetchMock.mockResolvedValue(response({ message: "temporarily unavailable" }, 503));
    const host = await renderExplore();

    expect(host.textContent).not.toMatch(/\b0\b/);
    expect(host.textContent, "unavailable totals are visibly marked").toContain("—");
    expect(host.querySelector("[aria-label]")?.getAttribute("aria-label"), "stats unavailable label is concise")
      .toBe(viMessages.explore.statsUnavailable);
  });

  it("wraps the content totals ribbon on narrow layouts", async () => {
    learnerApiFetchMock.mockResolvedValue(response({ lexemes: 12345, kanji: 2136, grammar: 724 }));
    const host = await renderExplore();

    expect(host.querySelector(".explore-stats-ribbon")?.className, "stats ribbon has mobile wrapping enabled")
      .toContain("flex-wrap");
    expect(Array.from(host.querySelector(".explore-stats-ribbon")?.children ?? [])
      .filter((child) => child.classList.contains("hidden") && child.classList.contains("sm:block")))
      .toHaveLength(2);
  });

  it("uses dark card surfaces when light gradients would be low contrast", async () => {
    learnerApiFetchMock.mockResolvedValue(response({ lexemes: 1, kanji: 1, grammar: 1 }));
    const host = await renderExplore();

    const magazine = host.querySelector<HTMLAnchorElement>('a[href="/vi/magazine"]');
    expect(magazine?.className, "pale cards have a readable dark surface variant")
      .toContain("dark:from-orange-950/20");
  });
});
