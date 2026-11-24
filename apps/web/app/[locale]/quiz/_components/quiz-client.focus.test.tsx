// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, replaceMock, routerMock } = vi.hoisted(() => {
  const replaceMock = vi.fn();
  return {
    apiFetchMock: vi.fn(),
    replaceMock,
    routerMock: { replace: replaceMock }
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock
}));

vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: "11111111-1111-4111-8111-111111111111" })
}));

vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetch: (...args: unknown[]) => apiFetchMock(...args)
}));

vi.mock("../../../../components/reading-assist/annotated-japanese-text", () => ({
  AnnotatedJapaneseText: ({ text }: { text: string }) => <span>{text}</span>
}));

import viMessages from "../../../../messages/vi.json";
import { QuizClient } from "./quiz-client";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const FOCUS_STORAGE_KEY = "kiokoto:study-focus-mode:v1";

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

beforeEach(() => {
  window.localStorage.removeItem(FOCUS_STORAGE_KEY);
  apiFetchMock.mockReset();
  replaceMock.mockReset();
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

describe("QuizClient study focus mode toggle (WEB-447)", () => {
  it("defaults OFF, hides non-essential quiz session ambient chrome when ON, and persists to localStorage", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/quiz/templates")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (path.startsWith("/api/quiz/official-simulation/status")) {
        return new Response(
          JSON.stringify({
            availableTemplates: 0,
            enabled: false,
            entitlementKey: "official_sim",
            entitled: false,
            featureFlag: "official_sim",
            planSlug: "free"
          }),
          { status: 200 }
        );
      }
      if (path.startsWith("/api/quiz/session/history")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (path.startsWith("/api/quiz/session/active")) {
        return new Response(
          JSON.stringify({
            session: {
              id: "session-focus-1",
              remainingSeconds: 300,
              timeLimitSeconds: 600,
              totalQuestions: 5,
              currentQuestionNo: 0,
              correctCount: 0,
              status: "in_progress",
              startedAt: "2026-11-25T00:00:00.000Z"
            }
          }),
          { status: 200 }
        );
      }
      if (path.startsWith("/api/quiz/session/session-focus-1/question")) {
        return new Response(
          JSON.stringify({
            question: {
              id: "q-focus-1",
              prompt: "取引先への返信として最も適切な表現を選んでください。",
              skillTag: "keigo",
              options: [
                { optionKey: "A", text: "承知いたしました。" },
                { optionKey: "B", text: "了解した。" }
              ]
            },
            session: {
              id: "session-focus-1",
              remainingSeconds: 300,
              timeLimitSeconds: 600,
              totalQuestions: 5,
              currentQuestionNo: 0,
              correctCount: 0,
              estimatedBjtBand: null,
              estimatedScore: null,
              status: "in_progress",
              testType: "practice"
            }
          }),
          { status: 200 }
        );
      }
      if (path.startsWith("/api/reading-assist/preferences")) {
        return new Response(JSON.stringify({ displayMode: "off" }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    activeRoot = createRoot(container);

    await act(async () => {
      activeRoot!.render(<QuizClient focusMode labels={viMessages.quiz} locale="vi" />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const toggle = container.querySelector<HTMLButtonElement>('button[role="switch"]');
    expect(toggle, "quiz session header must render a focus toggle switch").not.toBeNull();
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
    expect(toggle?.textContent).toContain("Tập trung");
    expect(
      container.querySelector('[data-study-ambient="status-badge"]'),
      "pulsing session badge must render when focus mode is OFF"
    ).not.toBeNull();
    expect(
      container.querySelector('[data-study-ambient="progress"]'),
      "progress bar must render when focus mode is OFF"
    ).not.toBeNull();
    expect(
      container.querySelector('[data-study-ambient="keyboard-hint"]'),
      "keyboard hint must render when focus mode is OFF"
    ).not.toBeNull();
    expect(
      container.querySelector('[data-study-ambient="confidence"]'),
      "confidence bar must render when focus mode is OFF"
    ).not.toBeNull();

    await act(async () => {
      toggle?.click();
    });

    expect(toggle?.getAttribute("aria-checked")).toBe("true");
    expect(window.localStorage.getItem(FOCUS_STORAGE_KEY)).toBe("true");
    expect(container.querySelector('[data-study-ambient="status-badge"]')).toBeNull();
    expect(container.querySelector('[data-study-ambient="progress"]')).toBeNull();
    expect(container.querySelector('[data-study-ambient="keyboard-hint"]')).toBeNull();
    expect(container.querySelector('[data-study-ambient="confidence"]')).toBeNull();

    // Core quiz prompt, options, and progress counter remain visible
    expect(container.textContent).toContain("取引先への返信として最も適切な表現を選んでください。");
    expect(container.textContent).toContain("承知いたしました。");
    expect(container.textContent).toContain("1 / 5");
  });
});
