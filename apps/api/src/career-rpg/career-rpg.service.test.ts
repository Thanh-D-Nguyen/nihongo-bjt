import { beforeEach, describe, expect, it, vi } from "vitest";

import { CareerRpgService, DEV_CAREER_USER_ID } from "./career-rpg.service.js";

const chapterId = "11111111-1111-4111-8111-111111111111";
const arcId = "22222222-2222-4222-8222-222222222222";

function createPrismaStub() {
  const db = {
    attempts: [] as any[],
    events: [] as any[],
    profiles: [] as any[],
    relations: [] as any[],
    skills: [] as any[],
    states: [] as any[]
  };
  const ranks = [
    {
      bjtBandTarget: "pre-J5",
      displayOrder: 1,
      id: "r1",
      minSkillFloor: 0,
      rankCode: "R1",
      requiredArcCount: 0,
      rewardsPayload: {},
      titleJa: "内定者",
      titleVi: "Nhân viên dự bị",
      unlockedSceneTypes: ["email"],
      xpToNext: 48
    },
    {
      bjtBandTarget: "J5",
      displayOrder: 2,
      id: "r2",
      minSkillFloor: 30,
      rankCode: "R2",
      requiredArcCount: 1,
      rewardsPayload: {},
      titleJa: "新入社員",
      titleVi: "Nhân viên mới",
      unlockedSceneTypes: ["email", "chat"],
      xpToNext: 120
    }
  ];
  const npcs = [
    {
      avatarMedia: { avatarInitial: "山", avatarTint: "#111111" },
      companyJa: "株式会社ミライ商事",
      defaultRelation: "uchi",
      nameJa: "山田部長",
      roleJa: "部長",
      slug: "yamada_bucho",
      status: "active"
    },
    {
      avatarMedia: { avatarInitial: "佐", avatarTint: "#222222" },
      companyJa: "東京テクノロジー株式会社",
      defaultRelation: "soto",
      nameJa: "佐藤様",
      roleJa: "購買担当",
      slug: "sato_kokyaku",
      status: "active"
    }
  ];
  const chapter = {
    arc: { id: arcId, slug: "arc.client-email", status: "published" },
    arcId,
    briefingPayload: { briefingJa: "brief", briefingVi: "brief vi", estimatedMinutes: 6, yourRoleVi: "role" },
    displayOrder: 1,
    id: chapterId,
    isBoss: false,
    rewardsPayload: {
      npcTrustGains: [{ delta: 8, npcSlug: "sato_kokyaku" }],
      rankXp: 24,
      skillGains: { keigo: 8, written: 5 }
    },
    scenarioPayload: { scenarios: [] },
    slug: "follow-up",
    titleJa: "見積もり送付後のフォローアップ",
    titleVi: "Theo dõi"
  };

  const prisma: any = {
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
    careerRank: {
      findFirst: vi.fn(async ({ where }: any) => ranks.find((rank) => rank.displayOrder > where.displayOrder.gt) ?? null),
      findMany: vi.fn(async () => ranks),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const hit = ranks.find((rank) => rank.rankCode === where.rankCode);
        if (!hit) throw new Error("rank not found");
        return hit;
      })
    },
    careerSkillStat: {
      findMany: vi.fn(async ({ where }: any) => db.skills.filter((skill) => skill.userId === where.userId)),
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.userId_axisCode;
        return db.skills.find((skill) => skill.userId === key.userId && skill.axisCode === key.axisCode) ?? null;
      }),
      update: vi.fn(async ({ data, where }: any) => {
        const stat = db.skills.find((item) => item.id === where.id);
        if (stat) Object.assign(stat, data);
        return stat;
      }),
      upsert: vi.fn(async ({ create, update, where }: any) => {
        const key = where.userId_axisCode;
        let stat = db.skills.find((item) => item.userId === key.userId && item.axisCode === key.axisCode);
        if (!stat) {
          stat = { id: `skill-${db.skills.length}`, updatedAt: new Date(), ...create };
          db.skills.push(stat);
          return stat;
        }
        if (typeof update.value?.increment === "number") stat.value += update.value.increment;
        return stat;
      })
    },
    chapterAttempt: {
      create: vi.fn(async ({ data }: any) => {
        const attempt = { completedAt: null, id: `attempt-${db.attempts.length}`, scoreSnapshot: null, startedAt: new Date(), status: "in_progress", ...data };
        db.attempts.push(attempt);
        return attempt;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return [...db.attempts].reverse().find((attempt) => {
          if (where.userId && attempt.userId !== where.userId) return false;
          if (where.chapterId && attempt.chapterId !== where.chapterId) return false;
          if (where.status && attempt.status !== where.status) return false;
          return true;
        }) ?? null;
      }),
      findMany: vi.fn(async ({ where }: any) => db.attempts.filter((attempt) => attempt.userId === where.userId && attempt.status === where.status)),
      update: vi.fn(async ({ data, where }: any) => {
        const attempt = db.attempts.find((item) => item.id === where.id);
        Object.assign(attempt, data);
        return attempt;
      })
    },
    missionChapter: {
      findUnique: vi.fn(async ({ where }: any) => (where.id === chapterId ? chapter : null))
    },
    npcRelation: {
      findMany: vi.fn(async ({ where }: any) => db.relations.filter((relation) => relation.userId === where.userId)),
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.userId_npcSlug;
        return db.relations.find((relation) => relation.userId === key.userId && relation.npcSlug === key.npcSlug) ?? null;
      }),
      update: vi.fn(async ({ data, where }: any) => {
        const relation = db.relations.find((item) => item.id === where.id);
        if (relation) Object.assign(relation, data);
        return relation;
      }),
      upsert: vi.fn(async ({ create, update, where }: any) => {
        const key = where.userId_npcSlug;
        let relation = db.relations.find((item) => item.userId === key.userId && item.npcSlug === key.npcSlug);
        if (!relation) {
          relation = { id: `relation-${db.relations.length}`, ...create };
          db.relations.push(relation);
          return relation;
        }
        if (typeof update.trustScore?.increment === "number") relation.trustScore += update.trustScore.increment;
        if (update.lastInteractionAt) relation.lastInteractionAt = update.lastInteractionAt;
        return relation;
      })
    },
    rankProgressionEvent: {
      create: vi.fn(async ({ data }: any) => {
        const event = { id: `event-${db.events.length}`, ...data };
        db.events.push(event);
        return event;
      })
    },
    storyNpc: {
      findMany: vi.fn(async () => npcs)
    },
    userCareerState: {
      findUnique: vi.fn(async ({ where }: any) => db.states.find((state) => state.userId === where.userId) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const state = db.states.find((item) => item.userId === where.userId);
        if (!state) throw new Error("state not found");
        return state;
      }),
      update: vi.fn(async ({ data, where }: any) => {
        const state = db.states.find((item) => item.userId === where.userId);
        Object.assign(state, data);
        return state;
      }),
      upsert: vi.fn(async ({ create, where }: any) => {
        let state = db.states.find((item) => item.userId === where.userId);
        if (!state) {
          state = {
            companyTheme: "mirai-shoji",
            currentRankCode: "R1",
            hireDate: new Date("2026-04-01T00:00:00.000Z"),
            jpWorkName: "田中 太郎",
            lastClockInAt: null,
            rankXp: 0,
            streakDays: 0,
            updatedAt: new Date(),
            ...create
          };
          db.states.push(state);
        }
        return state;
      })
    },
    userProfile: {
      upsert: vi.fn(async ({ create, where }: any) => {
        let profile = db.profiles.find((item) => item.id === where.id);
        if (!profile) {
          profile = { ...create };
          db.profiles.push(profile);
        }
        return profile;
      })
    }
  };

  return { db, prisma };
}

