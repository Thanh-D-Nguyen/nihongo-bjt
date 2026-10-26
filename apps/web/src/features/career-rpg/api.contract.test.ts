import { beforeEach, describe, expect, it, vi } from "vitest";

const { learnerApiFetch } = vi.hoisted(() => ({ learnerApiFetch: vi.fn() }));
vi.mock("../../../lib/learner-api", () => ({ learnerApiFetch }));

import { careerMe, careerRanks, storyArcs, updateCareerProfile } from "./api";

describe("careerMe API adapter", () => {
  beforeEach(() => vi.resetAllMocks());

  it("maps the authenticated Go CareerMe contract to a data-only dashboard model", async () => {
    learnerApiFetch.mockResolvedValue(new Response(JSON.stringify({
      userId: "learner-1",
      currentRankCode: "R1",
      rankXp: 0,
      jpWorkName: "Career Audit",
      companyTheme: "",
      hireDate: "2026-10-08",
      streakDays: 0,
      skills: []
    }), { status: 200 }));

    const result = await careerMe();

    expect(learnerApiFetch).toHaveBeenCalledWith("/api/career/me", undefined);

    expect(result).toMatchObject({
      state: {
        userId: "learner-1",
        currentRankCode: "R1",
        rankXp: 0,
        jpWorkName: "Career Audit",
        skills: []
      },
      npcRelations: [],
      npcs: []
    });
  });

  it("loads ranks from the canonical Career endpoint", async () => {
    learnerApiFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    await expect(careerRanks()).resolves.toEqual([]);
    expect(learnerApiFetch).toHaveBeenCalledWith("/api/career/ranks", undefined);
  });

  it("normalizes the flat PATCH response so name onboarding can update parent state", async () => {
    learnerApiFetch.mockResolvedValue(new Response(JSON.stringify({
      userId: "learner-1",
      currentRankCode: "R1",
      rankXp: 0,
      jpWorkName: "佐藤 ゆうき",
      companyTheme: "",
      hireDate: "2026-10-08",
      streakDays: 0,
      skills: []
    }), { status: 200 }));

    const result = await updateCareerProfile({ jpWorkName: "佐藤 ゆうき" });

    expect(learnerApiFetch).toHaveBeenCalledWith("/api/career/me", {
      body: JSON.stringify({ jpWorkName: "佐藤 ゆうき" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
    expect(result.state).toMatchObject({ jpWorkName: "佐藤 ゆうき", currentRankCode: "R1" });
  });
});

describe("storyArcs API adapter", () => {
  beforeEach(() => vi.resetAllMocks());

  it("adapts the Go arcs list (status published, no progress fields) to a renderable MissionArc", async () => {
    learnerApiFetch.mockResolvedValue(new Response(JSON.stringify([{
      id: "c583a4cf-de2c-4e3b-beee-3c18333476dc",
      slug: "arc.business-manner-basics",
      titleJa: "ビジネスマナー入門",
      titleVi: "Nhập môn phép tắc công sở Nhật",
      rankCodeEntry: "R1",
      status: "published",
      displayOrder: 1
    }]), { status: 200 }));

    const [arc] = await storyArcs();

    expect(learnerApiFetch).toHaveBeenCalledWith("/api/story/arcs", undefined);
    expect(arc).toMatchObject({
      slug: "arc.business-manner-basics",
      titleJa: "ビジネスマナー入門",
      titleVi: "Nhập môn phép tắc công sở Nhật",
      rankCodeEntry: "R1",
      displayOrder: 1,
      status: "active",
      totalChapters: 0,
      completedChapters: 0,
      npcSlugs: [],
      chapterIds: [],
      synopsisVi: "",
      bossChapterId: null
    });
    expect(typeof arc?.artAccent).toBe("string");
  });

  it("keeps UI-known statuses and locks anything unrecognized instead of guessing", async () => {
    const base = { slug: "a", titleJa: "a", titleVi: "a", rankCodeEntry: "R1", displayOrder: 1 };
    learnerApiFetch.mockResolvedValue(new Response(JSON.stringify([
      { ...base, slug: "done", status: "completed" },
      { ...base, slug: "weird", status: "archived-by-mars" }
    ]), { status: 200 }));

    const arcs = await storyArcs();

    expect(arcs.map((a) => [a.slug, a.status])).toEqual([["done", "completed"], ["weird", "locked"]]);
  });
});
