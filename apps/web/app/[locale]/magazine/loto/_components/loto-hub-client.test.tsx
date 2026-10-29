// @vitest-environment jsdom

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { act } = React;

const fetchMock = vi.fn();

vi.mock("../../../../../components/auth/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock("../../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ accessToken: "test-access-token", isAuthenticated: true })
}));

vi.mock("./loto-game-toggle", () => ({
  LotoGameToggle: () => <div data-testid="game-toggle" />
}));

vi.mock("./loto-hero-prediction", () => ({
  LotoHeroPrediction: ({ data }: { data: { sets?: unknown[] } }) =>
    data.sets ? (
      <div data-testid="hero-prediction" />
    ) : (
      <div data-testid="hero-invalid-prediction" />
    )
}));

vi.mock("./loto-history-card", () => ({
  LotoHistoryCard: ({ item }: { item: { id: string } }) => (
    <div data-testid="history-card">{item.id}</div>
  )
}));

import { LotoHubClient } from "./loto-hub-client";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

class ImmediateIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  disconnect() {}

  observe(target: Element) {
    queueMicrotask(() => {
      this.callback(
        [
          {
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRatio: 1,
            intersectionRect: target.getBoundingClientRect(),
            isIntersecting: true,
            rootBounds: null,
            target,
            time: 0
          }
        ],
        this as unknown as IntersectionObserver
      );
    });
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve() {}
}

let host: HTMLDivElement;
let root: Root;

async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("IntersectionObserver", ImmediateIntersectionObserver);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("LotoHubClient pagination", () => {
  it("unwraps an absent next draw instead of passing the response envelope to the hero", async () => {
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/next-draw")) {
        return Promise.resolve(new Response(JSON.stringify({ nextDraw: null }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 }));
    });

    await act(async () => {
      root.render(<LotoHubClient labels={{ empty: "Chưa có tổ hợp tham khảo." }} locale="vi" />);
    });
    await flushEffects();

    expect(host.querySelector("[data-testid=hero-prediction]")).toBeNull();
    expect(host.querySelector("[data-testid=hero-invalid-prediction]")).toBeNull();
    expect(host.textContent).toContain("Chưa có tổ hợp tham khảo.");
  });

  it("stops automatic loading after a pagination error and keeps one stable retry state", async () => {
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/next-draw")) {
        return Promise.resolve(new Response(JSON.stringify({ nextDraw: null }), { status: 200 }));
      }
      if (url.includes("page=1")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: Array.from({ length: 10 }, (_, index) => ({ id: `draw-${index + 1}` })),
              total: 11
            }),
            { headers: { "content-type": "application/json" }, status: 200 }
          )
        );
      }
      return Promise.resolve(new Response("Temporarily unavailable", { status: 503 }));
    });

    await act(async () => {
      root.render(
        <LotoHubClient
          labels={{ error: "Tạm chưa tải được dữ liệu Loto.", retry: "Thử lại" }}
          locale="vi"
        />
      );
    });

    await flushEffects();
    await flushEffects();
    await flushEffects();

    const feedRequests = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("/feed"));
    expect(feedRequests.filter((url) => url.includes("page=2"))).toHaveLength(1);
    expect(host.textContent).toContain("Tạm chưa tải được dữ liệu Loto.");
    expect(
      [...host.querySelectorAll("button")].filter((button) => button.textContent === "Thử lại")
    ).toHaveLength(1);

    await flushEffects();
    await flushEffects();

    const feedRequestsAfterSettling = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("/feed") && url.includes("page=2"));
    expect(feedRequestsAfterSettling).toHaveLength(1);
  });
});

describe("LotoHubClient statistics lab", () => {
  it("opens the lab tab and renders frequency heat cells, accuracy versus chance and official results from /stats", async () => {
    const stats = {
      game: "loto6",
      totalDraws: 2149,
      spec: { mainCount: 6, bonusCount: 1, maxNumber: 43, totalCombinations: 6096454 },
      frequency: Array.from({ length: 43 }, (_, index) => ({
        number: index + 1,
        count: 300 + index,
        recent: index % 5,
        gap: index
      })),
      hotNumbers: [43, 42, 41, 40, 39, 38],
      coldNumbers: [1, 2, 3, 4, 5, 6],
      overdueNumbers: [20, 21, 22, 23, 24, 25],
      recentDraws: [
        {
          drawNumber: 2149,
          drawDate: "2026-10-26",
          mainNumbers: [2, 11, 15, 19, 24, 36],
          bonusNumbers: [27]
        }
      ],
      accuracy: {
        samples: 24,
        avgHits: 0.83,
        baselineHits: 0.8372,
        bestHits: 3,
        distribution: [10, 9, 4, 1, 0, 0, 0],
        expectedDistribution: [0.4, 0.4, 0.15, 0.04, 0.01, 0, 0]
      }
    };
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/next-draw")) {
        return Promise.resolve(new Response(JSON.stringify({ nextDraw: null }), { status: 200 }));
      }
      if (url.includes("/stats")) {
        return Promise.resolve(new Response(JSON.stringify(stats), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 }));
    });

    await act(async () => {
      root.render(
        <LotoHubClient
          labels={{
            tabPredictions: "Dự đoán",
            tabLab: "Phòng thí nghiệm",
            accuracyTitle: "Đối chiếu với ngẫu nhiên",
            resultsTitle: "Kết quả chính thức gần đây"
          }}
          locale="vi"
        />
      );
    });
    await flushEffects();

    const tab = [...host.querySelectorAll("[role=tab]")].find((node) =>
      node.textContent?.includes("Phòng thí nghiệm")
    );
    expect(tab).toBeTruthy();
    await act(async () => {
      (tab as HTMLElement).click();
    });
    await flushEffects();
    await flushEffects();

    expect(host.querySelectorAll("[data-testid=frequency-cell]")).toHaveLength(43);
    expect(host.textContent).toContain("Đối chiếu với ngẫu nhiên");
    expect(host.textContent).toContain("Kết quả chính thức gần đây");
    expect(host.textContent).toContain("2149");
  });
});
