// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetchOptional: (...args: unknown[]) => fetchMock(...args)
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) =>
    createElement("a", { href }, children)
}));

import { DictionaryClient } from "./dictionary-client";

const labels = {
  error: "Could not load dictionary",
  level: "Level",
  loadMore: "Load more",
  loading: "Loading",
  noResults: "No results",
  searchPlaceholder: "Search vocabulary",
  senses: "senses",
  title: "Dictionary"
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  vi.useRealTimers();
  fetchMock.mockReset();
});

describe("DictionaryClient API contract", () => {
  it("renders canonical list rows when the optional senses field is absent", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "lexeme-1",
            headword: "会議",
            reading: "かいぎ",
            jlptLevel: "N2",
            shortMeaningVi: "cuộc họp"
          }
        ]),
        { status: 200 }
      )
    );
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(createElement(DictionaryClient, { labels, locale: "vi" }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(host.textContent).toContain("会議");
    expect(host.textContent).toContain("かいぎ");
    expect(host.textContent).toContain("cuộc họp");
    expect(host.textContent).not.toContain(labels.error);
  });
});
