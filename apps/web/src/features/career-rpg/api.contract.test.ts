import { beforeEach, describe, expect, it, vi } from "vitest";

const { learnerApiFetch } = vi.hoisted(() => ({ learnerApiFetch: vi.fn() }));
vi.mock("../../../lib/learner-api", () => ({ learnerApiFetch }));

import { careerMe, careerRanks, updateCareerProfile } from "./api";

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
