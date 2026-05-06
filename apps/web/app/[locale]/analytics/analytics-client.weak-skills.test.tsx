// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { act } = React;

const learnerApiFetchMock = vi.fn();
const authState: { userId: string | null } = { userId: "11111111-1111-4111-8111-111111111111" };

vi.mock("../../../components/auth/keycloak-auth-provider", () => ({
  useKeycloakAuth: () => authState
}));

vi.mock("../../../lib/learner-api", () => ({
  learnerApiFetch: (...args: unknown[]) => learnerApiFetchMock(...args)
}));

import viMessages from "../../../messages/vi.json";
import { LearnerAnalyticsClient } from "./analytics-client";

function jsonResponse(body: unknown, ok = true) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: ok ? 200 : 500
  });
}

describe("LearnerAnalyticsClient weak skills", () => {
  beforeEach(() => {
    learnerApiFetchMock.mockReset();
  });

  it("renders weak skill chips with remediation links", async () => {
    learnerApiFetchMock.mockResolvedValue(
      jsonResponse({
        dailyActivity: [
          {
            date: "2026-04-28",
            quizAnswers: 2,
            quizSessionsCompleted: 1,
            reviews: 5
          }
        ],
        dueFlashcards: 3,
        insight: "Ôn đều mỗi ngày",
        learningPaths: [],
        range: { days: 7, end: "2026-05-02T00:00:00.000Z", start: "2026-04-25T00:00:00.000Z" },
        totals: {
          bjtAccuracyPct: 65,
          completedBjtSessions: 2,
          reviewCount: 12,
          streakDays: 3
        },
        weakSkills: [
          {
            attempts: 4,
            failureRate: 75,
            incorrect: 3,
            skillTag: "listening.detail"
          }
        ]
      })
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LearnerAnalyticsClient labels={viMessages.analytics} locale="vi" />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain(viMessages.analytics.weakSkillsTitle);
    expect(container.textContent).toContain("listening.detail (75%)");

    const links = Array.from(container.querySelectorAll("a"));
    const weakSkillLink = links.find((link) =>
      (link.getAttribute("href") ?? "").includes("/vi/flashcards?source=analytics&skill=listening.detail")
    );
    expect(weakSkillLink).toBeTruthy();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
