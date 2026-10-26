// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  storyChapter: vi.fn(),
  startChapterAttempt: vi.fn(),
  completeCurrentChapterAttempt: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...props }, children)
}));
vi.mock("../../../../../../src/features/career-rpg/api", () => ({
  storyChapter: mocks.storyChapter,
  startChapterAttempt: mocks.startChapterAttempt,
  completeCurrentChapterAttempt: mocks.completeCurrentChapterAttempt
}));

import messages from "../../../../../../messages/vi.json";
import type { MissionChapter, RiskOutcomePreview } from "../../../../../../src/features/career-rpg/types";

import { ChapterPlayerClient } from "./chapter-player-client";

const outcome = (correct: boolean): RiskOutcomePreview => ({
  trustDelta: correct ? 8 : -3, clarityScore: 80, politenessScore: 80, businessRiskDelta: 0, satisfactionDelta: 0,
  nextActionCorrect: correct, npcReactionTag: correct ? "smile" : "silence", consequenceJa: "結果", consequenceVi: "Kết quả",
  affectedNpcSlug: "tanaka_senpai", errorType: null
});

const chapter: MissionChapter = {
  id: "ch1", arcSlug: "arc.business-manner-basics", slug: "greeting", displayOrder: 1, titleJa: "挨拶", titleVi: "Chào hỏi",
  briefingJa: "朝です", briefingVi: "Buổi sáng", yourRoleVi: "Nhân viên mới", isBoss: false, estimatedMinutes: 4,
  scenarios: [{
    id: "sc1", scenarioType: "chat", titleJa: "朝の挨拶", titleVi: "Chào buổi sáng", contextSummaryVi: "9:00",
    characters: [{ npcSlug: "tanaka_senpai", roleInScene: "observer" }],
    payload: { chatLog: [{ speaker: "あなた", lineJa: "（朝）", timestamp: "2026-04-01T09:00:00Z" }] },
    goalJa: "選ぶ", goalVi: "Chọn",
    question: {
      id: "q1", promptJa: "どれ？", promptVi: "Câu nào?", skillTag: "keigo", difficulty: "easy",
      options: [
        { optionKey: "A", textJa: "正しい挨拶", isCorrect: true, outcome: outcome(true) },
        { optionKey: "B", textJa: "誤った挨拶", isCorrect: false, outcome: outcome(false) }
      ]
    }
  }]
};

const completion = {
  career: { state: {}, npcRelations: [], npcs: [] },
  rankUp: null,
  result: { chapterId: "ch1", rankXpDelta: 2, skillDeltas: {}, npcTrustDeltas: [], contextMemoIds: [], npcReactionMontage: [], completedAt: "2026-10-26T12:00:00Z" }
};

async function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ChapterPlayerClient chapterId="ch1" labels={messages.careerRpg} locale="vi" />);
  });
  await act(async () => {});
  return container;
}

const clickButton = async (container: HTMLElement, text: string) => {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
  if (!button) throw new Error(`button not found: ${text}`);
  await act(async () => {
    button.click();
  });
};

describe("ChapterPlayerClient", () => {
  beforeEach(() => {
    mocks.startChapterAttempt.mockResolvedValue({ id: "attempt-1" });
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetAllMocks();
  });

  it("sends the chosen option when the chapter is finished", async () => {
    mocks.storyChapter.mockResolvedValue({ chapter, npcs: [], rewardsPayload: {} });
    mocks.completeCurrentChapterAttempt.mockResolvedValue(completion);
    const container = await render();

    await clickButton(container, messages.careerRpg.chapter.startCta);
    await clickButton(container, "誤った挨拶");
    await clickButton(container, messages.careerRpg.chapter.submitAnswer);
    await clickButton(container, messages.careerRpg.chapter.finishChapter);

    expect(mocks.startChapterAttempt).toHaveBeenCalledWith("ch1");
    expect(mocks.completeCurrentChapterAttempt).toHaveBeenCalledWith("ch1", "B");
  });

  it("sends a learner without a session to the login page instead of 'Chapter not found'", async () => {
    mocks.storyChapter.mockRejectedValue(new Error("Career RPG API failed: 401"));

    await render();

    expect(mocks.router.replace).toHaveBeenCalledWith(`/vi/login?returnTo=${encodeURIComponent("/vi/story/chapters/ch1")}`);
  });

  it("redirects to login when completing the chapter reports an expired session", async () => {
    mocks.storyChapter.mockResolvedValue({ chapter, npcs: [], rewardsPayload: {} });
    mocks.completeCurrentChapterAttempt.mockRejectedValue(new Error("Career RPG API failed: 401"));
    const container = await render();

    await clickButton(container, messages.careerRpg.chapter.startCta);
    await clickButton(container, "正しい挨拶");
    await clickButton(container, messages.careerRpg.chapter.submitAnswer);
    await clickButton(container, messages.careerRpg.chapter.finishChapter);

    expect(mocks.router.replace).toHaveBeenCalledWith(`/vi/login?returnTo=${encodeURIComponent("/vi/story/chapters/ch1")}`);
  });
});
