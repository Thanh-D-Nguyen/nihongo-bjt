// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  careerMe: vi.fn(),
  storyArcs: vi.fn(),
  storyProgress: vi.fn(),
  storyChapter: vi.fn(),
  clockIn: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...props }, children)
}));
vi.mock("../api", () => ({
  careerMe: mocks.careerMe,
  storyArcs: mocks.storyArcs,
  storyProgress: mocks.storyProgress,
  storyChapter: mocks.storyChapter,
  clockIn: mocks.clockIn
}));
vi.mock("../store", () => ({
  useCareerRpg: () => ({
    career: {
      jpWorkName: "田中 太郎",
      currentRankCode: "R3",
      streakDays: 12,
      rankXp: 0,
      rankXpToNext: 0,
      companyTheme: "",
      hireDate: "2026-10-08",
      lastClockInAt: null,
      skills: [],
      userId: "mock-learner"
    },
    reset: vi.fn()
  })
}));

import messages from "../../../../messages/vi.json";
import { DailyStandupPage } from "./daily-standup-page";

describe("DailyStandupPage", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors without rendering fallback career data", async () => {
    mocks.careerMe.mockRejectedValue(new Error("Career RPG API failed: 401"));
    mocks.storyArcs.mockResolvedValue([]);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<DailyStandupPage labels={messages.careerRpg} locale="vi" />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.router.replace, "redirects anonymous visitors to Login").toHaveBeenCalledWith(
      "/vi/login?returnTo=%2Fvi%2Fdaily-standup"
    );
    expect(container.textContent).not.toContain("田中 太郎");

    await act(async () => root.unmount());
    container.remove();
  });

  it("renders the authenticated career profile and clock-in action", async () => {
    mocks.careerMe.mockResolvedValue({
      state: {
        userId: "learner-1",
        jpWorkName: "山田 花子",
        companyTheme: "",
        hireDate: "2026-10-08",
        currentRankCode: "R2",
        rankXp: 20,
        rankXpToNext: 80,
        streakDays: 3,
        lastClockInAt: null,
        skills: []
      },
      npcRelations: [],
      npcs: []
    });
    mocks.storyArcs.mockResolvedValue([{
      slug: "first-arc",
      titleJa: "今日の仕事",
      titleVi: "Công việc hôm nay",
      rankCodeEntry: "R1",
      synopsisVi: "Tình huống công sở.",
      npcSlugs: [],
      chapterIds: ["chapter-1"],
      status: "active",
      totalChapters: 1,
      completedChapters: 0,
      bossChapterId: null,
      displayOrder: 1,
      artAccent: "blue"
    }]);
    mocks.storyChapter.mockResolvedValue({
      chapter: {
        id: "chapter-1",
        arcSlug: "first-arc",
        slug: "chapter-one",
        displayOrder: 1,
        titleJa: "今日の仕事",
        titleVi: "Công việc hôm nay",
        briefingJa: "",
        briefingVi: "",
        yourRoleVi: "",
        isBoss: false,
        scenarios: [],
        estimatedMinutes: 5
      },
      npcs: [],
      rewardsPayload: null
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<DailyStandupPage labels={messages.careerRpg} locale="vi" />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("山田 花子");
    expect(container.textContent).toContain("出勤する");
    expect(container.querySelector('a[href="/vi/story/arcs"]')).not.toBeNull();
    expect(container.textContent.toLowerCase()).not.toContain("visual prototype");
    expect(container.textContent).not.toContain("Reset prototype state");

    mocks.clockIn.mockRejectedValue(new Error("Career RPG API failed: 401"));
    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.router.replace).toHaveBeenCalledWith(
      "/vi/login?returnTo=%2Fvi%2Fdaily-standup"
    );
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("山田 花子");

    await act(async () => root.unmount());
    container.remove();
  });

  it("offers the next unfinished chapter of the first arc that still has chapters left, from the learner's progress", async () => {
    const arcOf = (slug: string, chapterIds: string[]) => ({
      slug, titleJa: `${slug}-ja`, titleVi: `${slug}-vi`, rankCodeEntry: "R1", synopsisVi: "", npcSlugs: [], chapterIds, status: "active",
      totalChapters: chapterIds.length, completedChapters: 0, bossChapterId: null, displayOrder: 1, artAccent: "#94A3B8", progressTracked: false
    });
    mocks.careerMe.mockResolvedValue({
      state: { userId: "learner-1", jpWorkName: "山田 花子", companyTheme: "", hireDate: "2026-10-08", currentRankCode: "R1", rankXp: 20, rankXpToNext: 60, streakDays: 1, lastClockInAt: null, skills: [] },
      npcRelations: [], npcs: []
    });
    mocks.storyArcs.mockResolvedValue([arcOf("first-arc", ["a1", "a2"]), arcOf("second-arc", ["b1", "b2", "b3"])]);
    mocks.storyProgress.mockResolvedValue({ currentRankCode: "R1", completedChapterIds: ["a1", "a2", "b1"], arcs: { "first-arc": 2, "second-arc": 1 } });
    mocks.storyChapter.mockResolvedValue({
      chapter: { id: "b2", arcSlug: "second-arc", slug: "b2", displayOrder: 2, titleJa: "次の仕事", titleVi: "Việc tiếp theo", briefingJa: "", briefingVi: "", yourRoleVi: "", isBoss: false, scenarios: [], estimatedMinutes: 5 },
      npcs: [], rewardsPayload: null
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<DailyStandupPage labels={messages.careerRpg} locale="vi" />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.storyChapter).toHaveBeenCalledWith("b2");
    expect(container.textContent).toContain("second-arc-ja");

    mocks.clockIn.mockResolvedValue({ state: { userId: "learner-1", jpWorkName: "山田 花子", companyTheme: "", hireDate: "2026-10-08", currentRankCode: "R1", rankXp: 20, rankXpToNext: 60, streakDays: 1, lastClockInAt: null, skills: [] } });
    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.router.push).toHaveBeenCalledWith("/vi/story/chapters/b2");

    await act(async () => root.unmount());
    container.remove();
  });
});
