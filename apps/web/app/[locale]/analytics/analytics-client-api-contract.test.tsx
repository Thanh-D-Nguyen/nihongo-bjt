// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const learnerApiFetchMock = vi.fn();
vi.mock("../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: "11111111-1111-4111-8111-111111111111" })
}));
vi.mock("../../../lib/learner-api", () => ({
  learnerApiFetch: (...args: unknown[]) => learnerApiFetchMock(...args)
}));

import viMessages from "../../../messages/vi.json";
import { LearnerAnalyticsClient } from "./analytics-client";

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) {
    await act(async () => root.unmount());
    container.remove();
  }
  learnerApiFetchMock.mockReset();
});

async function renderAnalytics() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => {
    root.render(<LearnerAnalyticsClient labels={viMessages.analytics} locale="vi" />);
    await Promise.resolve();
  });
  return container;
}

describe("LearnerAnalyticsClient API contract", () => {
  it("renders Go dailyStats and a complete selected-period calendar", async () => {
    learnerApiFetchMock.mockResolvedValue(response({
      dailyStats: [{ date: new Date().toISOString().slice(0, 10), minutes: 37, xpEarned: 12, lessonsCount: 2 }],
      insight: "",
      totals: { bjtAccuracyPct: 0, completedBjtSessions: 0, reviewCount: 0, streakDays: 0 },
      userId: "11111111-1111-4111-8111-111111111111"
    }));
    const container = await renderAnalytics();

    expect(container.textContent).toContain("37");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("Phút");
    expect(container.textContent).toContain("XP");
    const today = new Date().toISOString().slice(0, 10);
    const todayRow = Array.from(container.querySelectorAll<HTMLTableRowElement>("details tbody tr"))
      .find((row) => row.cells[0].textContent === today);
    expect(todayRow && Array.from(todayRow.cells).map((cell) => cell.textContent)).toEqual([
      today, "37", "12", "2"
    ]);
    expect(container.querySelectorAll("details tbody tr")).toHaveLength(7);
    expect(container.querySelectorAll('[role="img"][aria-label*="20"]').length).toBeGreaterThanOrEqual(7);
    expect(container.querySelector('[aria-label*="Phút học"]')).toBeTruthy();
    expect(container.textContent).not.toContain(viMessages.analytics.emptyDescription);
    expect(container.textContent).not.toContain(viMessages.analytics.activityEmpty);
    expect(container.textContent).not.toContain(viMessages.analytics.weakSkillsEmpty);
    expect(container.textContent).not.toContain(viMessages.analytics.learningPathsEmpty);
    expect(container.textContent).not.toContain(viMessages.analytics.insight);
  });

  it("keeps valid rolling-window activity from the extra calendar day", async () => {
    const boundaryDate = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    learnerApiFetchMock.mockResolvedValue(response({
      dailyStats: [{ date: boundaryDate, minutes: 13, xpEarned: 2, lessonsCount: 1 }],
      totals: { bjtAccuracyPct: 0, completedBjtSessions: 0, reviewCount: 0, streakDays: 0 }
    }));
    const container = await renderAnalytics();

    expect(container.textContent).toContain("13");
    expect(Array.from(container.querySelectorAll<HTMLTableRowElement>("details tbody tr")).map((row) => row.cells[0].textContent))
      .toContain(boundaryDate);
    expect(container.textContent).not.toContain(viMessages.analytics.emptyDescription);
  });

  it("does not treat all-time totals as selected-period activity", async () => {
    learnerApiFetchMock.mockResolvedValue(response({
      dailyStats: [],
      totals: { bjtAccuracyPct: 88, completedBjtSessions: 4, reviewCount: 99, streakDays: 10 }
    }));
    const container = await renderAnalytics();

    expect(container.textContent?.includes(viMessages.analytics.emptyDescription), "selected-period empty-state mismatch")
      .toBe(true);
    expect(container.textContent).not.toContain(viMessages.analytics.metricsTitle);
    expect(container.textContent).not.toContain(viMessages.analytics.weakSkillsEmpty);
    expect(container.textContent).not.toContain(viMessages.analytics.learningPathsEmpty);
  });

  it("loads each selected period and refreshes through the UI handler", async () => {
    learnerApiFetchMock.mockImplementation(async () => response({ dailyStats: [], totals: {} }));
    const container = await renderAnalytics();
    for (const days of [30, 90]) {
      const button = Array.from(container.querySelectorAll<HTMLButtonElement>("fieldset button"))
        .find((item) => item.textContent?.includes(String(days)));
      await act(async () => {
        button?.click();
        await Promise.resolve();
      });
      expect(learnerApiFetchMock.mock.calls.at(-1)?.[0]).toContain(`days=${days}`);
      expect(container.textContent).toContain(`${days} ngày gần đây`);
      expect(container.textContent).toContain(`Chưa có đủ dữ liệu ${days} ngày`);
    }
    const refresh = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === viMessages.analytics.refresh);
    await act(async () => {
      refresh?.click();
      await Promise.resolve();
    });
    expect(learnerApiFetchMock.mock.calls.at(-1)?.[0]).toContain("days=90");
  });
});
