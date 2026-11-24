// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import viMessages from "../../../../messages/vi.json";

const { act } = React;

const learnerApiFetchOptionalMock = vi.fn();
const authState: { isLoading: boolean; userId: string | null } = {
  isLoading: false,
  userId: null
};
const decisionToken = "signed-decision-token-".padEnd(64, "x");

vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => authState
}));

vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetchOptional: (...args: unknown[]) => learnerApiFetchOptionalMock(...args),
  learnerApiFetch: (...args: unknown[]) => learnerApiFetchOptionalMock(...args)
}));

vi.mock("../../../_hooks/use-push-subscription", () => ({
  usePushSubscription: () => ({
    isSubscribed: true,
    isSupported: false,
    loading: false,
    subscribe: vi.fn()
  })
}));

import { HomepageClient } from "./homepage-client";

function makeArticles(count: number) {
  return Array.from({ length: count }, (_, idx) => ({
    canGenerateCards: true,
    difficulty: "N4",
    hasBody: true,
    id: `nhk-${idx + 1}`,
    imageUrl: null,
    publishedAt: "2026-07-19T08:00:00.000Z",
    title: `ニュース記事 ${idx + 1}`,
    url: `https://example.com/nhk-${idx + 1}`
  }));
}

describe("HomepageClient focus layout", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn()
      })
    });
    authState.isLoading = false;
    authState.userId = "user-123";
    learnerApiFetchOptionalMock.mockReset();
    learnerApiFetchOptionalMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/daily/home")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              dueReviews: 5,
              greeting: { japanese: "おはようございます", reading: null },
              today: "2026-07-19"
            }),
            { status: 200 }
          )
        );
      }
      if (path.startsWith("/api/analytics/learner")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              insight: "",
              totals: {
                bjtAccuracyPct: 80,
                completedBjtSessions: 2,
                completedSessions: 2,
                reviewCount: 10,
                streakDays: 4
              }
            }),
            { status: 200 }
          )
        );
      }
      if (path.startsWith("/api/recommendation/onboarding/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ completed: true }), { status: 200 })
        );
      }
      if (path.startsWith("/api/nhk-news")) {
        return Promise.resolve(
          new Response(JSON.stringify(makeArticles(5)), { status: 200 })
        );
      }
      if (path === "/api/ads/decision") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              campaignId: "58bfc8a5-5e52-4ca2-9b8f-fb143601cfb7",
              decisionKey: "local:default",
              decisionToken,
              eligible: true,
              payload: {
                campaign: {
                  creativeType: "storefront",
                  destinationUrl: "https://example.com/store",
                  id: "58bfc8a5-5e52-4ca2-9b8f-fb143601cfb7",
                  name: "Partner Storefront Marker"
                }
              }
            }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ cards: [], categories: [], isSet: false, items: [] }),
          { status: 200 }
        )
      );
    });
  });

  it("unmounts HomepageSectionsTabs, caps NHK Easy reading strip at 3 articles, and places AdSlot below the reading strip", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HomepageClient
          adLabels={viMessages.adSurface}
          labels={viMessages.homepage}
          locale="vi"
          pushBannerLabels={viMessages.pushBanner}
        />
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      container.querySelector('[aria-label="Homepage tabs"]'),
      "HomepageClient must not mount HomepageSectionsTabs"
    ).toBeNull();

    const articleLinks = [...container.querySelectorAll('a[href^="/vi/news/"]')];
    expect(articleLinks.length, "reading strip must render at most 3 NHK Easy cards").toBe(3);
    expect(
      container.querySelector('a[href="/vi/news"]'),
      "reading strip must link to /vi/news"
    ).toBeTruthy();

    const html = container.innerHTML;
    const newsIdx = html.indexOf('href="/vi/news"');
    const adIdx = html.indexOf("Partner Storefront Marker");
    expect(newsIdx).toBeGreaterThan(-1);
    expect(adIdx).toBeGreaterThan(-1);
    expect(newsIdx, "reading strip must appear above AdSlot").toBeLessThan(adIdx);

    await act(async () => root.unmount());
    container.remove();
  });

  it("passes guest state to TodayPlanHub when signed out without rendering zero-stat dashboard", async () => {
    authState.userId = null;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HomepageClient
          adLabels={viMessages.adSurface}
          labels={viMessages.homepage}
          locale="vi"
          pushBannerLabels={viMessages.pushBanner}
        />
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      container.innerHTML,
      "signed-out homepage must render guest register link"
    ).toContain('href="/vi/register"');
    expect(container.textContent).not.toContain(viMessages.homepage.todayPlan.statStreak);

    await act(async () => root.unmount());
    container.remove();
  });
});
