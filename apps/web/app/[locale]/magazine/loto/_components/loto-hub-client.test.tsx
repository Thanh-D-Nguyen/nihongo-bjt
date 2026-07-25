// @vitest-environment jsdom

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { act } = React;

const fetchMock = vi.fn();

vi.mock("../../../../../components/auth/require-keycloak-auth", () => ({
  RequireKeycloakAuth: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock("../../../../../components/auth/keycloak-auth-provider", () => ({
  useKeycloakAuth: () => ({ accessToken: "test-access-token" })
}));

vi.mock("./loto-game-toggle", () => ({
  LotoGameToggle: () => <div data-testid="game-toggle" />
}));

vi.mock("./loto-hero-prediction", () => ({
  LotoHeroPrediction: () => <div data-testid="hero-prediction" />
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
  it("stops automatic loading after a pagination error and keeps one stable retry state", async () => {
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/next-draw")) {
        return Promise.resolve(new Response("null", { status: 200 }));
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
