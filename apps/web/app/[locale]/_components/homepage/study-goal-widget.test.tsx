// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, userId } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  userId: { value: "learner-1" as string | null }
}));

vi.mock("../../../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ userId: userId.value }) }));
vi.mock("../../../../lib/learner-api", () => ({ learnerApiFetch: (...args: unknown[]) => apiFetchMock(...args) }));

import { StudyGoalWidget } from "./study-goal-widget";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mounted: Array<{ root: ReturnType<typeof createRoot>; host: HTMLDivElement }> = [];

function response(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, status: 200 });
}

afterEach(async () => {
  for (const { root, host } of mounted.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
  apiFetchMock.mockReset();
  userId.value = "learner-1";
});

describe("StudyGoalWidget API contract", () => {
  it("renders normalized persisted plan fields without inventing completed tasks", async () => {
    apiFetchMock.mockImplementation((path: string) =>
      Promise.resolve(response(path === "/api/gamification/study-goal" ? { targetMinutes: 20, isSet: true } : {
        date: "2026-10-10",
        targetMinutes: 20,
        completed: 1,
        total: 4,
        streakDays: 0,
        tasks: [
          { taskType: "bjt_quiz", label: "BJT Quiz", targetCount: 1, doneCount: 1, isComplete: true },
          { taskType: "srs_review", label: "SRS Review", targetCount: 20, doneCount: 0, isComplete: false },
          { taskType: "daily_phrase", label: "Daily Phrase", targetCount: 1, doneCount: 0, isComplete: false },
          { taskType: "battle_bot", label: "Battle Bot", targetCount: 1, doneCount: 0, isComplete: false }
        ]
      }))
    );
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    mounted.push({ root, host });

    await act(async () => {
      root.render(createElement(StudyGoalWidget, { locale: "vi" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("25%");
    expect(host.textContent).toContain("20 phút · 1/4 nhiệm vụ");
    expect(host.textContent).not.toContain("undefined");
    expect(host.textContent?.match(/✅/gu)).toHaveLength(1);
  });

  it("shows the goal picker when the API reports its default is not persisted", async () => {
    apiFetchMock.mockImplementation((path: string) => Promise.resolve(response(
      path === "/api/gamification/study-goal"
        ? { targetMinutes: 15, isSet: false }
        : { date: "2026-10-10", targetMinutes: 20, completed: 0, total: 4, tasks: [] }
    )));
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    mounted.push({ root, host });

    await act(async () => {
      root.render(createElement(StudyGoalWidget, { locale: "vi" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Đặt mục tiêu hôm nay");
    expect(Array.from(host.querySelectorAll("button"), (button) => button.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("5 phút"), expect.stringContaining("10 phút"), expect.stringContaining("20 phút")])
    );
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});
