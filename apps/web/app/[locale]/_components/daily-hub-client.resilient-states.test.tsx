// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import viMessages from "../../../messages/vi.json";

const learnerApiFetchMock = vi.fn();
const learnerApiFetchOptionalMock = vi.fn();
const authState: { userId: string | null } = { userId: null };

vi.mock("../../../components/auth/keycloak-auth-provider", () => ({
  useKeycloakAuth: () => authState
}));

vi.mock("../../../lib/learner-api", () => ({
  learnerApiFetch: (...args: unknown[]) => learnerApiFetchMock(...args),
  learnerApiFetchOptional: (...args: unknown[]) => learnerApiFetchOptionalMock(...args)
}));

import { DailyHubClient } from "./daily-hub-client";

const { act } = React;

function jsonResponse(body: unknown, ok = true) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: ok ? 200 : 500
  });
}

const dailyHubPayload = {
  dueReviews: 3,
  greeting: { japanese: "こんにちは", reading: "こんにちは" },
  today: "2026-04-29",
  widgets: []
};

const analyticsPayload = {
  insight: "Ôn đều mỗi ngày",
  totals: {
    bjtAccuracyPct: 75,
    completedBjtSessions: 2,
    reviewCount: 14,
    streakDays: 3
  }
};

describe("DailyHubClient resilient state coverage", () => {
  beforeEach(() => {
    learnerApiFetchMock.mockReset();
    learnerApiFetchOptionalMock.mockReset();
    authState.userId = null;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows supportive sign-in empty state for progress when learner is anonymous", async () => {
    learnerApiFetchOptionalMock.mockResolvedValue(jsonResponse(dailyHubPayload));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DailyHubClient
          dailyLabels={viMessages.daily}
          dashboardLabels={viMessages.dashboard}
          locale="vi"
        />
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain(viMessages.dashboard.signInForProgressTitle);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders localized comeback evidence and recent rating labels from persisted API data", async () => {
    authState.userId = "11111111-1111-4111-8111-111111111111";

    learnerApiFetchOptionalMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/daily/home")) {
        return Promise.resolve(jsonResponse(dailyHubPayload));
      }
      if (path.startsWith("/api/analytics/learner")) {
        return Promise.resolve(jsonResponse(analyticsPayload));
      }
      return Promise.resolve(jsonResponse({}));
    });

    learnerApiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/flashcards/reviews/comeback-summary")) {
        return Promise.resolve(
          jsonResponse({
            activeComebackCards: 2,
            dueComebackCards: 1,
            leechedCards: 1,
            range: {
              days: 14,
              since: "2026-04-15T00:00:00.000Z",
              until: "2026-04-29T00:00:00.000Z"
            },
            recentComebackReviews: [
              {
                cardId: "card-1",
                cardPreview: "会議の資料",
                nextDueAt: "2026-04-30T00:00:00.000Z",
                rating: "good",
                reviewedAt: "2026-04-29T00:00:00.000Z",
                sourceType: "lexeme",
                userFlashcardId: "uf-1"
              }
            ]
          })
        );
      }
      if (path.startsWith("/api/flashcards/reviews/due")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DailyHubClient
          dailyLabels={viMessages.daily}
          dashboardLabels={viMessages.dashboard}
          locale="vi"
        />
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(viMessages.dashboard.comebackEvidenceTitle);
    expect(container.textContent).toContain(viMessages.dashboard.comebackRatingGood);
    const comebackLink = container.querySelector('a[href="/vi/flashcards?source=comeback"]');
    expect(comebackLink).not.toBeNull();
    expect(comebackLink?.textContent).toContain(viMessages.dashboard.flashcardCta);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows supportive fallback text when comeback summary endpoint fails", async () => {
    authState.userId = "11111111-1111-4111-8111-111111111111";

    learnerApiFetchOptionalMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/daily/home")) {
        return Promise.resolve(jsonResponse(dailyHubPayload));
      }
      if (path.startsWith("/api/analytics/learner")) {
        return Promise.resolve(jsonResponse(analyticsPayload));
      }
      return Promise.resolve(jsonResponse({}));
    });

    learnerApiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/flashcards/reviews/comeback-summary")) {
        return Promise.resolve(jsonResponse({ code: "failed" }, false));
      }
      if (path.startsWith("/api/flashcards/reviews/due")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DailyHubClient
          dailyLabels={viMessages.daily}
          dashboardLabels={viMessages.dashboard}
          locale="vi"
        />
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(viMessages.dashboard.emptyAnalyticsDescription);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
