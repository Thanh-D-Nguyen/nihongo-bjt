// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import viMessages from "../../../../messages/vi.json";

const { learnerApiFetchMock, routerMock } = vi.hoisted(() => ({
  learnerApiFetchMock: vi.fn(),
  routerMock: { push: vi.fn(), replace: vi.fn() }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock
}));

vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: "learner-1" })
}));

vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetch: (...args: unknown[]) => learnerApiFetchMock(...args)
}));

import { QuizClient, type QuizLabels } from "./quiz-client";

describe("QuizClient PracticeModeTabs integration", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    learnerApiFetchMock.mockReset();
    learnerApiFetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/quiz/official-simulation/status")) {
        return new Response(
          JSON.stringify({
            availableTemplates: 1,
            enabled: true,
            entitled: true,
            entitlementKey: "quiz.official_simulation",
            featureFlag: "quiz.official_simulation.enabled",
            planSlug: "standard"
          }),
          { status: 200 }
        );
      }
      if (url.includes("/api/quiz/session/active")) {
        return new Response(JSON.stringify({ session: null }), { status: 200 });
      }
      if (url.includes("/api/reading-assist/preferences")) {
        return new Response(JSON.stringify({ displayMode: "hover" }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("renders PracticeModeTabs at the top of /quiz with Thi thử & Đề BJT active, link to /exercises, and quiet /battle link", async () => {
    await act(async () => {
      root.render(<QuizClient labels={viMessages.quiz as unknown as QuizLabels} locale="vi" />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const exercisesTab = host.querySelector<HTMLAnchorElement>('a[href="/vi/exercises"]');
    const quizTab = host.querySelector<HTMLAnchorElement>('a[href="/vi/quiz"]');
    const battleLink = host.querySelector<HTMLAnchorElement>('a[href="/vi/battle"]');

    expect(
      exercisesTab,
      "/quiz must render PracticeModeTabs with link to /vi/exercises"
    ).not.toBeNull();
    expect(quizTab, "/quiz must render active PracticeModeTabs item").not.toBeNull();
    expect(quizTab?.getAttribute("aria-current")).toBe("page");
    expect(exercisesTab?.getAttribute("aria-current")).toBeNull();
    expect(quizTab?.textContent).toContain("Thi thử & Đề BJT");
    expect(exercisesTab?.textContent).toContain("Bài tập kỹ năng nhanh");
    expect(battleLink?.textContent).toContain("Đấu phản xạ cùng Bot →");
  });
});
