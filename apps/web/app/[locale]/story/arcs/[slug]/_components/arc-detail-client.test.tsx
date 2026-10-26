// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({ storyArcDetail: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...props }, children)
}));
vi.mock("../../../../../../src/features/career-rpg/api", () => ({ storyArcDetail: mocks.storyArcDetail }));
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

async function render(a: MissionArc) {
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

describe("ArcDetailClient", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetAllMocks();
  });

  it("links every chapter when the server does not track progress", async () => {
    const container = await render(arc({ progressTracked: false }));

    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/vi/story/chapters/c1", "/vi/story/chapters/c2", "/vi/story/chapters/c3"]));
    expect(container.textContent).not.toContain(messages.careerRpg.arcDetail.chapterLocked);
  });

  it("keeps locking later chapters when progress is tracked", async () => {
    const container = await render(arc({ progressTracked: true, completedChapters: 1 }));

    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/vi/story/chapters/c2");
    expect(hrefs).not.toContain("/vi/story/chapters/c1");
    expect(hrefs).not.toContain("/vi/story/chapters/c3");
  });
});
