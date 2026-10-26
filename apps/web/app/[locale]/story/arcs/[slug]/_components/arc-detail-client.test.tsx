// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({ storyArcDetail: vi.fn(), storyProgress: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...props }, children)
}));
vi.mock("../../../../../../src/features/career-rpg/api", () => ({ storyArcDetail: mocks.storyArcDetail, storyProgress: mocks.storyProgress }));
vi.mock("../../../../../../src/features/career-rpg/store", () => ({ useCareerRpg: () => ({ npcRelations: [] }) }));

import messages from "../../../../../../messages/vi.json";
import type { MissionArc, MissionChapter } from "../../../../../../src/features/career-rpg/types";

import { ArcDetailClient } from "./arc-detail-client";

const arc = (extra: Partial<MissionArc>): MissionArc => ({
  slug: "arc.business-manner-basics", titleJa: "ビジネスマナー入門", titleVi: "Nhập môn", rankCodeEntry: "R1",
  synopsisVi: "Học chào hỏi.", npcSlugs: [], chapterIds: ["c1", "c2", "c3"], status: "active", totalChapters: 3,
  completedChapters: 0, bossChapterId: null, displayOrder: 1, artAccent: "#059669", ...extra
});
const chapter = (id: string, displayOrder: number): MissionChapter => ({
  id, arcSlug: "arc.business-manner-basics", slug: id, displayOrder, titleJa: `章${displayOrder}`, titleVi: `Chương ${displayOrder}`,
  briefingJa: "", briefingVi: "", yourRoleVi: "", isBoss: false, scenarios: [], estimatedMinutes: 4
});

async function render(a: MissionArc, progress: unknown = null) {
  mocks.storyProgress.mockResolvedValue(progress);
  mocks.storyArcDetail.mockResolvedValue({ arc: a, chapters: [chapter("c1", 1), chapter("c2", 2), chapter("c3", 3)], npcRelations: [], npcs: [] });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ArcDetailClient labels={messages.careerRpg} locale="vi" slug="arc.business-manner-basics" />);
  });
  await act(async () => {});
  return container;
}

const chapterLinks = (container: HTMLElement) =>
  [...container.querySelectorAll("a")].map((a) => a.getAttribute("href")).filter((href) => href?.includes("/story/chapters/"));

describe("ArcDetailClient", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetAllMocks();
  });

  it("links every chapter when the server does not track progress", async () => {
    const container = await render(arc({ progressTracked: false }));

    expect(chapterLinks(container)).toEqual(["/vi/story/chapters/c1", "/vi/story/chapters/c2", "/vi/story/chapters/c3"]);
    expect(container.textContent).not.toContain(messages.careerRpg.arcDetail.chapterLocked);
  });

  it("merges the learner's progress: completed chapters stay linkable for replay and later ones stay locked", async () => {
    const container = await render(arc({ progressTracked: false }), { currentRankCode: "R1", completedChapterIds: ["c1"], arcs: { "arc.business-manner-basics": 1 } });

    expect(chapterLinks(container)).toEqual(["/vi/story/chapters/c1", "/vi/story/chapters/c2"]);
    expect(container.textContent).toContain(messages.careerRpg.arcDetail.chapterDone);
    expect(container.textContent).toContain(messages.careerRpg.arcDetail.chapterLocked);
  });

  it("locks every chapter of an arc above the learner's rank", async () => {
    const container = await render(arc({ progressTracked: false, rankCodeEntry: "R3" }), { currentRankCode: "R1", completedChapterIds: [], arcs: {} });

    expect(chapterLinks(container)).toEqual([]);
  });
});
