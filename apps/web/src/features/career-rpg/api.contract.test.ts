import { beforeEach, describe, expect, it, vi } from "vitest";

const { learnerApiFetch } = vi.hoisted(() => ({ learnerApiFetch: vi.fn() }));
vi.mock("../../../lib/learner-api", () => ({ learnerApiFetch }));

import {
  careerMe,
  careerRanks,
  completeCurrentChapterAttempt,
  storyArcDetail,
  storyArcs,
  storyProgress,
  updateCareerProfile
} from "./api";

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

describe("storyArcDetail API adapter", () => {
  beforeEach(() => vi.resetAllMocks());

  const goDetail = {
    id: "c583a4cf-de2c-4e3b-beee-3c18333476dc",
    slug: "arc.business-manner-basics",
    titleJa: "ビジネスマナー入門",
    titleVi: "Nhập môn phép tắc công sở Nhật",
    rankCodeEntry: "R1",
    status: "published",
    storyPayload: { synopsisVi: "Học chào hỏi.", npcSlugs: ["tanaka_senpai"], artAccent: "#059669" },
    chapters: [
      { id: "ch-1", slug: "greeting-basics", titleJa: "挨拶", titleVi: "Chào hỏi", displayOrder: 1, isBoss: false, estimatedMinutes: 4 },
      { id: "ch-4", slug: "boss", titleJa: "確認", titleVi: "Boss", displayOrder: 4, isBoss: true, estimatedMinutes: 6 }
    ]
  };

  it("adapts the flat Go arc detail into the page model and marks progress as not tracked", async () => {
    learnerApiFetch.mockResolvedValue(new Response(JSON.stringify(goDetail), { status: 200 }));

    const detail = await storyArcDetail("arc.business-manner-basics");

    expect(learnerApiFetch).toHaveBeenCalledWith("/api/story/arcs/arc.business-manner-basics", undefined);
    expect(detail.arc).toMatchObject({
      slug: "arc.business-manner-basics",
      status: "active",
      synopsisVi: "Học chào hỏi.",
      npcSlugs: ["tanaka_senpai"],
      artAccent: "#059669",
      chapterIds: ["ch-1", "ch-4"],
      totalChapters: 2,
      completedChapters: 0,
      bossChapterId: "ch-4",
      progressTracked: false
    });
    expect(detail.chapters).toHaveLength(2);
    expect(detail.chapters[1]).toMatchObject({
      id: "ch-4", arcSlug: "arc.business-manner-basics", slug: "boss", displayOrder: 4, isBoss: true, estimatedMinutes: 6, scenarios: []
    });
    expect(detail.npcRelations).toEqual([]);
    expect(detail.npcs).toEqual([]);
  });

  it("tolerates a missing storyPayload and chapters without optional fields", async () => {
    learnerApiFetch.mockResolvedValue(new Response(JSON.stringify({
      ...goDetail, storyPayload: null, chapters: [{ id: "ch-1", slug: "a", titleJa: "a", titleVi: "a" }]
    }), { status: 200 }));

    const detail = await storyArcDetail("arc.business-manner-basics");

    expect(detail.arc).toMatchObject({ synopsisVi: "", npcSlugs: [], totalChapters: 1, bossChapterId: null });
    expect(detail.chapters[0]).toMatchObject({ displayOrder: 1, isBoss: false, estimatedMinutes: 0 });
  });
});

describe("storyArcs catalogue fields", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uses synopsisVi, npcSlugs and artAccent from the list when the backend provides them", async () => {
    learnerApiFetch.mockResolvedValue(new Response(JSON.stringify([{
      slug: "a", titleJa: "a", titleVi: "a", rankCodeEntry: "R1", status: "published", displayOrder: 2,
      synopsisVi: "Tóm tắt", npcSlugs: ["x"], artAccent: "#059669"
    }]), { status: 200 }));

    const [arc] = await storyArcs();

    expect(arc).toMatchObject({ synopsisVi: "Tóm tắt", npcSlugs: ["x"], artAccent: "#059669" });
  });
});

