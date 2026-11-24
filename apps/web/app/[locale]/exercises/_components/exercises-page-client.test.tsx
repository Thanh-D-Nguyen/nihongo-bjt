// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExercisesPageClient, type ExercisesLabels } from "./exercises-page-client";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../../../../lib/learner-api", () => ({ learnerApiFetch: api }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const labels = new Proxy({}, { get: (_, key) => String(key) }) as ExercisesLabels;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
afterEach(() => { act(() => root?.unmount()); host?.remove(); vi.clearAllMocks(); });

describe("Exercises shared recommendations", () => {
  it("shows lesson recommendations from the shared feed as lesson links", async () => {
    api.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes("study-feed") ? { items: [{ id: "lesson-1", type: "lesson", title: "Business greetings", metadata: { slug: "greetings", levelCode: "J5" } }] } : [] }));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(<ExercisesPageClient labels={labels} locale="vi" />));
    expect(api).toHaveBeenCalledWith("/api/recommendation/study-feed?limit=8");
    expect(host.textContent).toContain("Business greetings");
    expect(host.querySelector('a[href="/vi/levels/J5/lessons/greetings"]')).not.toBeNull();
  });

  it("refreshes recommendations after persisted completion", async () => {
    let feedRequests = 0;
    api.mockImplementation(async (url: string) => ({ ok: true, json: async () => {
      if (url.includes("study-feed")) {
        feedRequests++;
        return { items: [{ id: "lesson", type: "lesson", title: `Lesson ${feedRequests}`, metadata: { slug: "next", levelCode: "J5" } }] };
      }
      if (url.endsWith("/generate")) return [{ id: "exercise", exerciseType: "meaning_match", prompt: { text: "仕事" }, choices: [{ key: "A", text: "work" }] }];
      if (url.endsWith("/answer")) return { isCorrect: true, correctAnswer: { key: "A" } };
      if (url.endsWith("/sessions") || url.endsWith("/complete")) return { id: "session", totalQuestions: 1, correctCount: 1, score: 10 };
      return [];
    } }));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(<ExercisesPageClient labels={labels} locale="vi" />));
    const click = async (label: string) => {
      const button = [...host.querySelectorAll("button")].find(item => item.textContent?.includes(label));
      expect(button).toBeDefined();
      await act(async () => button?.click());
    };
    await click("generate");
    await act(async () => host.querySelector<HTMLButtonElement>(".exercise-answer-btn")?.click());
    await click("submitAnswer");
    await click("completeSession");
    expect(feedRequests).toBe(2);
    await click("generate");
    expect(host.textContent).toContain("Lesson 2");
  });

  it("renders PracticeModeTabs at the top of /exercises with Bài tập kỹ năng nhanh active, link to /quiz, and quiet /battle link", async () => {
    api.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url.includes("study-feed") ? { items: [] } : [])
    }));
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<ExercisesPageClient labels={labels} locale="vi" />));

    const quizTab = host.querySelector<HTMLAnchorElement>('a[href="/vi/quiz"]');
    const exercisesTab = host.querySelector<HTMLAnchorElement>('a[href="/vi/exercises"]');
    const battleLink = host.querySelector<HTMLAnchorElement>('a[href="/vi/battle"]');

    expect(quizTab, "/exercises must render PracticeModeTabs with link to /vi/quiz").not.toBeNull();
    expect(exercisesTab, "/exercises must render active PracticeModeTabs item").not.toBeNull();
    expect(exercisesTab?.getAttribute("aria-current")).toBe("page");
    expect(quizTab?.getAttribute("aria-current")).toBeNull();
    expect(quizTab?.textContent).toContain("Thi thử & Đề BJT");
    expect(exercisesTab?.textContent).toContain("Bài tập kỹ năng nhanh");
    expect(battleLink?.textContent).toContain("Đấu phản xạ cùng Bot →");
  });
});