describe("CareerRpgService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-09T00:30:00.000Z"));
  });

  it("auto-creates career state and default skill stats", async () => {
    const { db, prisma } = createPrismaStub();
    const svc = new CareerRpgService(prisma);

    const response = await svc.careerMe(DEV_CAREER_USER_ID);

    expect(response.state.currentRankCode).toBe("R1");
    expect(db.states).toHaveLength(1);
    expect(db.skills.map((skill) => skill.axisCode).sort()).toEqual(["chart", "customer", "keigo", "meeting", "nuance", "written"]);
  });

  it("keeps clock-in idempotent for the same Tokyo day", async () => {
    const { db, prisma } = createPrismaStub();
    const svc = new CareerRpgService(prisma);

    await svc.clockIn(DEV_CAREER_USER_ID);
    await svc.clockIn(DEV_CAREER_USER_ID);

    expect(db.states[0].streakDays).toBe(1);
  });

  it("applies chapter XP only once for the same attempt", async () => {
    const { db, prisma } = createPrismaStub();
    const svc = new CareerRpgService(prisma);

    await svc.startAttempt(DEV_CAREER_USER_ID, chapterId);
    await svc.completeCurrentAttempt(DEV_CAREER_USER_ID, chapterId);
    await svc.completeCurrentAttempt(DEV_CAREER_USER_ID, chapterId);

    expect(db.states[0].rankXp).toBe(24);
  });

  it("updates skill stats and NPC trust on chapter completion", async () => {
    const { db, prisma } = createPrismaStub();
    const svc = new CareerRpgService(prisma);

    await svc.startAttempt(DEV_CAREER_USER_ID, chapterId);
    await svc.completeCurrentAttempt(DEV_CAREER_USER_ID, chapterId);

    expect(db.skills.find((skill) => skill.axisCode === "keigo")?.value).toBe(8);
    expect(db.skills.find((skill) => skill.axisCode === "written")?.value).toBe(5);
    expect(db.relations.find((relation) => relation.npcSlug === "sato_kokyaku")?.trustScore).toBe(58);
  });

  it("creates a rank-up event when XP crosses the current threshold", async () => {
    const { db, prisma } = createPrismaStub();
    const svc = new CareerRpgService(prisma);

    await svc.careerMe(DEV_CAREER_USER_ID);
    db.states[0].rankXp = 40;
    await svc.startAttempt(DEV_CAREER_USER_ID, chapterId);
    const response = await svc.completeCurrentAttempt(DEV_CAREER_USER_ID, chapterId);

    expect(response.rankUp).toEqual({ fromRankCode: "R1", toRankCode: "R2" });
    expect(db.states[0].currentRankCode).toBe("R2");
    expect(db.events).toHaveLength(1);
  });
});