describe("story flow API adapters", () => {
  beforeEach(() => vi.resetAllMocks());

  const goCareer = {
    userId: "learner-1", currentRankCode: "R2", rankXp: 64, rankXpToNext: 120, jpWorkName: "", companyTheme: "",
    hireDate: "2026-10-26", streakDays: 0, skills: [{ axisCode: "keigo", value: 4 }]
  };

  it("keeps rankXpToNext from the Go career state and defaults to 0 when absent", async () => {
    learnerApiFetch.mockResolvedValueOnce(new Response(JSON.stringify(goCareer), { status: 200 }));
    expect((await careerMe()).state.rankXpToNext).toBe(120);

    const { rankXpToNext: _omitted, ...legacy } = goCareer;
    learnerApiFetch.mockResolvedValueOnce(new Response(JSON.stringify(legacy), { status: 200 }));
    expect((await careerMe()).state.rankXpToNext).toBe(0);
  });

  it("keeps the ordered chapter ids of the arcs list and counts them as the arc total", async () => {
    learnerApiFetch.mockResolvedValue(new Response(JSON.stringify([{
      slug: "a", titleJa: "a", titleVi: "a", rankCodeEntry: "R1", status: "published", displayOrder: 1, chapterIds: ["c1", "c2", "c3"]
    }]), { status: 200 }));

    const [arc] = await storyArcs();

    expect(arc).toMatchObject({ chapterIds: ["c1", "c2", "c3"], totalChapters: 3, completedChapters: 0, progressTracked: false });
  });

  it("loads the learner's story progress and treats 401 as 'not signed in'", async () => {
    const attempt = async () => {
      try {
        return { value: await storyProgress(), error: undefined as unknown };
      } catch (error) {
        return { value: undefined, error };
      }
    };
    const progress = { currentRankCode: "R1", completedChapterIds: ["c1"], arcs: { a: 1 } };

    learnerApiFetch.mockResolvedValueOnce(new Response(JSON.stringify(progress), { status: 200 }));
    const signedIn = await attempt();
    expect(signedIn.error).toBeUndefined();
    expect(signedIn.value).toEqual(progress);
    expect(learnerApiFetch).toHaveBeenCalledWith("/api/story/progress", undefined);

    learnerApiFetch.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    const signedOut = await attempt();
    expect(signedOut.error).toBeUndefined();
    expect(signedOut.value).toBeNull();

    learnerApiFetch.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const failed = await attempt();
    expect(String(failed.error)).toContain("500");
  });

  it("sends the chosen option and adapts the completion response to the dashboard model", async () => {
    learnerApiFetch.mockResolvedValue(new Response(JSON.stringify({
      career: goCareer,
      result: { chapterId: "c1", rankXpDelta: 12, skillDeltas: { keigo: 4 }, npcTrustDeltas: [], contextMemoIds: ["m1"], npcReactionMontage: [], completedAt: "2026-10-26T12:00:00Z" },
      rankUp: { fromRankCode: "R1", toRankCode: "R2" }
    }), { status: 200 }));

    const done = await completeCurrentChapterAttempt("c1", "B");

    expect(learnerApiFetch).toHaveBeenCalledWith("/api/story/chapters/c1/attempts/current/complete", {
      body: JSON.stringify({ optionKey: "B" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    expect(done.rankUp).toEqual({ fromRankCode: "R1", toRankCode: "R2" });
    expect(done.result).toMatchObject({ chapterId: "c1", rankXpDelta: 12, contextMemoIds: ["m1"] });
    expect(done.career.state).toMatchObject({ currentRankCode: "R2", rankXp: 64, rankXpToNext: 120 });
    expect(done.career.npcRelations).toEqual([]);
  });

  it("completes without an option key when none was chosen", async () => {
    learnerApiFetch.mockResolvedValue(new Response(JSON.stringify({ career: goCareer, result: { chapterId: "c1" }, rankUp: null }), { status: 200 }));

    await completeCurrentChapterAttempt("c1");

    expect(learnerApiFetch).toHaveBeenCalledWith("/api/story/chapters/c1/attempts/current/complete", expect.objectContaining({ body: "{}" }));
  });
});
