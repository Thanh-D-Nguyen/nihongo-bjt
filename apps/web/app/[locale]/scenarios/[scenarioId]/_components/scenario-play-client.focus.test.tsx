// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, routerMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  routerMock: { push: vi.fn() }
}));

vi.mock("../../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: "11111111-1111-4111-8111-111111111111" })
}));
vi.mock("../../../../../lib/learner-api", () => ({
  learnerApiFetch: (...args: unknown[]) => apiFetchMock(...args)
}));
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock
}));

import viMessages from "../../../../../messages/vi.json";
import { ScenarioPlayClient } from "./scenario-play-client";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const FOCUS_STORAGE_KEY = "kiokoto:study-focus-mode:v1";

const SCENARIO = {
  id: "22222222-2222-4222-8222-222222222222",
  titleVi: "Báo cáo tiến độ cho trưởng phòng",
  titleJa: "部長への進捗報告",
  maxPoints: 10,
  difficulty: "intermediate",
  steps: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      stepOrder: 1,
      situationVi: "Trưởng phòng hỏi tiến độ dự án.",
      situationJa: "部長から進捗を尋ねられました。",
      speakerName: "Tanaka",
      speakerRole: "Department Manager",
      choices: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          choiceKey: "A",
          textVi: "Báo cáo kết luận trước rồi nêu chi tiết.",
          textJa: "結論から簡潔にご報告いたします。"
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          choiceKey: "B",
          textVi: "Kể dài dòng từ đầu.",
          textJa: "最初から長く説明します。"
        }
      ]
    }
  ]
};

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

beforeEach(() => {
  window.localStorage.removeItem(FOCUS_STORAGE_KEY);
  apiFetchMock.mockReset();
});

afterEach(() => {
  if (activeRoot) {
    act(() => activeRoot?.unmount());
    activeRoot = null;
  }
  activeContainer?.remove();
  activeContainer = null;
  window.localStorage.removeItem(FOCUS_STORAGE_KEY);
});

describe("ScenarioPlayClient study focus mode toggle (WEB-447)", () => {
  it("defaults OFF, hides decorative scenario ambient chrome when ON, and persists to localStorage", async () => {
    apiFetchMock.mockResolvedValueOnce(new Response(JSON.stringify(SCENARIO), { status: 200 }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    activeRoot = createRoot(container);

    await act(async () => {
      activeRoot!.render(
        <ScenarioPlayClient locale="vi" scenarioId={SCENARIO.id} copy={viMessages.scenarios.play} />
      );
    });

    const toggle = container.querySelector<HTMLButtonElement>('button[role="switch"]');
    expect(toggle, "scenario session header must render a focus toggle switch").not.toBeNull();
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
    expect(toggle?.textContent).toContain("Tập trung");
    expect(
      container.querySelector('[data-study-ambient="progress"]'),
      "progress bar must be visible when focus mode is OFF"
    ).not.toBeNull();
    expect(
      container.querySelector('[data-study-ambient="speaker-avatar"]'),
      "speaker avatar badge must be visible when focus mode is OFF"
    ).not.toBeNull();

    await act(async () => {
      toggle?.click();
    });

    expect(toggle?.getAttribute("aria-checked")).toBe("true");
    expect(window.localStorage.getItem(FOCUS_STORAGE_KEY)).toBe("true");
    expect(
      container.querySelector('[data-study-ambient="progress"]'),
      "decorative progress bar must hide when focus mode is ON"
    ).toBeNull();
    expect(
      container.querySelector('[data-study-ambient="speaker-avatar"]'),
      "decorative speaker avatar badge must hide when focus mode is ON"
    ).toBeNull();

    // Core study content & keigo hierarchy context remain visible
    expect(container.textContent).toContain("Trưởng phòng hỏi tiến độ dự án.");
    expect(container.textContent).toContain("Tanaka");
    expect(container.textContent).toContain("Department Manager");
    expect(container.textContent).toContain("Báo cáo kết luận trước rồi nêu chi tiết.");
  });
});
