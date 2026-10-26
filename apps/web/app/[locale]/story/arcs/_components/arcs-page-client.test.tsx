// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({ storyArcs: vi.fn(), storyProgress: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...props }, children)
}));
vi.mock("../../../../../src/features/career-rpg/api", () => ({ storyArcs: mocks.storyArcs, storyProgress: mocks.storyProgress }));

import messages from "../../../../../messages/vi.json";
import type { MissionArc } from "../../../../../src/features/career-rpg/types";

import { ArcsPageClient } from "./arcs-page-client";

const arc = (slug: string, rankCodeEntry: MissionArc["rankCodeEntry"], displayOrder: number, chapters: number): MissionArc => ({
  slug, titleJa: `${slug}-ja`, titleVi: `${slug}-vi`, rankCodeEntry, synopsisVi: "", npcSlugs: [],
  chapterIds: Array.from({ length: chapters }, (_, i) => `${slug}-c${i + 1}`), status: "active", totalChapters: chapters,
  completedChapters: 0, bossChapterId: null, displayOrder, artAccent: "#94A3B8", progressTracked: false
});

async function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ArcsPageClient labels={messages.careerRpg} locale="vi" />);
  });
  await act(async () => {});
  return container;
}

describe("ArcsPageClient story progress", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetAllMocks();
  });

  it("shows per-arc progress, completes finished arcs and locks arcs above the learner's rank", async () => {
    mocks.storyArcs.mockResolvedValue([arc("one", "R1", 1, 4), arc("two", "R1", 2, 2), arc("high", "R2", 3, 4)]);
    mocks.storyProgress.mockResolvedValue({ currentRankCode: "R1", completedChapterIds: ["x"], arcs: { one: 2, two: 2 } });

    const container = await render();
    const cards = [...container.querySelectorAll("li")];
    const text = (slug: string) => cards.find((li) => li.textContent?.includes(`${slug}-ja`))?.textContent ?? "";

    expect(text("one")).toContain("2 / 4");
    expect(text("one")).toContain(messages.careerRpg.arcs.statusActive);
    expect(text("two")).toContain(messages.careerRpg.arcs.statusCompleted);
    expect(text("high")).toContain(messages.careerRpg.arcs.statusLocked);
    expect(text("high")).toContain(messages.careerRpg.arcs.notUnlocked);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/vi/story/arcs/one");
    expect(hrefs).not.toContain("/vi/story/arcs/high");
  });

  it("shows no progress and no rank locks when the learner is not signed in", async () => {
    mocks.storyArcs.mockResolvedValue([arc("one", "R1", 1, 4), arc("high", "R2", 2, 4)]);
    mocks.storyProgress.mockResolvedValue(null);

    const container = await render();

    expect(container.textContent).not.toContain("0 / 4");
    expect(container.textContent).not.toContain(messages.careerRpg.arcs.notUnlocked);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/vi/story/arcs/one", "/vi/story/arcs/high"]));
  });
});
