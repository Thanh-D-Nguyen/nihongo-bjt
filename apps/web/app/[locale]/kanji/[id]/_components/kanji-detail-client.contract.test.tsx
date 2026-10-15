// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock("../../../../../lib/learner-api", () => ({
  learnerApiFetchOptional: (...args: unknown[]) => fetchMock(...args)
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) =>
    createElement("a", { href }, children)
}));
vi.mock("../../../_components/content-actions", () => ({
  ContentActions: () => createElement("div")
}));

import { KanjiDetailClient } from "./kanji-detail-client";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const labels = {
  back: "Back",
  components: "Components",
  error: "Could not load kanji",
  examples: "Examples",
  frequency: "Frequency",
  kunyomi: "Kunyomi",
  loading: "Loading",
  notFound: "Not found",
  onyomi: "Onyomi",
  strokeCount: "Stroke count",
  title: "Kanji"
};

let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  fetchMock.mockReset();
});

describe("KanjiDetailClient API contract", () => {
  it("renders Go's canonical detail without an absent components field", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "kanji-1",
          character: "会",
          meaningVi: "HỘI, CỐI",
          onyomi: "カイ エ",
          kunyomi: "あ.う",
          strokeCount: 6,
          level: 4,
          frequency: 4,
          examples: [
            {
              id: "example-1",
              word: "町内",
              reading: "ちょうない",
              meaningVi: "trong khu phố",
              hanViet: "đinh nội"
            }
          ],
          components: [{ id: "component-1", character: "冘", hanViet: "DU", position: 1 }]
        }),
        { status: 200 }
      )
    );
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        createElement(KanjiDetailClient, {
          actionLabels: {} as never,
          id: "kanji-1",
          labels,
          locale: "vi"
        })
      );
    });

    expect(host.textContent).toContain("会");
    expect(host.textContent).toContain("HỘI, CỐI");
    expect(host.textContent).toContain("カイ エ");
    expect(host.textContent).toContain("町内");
    expect(host.textContent).toContain("trong khu phố");
    expect(host.textContent).toContain("冘");
    expect(host.textContent).not.toContain(labels.error);
  });
});
