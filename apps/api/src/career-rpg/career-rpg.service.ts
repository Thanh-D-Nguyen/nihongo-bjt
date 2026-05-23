import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

export const CAREER_SKILL_AXES = ["keigo", "written", "meeting", "customer", "chart", "nuance"] as const;
export const DEV_CAREER_USER_ID = "00000000-0000-4000-8000-000000000101";

type SkillAxisCode = (typeof CAREER_SKILL_AXES)[number];

type RewardsPayload = {
  rankXp?: number;
  skillGains?: Partial<Record<SkillAxisCode, number>>;
  npcTrustGains?: Array<{ npcSlug: string; delta: number }>;
  contextMemoDrops?: Array<Record<string, unknown>>;
  npcReactionMontage?: Array<Record<string, unknown>>;
};

type ContextMemo = {
  bjtTrapVi: string;
  cardKind:
    | "expression_pair"
    | "keigo_register"
    | "scene_pattern"
    | "nuance_pattern"
    | "soft_refusal"
    | "discourse_marker";
  expressionJa: string;
  fromNpcSlug: string;
  fromNpcAvatarInitial?: string;
  fromNpcAvatarTint?: string;
  fromNpcNameJa?: string;
  generatedAt: string;
  id: string;
  reading: string;
  realIntentVi: string;
  sceneJa: string;
  status: "unread" | "read";
  surfaceMeaningVi: string;
  toneVi: string;
};

@Injectable()
export class CareerRpgService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient = createPrismaClient()) {
    this.prisma = prisma;
  }

  async careerMe(userId: string) {
    await this.ensureCareerFoundation(userId);
    const [state, ranks, skills, relations, npcs] = await Promise.all([
      this.prisma.userCareerState.findUniqueOrThrow({ where: { userId } }),
      this.prisma.careerRank.findMany({ orderBy: { displayOrder: "asc" } }),
      this.prisma.careerSkillStat.findMany({ orderBy: { axisCode: "asc" }, where: { userId } }),
      this.prisma.npcRelation.findMany({ orderBy: { npcSlug: "asc" }, where: { userId } }),
      this.prisma.storyNpc.findMany({ orderBy: { slug: "asc" }, where: { status: "active" } })
    ]);
    return this.buildCareerResponse(state, ranks, skills, relations, npcs);
  }

  async ranks() {
    const ranks = await this.prisma.careerRank.findMany({ orderBy: { displayOrder: "asc" } });
    return ranks.map((rank) => this.mapRank(rank));
  }

  async inbox(userId: string) {
    await this.ensureCareerFoundation(userId);
    const [attempts, npcs] = await Promise.all([
      this.prisma.chapterAttempt.findMany({
        include: { chapter: true },
        orderBy: { completedAt: "desc" },
        where: {
          completedAt: { not: null },
          scoreSnapshot: { not: Prisma.JsonNull },
          status: "completed",
          userId
        }
      }),
      this.prisma.storyNpc.findMany({ where: { status: "active" } })
    ]);
    const npcBySlug = new Map(npcs.map((npc) => [npc.slug, npc]));

    const seen = new Set<string>();
    const inbox: ContextMemo[] = [];
    for (const attempt of attempts) {
      const snapshot = objectJson(attempt.scoreSnapshot);
      const drops = Array.isArray(snapshot.contextMemoDrops)
        ? snapshot.contextMemoDrops.filter(isRecord)
        : [];
      const memoDrops = drops.length > 0 ? drops : [deriveContextMemoFromAttempt(attempt)].filter(isRecord);
      for (const drop of memoDrops) {
        const memo = mapContextMemo(drop, attempt.completedAt ?? undefined);
        if (!memo || seen.has(memo.id)) continue;
        seen.add(memo.id);
        inbox.push(attachNpcMetadata(memo, npcBySlug.get(memo.fromNpcSlug)));
      }
    }
    return inbox;
  }

  async clockIn(userId: string) {
    await this.ensureCareerFoundation(userId);
    const now = new Date();
    const today = tokyoDateKey(now);
    const state = await this.prisma.userCareerState.findUniqueOrThrow({ where: { userId } });
    const lastKey = state.lastClockInAt ? tokyoDateKey(state.lastClockInAt) : null;
    if (lastKey === today) {
      return this.careerMe(userId);
    }

    const yesterday = offsetDateKey(now, -1);
    const nextStreak = lastKey === yesterday ? state.streakDays + 1 : 1;
    await this.prisma.userCareerState.update({
      data: { lastClockInAt: now, streakDays: nextStreak },
      where: { userId }
    });
    return this.careerMe(userId);
  }

  async updateProfile(userId: string, data: { jpWorkName?: string }) {
    await this.ensureCareerFoundation(userId);
    const update: Record<string, unknown> = {};
    if (data.jpWorkName !== undefined) {
      const trimmed = data.jpWorkName.trim();
      if (trimmed.length < 1 || trimmed.length > 30) {
        throw new BadRequestException("jpWorkName must be 1–30 characters");
      }
      update.jpWorkName = trimmed;
    }
    if (Object.keys(update).length === 0) {
      return this.careerMe(userId);
    }
    await this.prisma.userCareerState.update({ data: update, where: { userId } });
    return this.careerMe(userId);
  }

  async arcs(userId: string) {
    await this.ensureCareerFoundation(userId);
    const [state, ranks, arcs, completedAttempts] = await Promise.all([
      this.prisma.userCareerState.findUniqueOrThrow({ where: { userId } }),
      this.prisma.careerRank.findMany({ orderBy: { displayOrder: "asc" } }),
      this.prisma.missionArc.findMany({
        include: { chapters: { orderBy: { displayOrder: "asc" } } },
        orderBy: { displayOrder: "asc" },
        where: { status: "published" }
      }),
      this.prisma.chapterAttempt.findMany({
        select: { chapterId: true },
        where: { completedAt: { not: null }, status: "completed", userId }
      })
    ]);
    const completedChapterIds = new Set(completedAttempts.map((attempt) => attempt.chapterId));
    return arcs.map((arc) => this.mapArc(arc, ranks, state.currentRankCode, completedChapterIds));
  }

  async arcDetail(userId: string, slug: string) {
    await this.ensureCareerFoundation(userId);
    const [state, ranks, arc, completedAttempts, relations, npcs] = await Promise.all([
      this.prisma.userCareerState.findUniqueOrThrow({ where: { userId } }),
      this.prisma.careerRank.findMany({ orderBy: { displayOrder: "asc" } }),
      this.prisma.missionArc.findUnique({
        include: { chapters: { orderBy: { displayOrder: "asc" } } },
        where: { slug }
      }),
      this.prisma.chapterAttempt.findMany({
        select: { chapterId: true },
        where: { completedAt: { not: null }, status: "completed", userId }
      }),
      this.prisma.npcRelation.findMany({ where: { userId } }),
      this.prisma.storyNpc.findMany({ where: { status: "active" } })
    ]);
    if (!arc || arc.status !== "published") {
      throw new NotFoundException("Mission arc not found");
    }
    const completedChapterIds = new Set(completedAttempts.map((attempt) => attempt.chapterId));
    return {
      arc: this.mapArc(arc, ranks, state.currentRankCode, completedChapterIds),
      chapters: arc.chapters.map((chapter) => this.mapChapter(chapter, arc.slug)),
      npcRelations: relations.map((relation) => this.mapNpcRelation(relation)),
      npcs: npcs.map((npc) => this.mapNpc(npc))
    };
  }

  async chapter(userId: string, chapterId: string) {
    await this.ensureCareerFoundation(userId);
    const chapter = await this.prisma.missionChapter.findUnique({
      include: { arc: true },
      where: { id: chapterId }
    });
    if (!chapter || chapter.arc.status !== "published") {
      throw new NotFoundException("Mission chapter not found");
    }
    return {
      chapter: this.mapChapter(chapter, chapter.arc.slug),
      npcs: (await this.prisma.storyNpc.findMany({ where: { status: "active" } })).map((npc) => this.mapNpc(npc)),
      rewardsPayload: chapter.rewardsPayload
    };
  }

  async startAttempt(userId: string, chapterId: string) {
    await this.ensureCareerFoundation(userId);
    await this.assertPublishedChapter(chapterId);
    const existing = await this.prisma.chapterAttempt.findFirst({
      orderBy: { startedAt: "desc" },
      where: { chapterId, status: "in_progress", userId }
    });
    if (existing) {
      return existing;
    }
    return this.prisma.chapterAttempt.create({ data: { chapterId, userId } });
  }

  async completeCurrentAttempt(userId: string, chapterId: string) {
    await this.ensureCareerFoundation(userId);
    const chapter = await this.assertPublishedChapter(chapterId);
    const current = await this.prisma.chapterAttempt.findFirst({
      orderBy: { startedAt: "desc" },
      where: { chapterId, status: "in_progress", userId }
    });
    if (!current) {
      const completed = await this.prisma.chapterAttempt.findFirst({
        orderBy: { completedAt: "desc" },
        where: { chapterId, status: "completed", userId }
      });
      if (completed?.scoreSnapshot) {
        return {
          career: await this.careerMe(userId),
          result: completed.scoreSnapshot,
          rankUp: null
        };
      }
      throw new NotFoundException("No in-progress chapter attempt found");
    }

    const now = new Date();
    const rewards = parseRewards(chapter.rewardsPayload);
    const result = {
      chapterId,
      completedAt: now.toISOString(),
      contextMemoDrops: (rewards.contextMemoDrops ?? []).map((memo) => ({
        ...memo,
        generatedAt: now.toISOString(),
        status: "unread"
      })),
      contextMemoIds: (rewards.contextMemoDrops ?? []).map((memo) => String(memo.id ?? "")).filter(Boolean),
      npcReactionMontage: rewards.npcReactionMontage ?? [],
      npcTrustDeltas: rewards.npcTrustGains ?? [],
      rankXpDelta: rewards.rankXp ?? 0,
      skillDeltas: rewards.skillGains ?? {}
    };

    const rankUp = await this.prisma.$transaction(async (tx) => {
      const state = await tx.userCareerState.findUniqueOrThrow({ where: { userId } });
      const currentRank = await tx.careerRank.findUniqueOrThrow({ where: { rankCode: state.currentRankCode } });
      const newXp = state.rankXp + result.rankXpDelta;
      let nextRankCode = state.currentRankCode;
      let rankUpPayload: { fromRankCode: string; toRankCode: string } | null = null;
      if (currentRank.xpToNext > 0 && newXp >= currentRank.xpToNext) {
        const nextRank = await tx.careerRank.findFirst({
          orderBy: { displayOrder: "asc" },
          where: { displayOrder: { gt: currentRank.displayOrder } }
        });
        if (nextRank) {
          nextRankCode = nextRank.rankCode;
          rankUpPayload = { fromRankCode: currentRank.rankCode, toRankCode: nextRank.rankCode };
        }
      }

      await tx.userCareerState.update({
        data: { currentRankCode: nextRankCode, rankXp: newXp },
        where: { userId }
      });
      for (const [axisCode, delta] of Object.entries(result.skillDeltas)) {
        if (typeof delta !== "number") continue;
        await tx.careerSkillStat.upsert({
          create: { axisCode, userId, value: Math.max(0, Math.min(100, delta)) },
          update: { value: { increment: delta } },
          where: { userId_axisCode: { axisCode, userId } }
        });
        const stat = await tx.careerSkillStat.findUnique({ where: { userId_axisCode: { axisCode, userId } } });
        if (stat && (stat.value < 0 || stat.value > 100)) {
          await tx.careerSkillStat.update({
            data: { value: Math.max(0, Math.min(100, stat.value)) },
            where: { id: stat.id }
          });
        }
      }
      for (const gain of result.npcTrustDeltas) {
        await tx.npcRelation.upsert({
          create: {
            lastInteractionAt: now,
            npcSlug: gain.npcSlug,
            trustScore: Math.max(0, Math.min(100, 50 + gain.delta)),
            userId
          },
          update: {
            lastInteractionAt: now,
            trustScore: { increment: gain.delta }
          },
          where: { userId_npcSlug: { npcSlug: gain.npcSlug, userId } }
        });
        const relation = await tx.npcRelation.findUnique({ where: { userId_npcSlug: { npcSlug: gain.npcSlug, userId } } });
        if (relation && (relation.trustScore < 0 || relation.trustScore > 100)) {
          await tx.npcRelation.update({
            data: { trustScore: Math.max(0, Math.min(100, relation.trustScore)) },
            where: { id: relation.id }
          });
        }
      }
      if (rankUpPayload) {
        await tx.rankProgressionEvent.create({
          data: {
            fromRankCode: rankUpPayload.fromRankCode,
            snapshot: { attemptId: current.id, chapterId, newXp, rewards: result } as Prisma.InputJsonValue,
            toRankCode: rankUpPayload.toRankCode,
            triggerEvent: "chapter_completed",
            userId
          }
        });
      }
      await tx.chapterAttempt.update({
        data: {
          completedAt: now,
          scoreSnapshot: result as Prisma.InputJsonValue,
          status: "completed"
        },
        where: { id: current.id }
      });
      return rankUpPayload;
    });

    return {
      career: await this.careerMe(userId),
      result,
      rankUp
    };
  }

  private async ensureCareerFoundation(userId: string) {
    await this.prisma.userProfile.upsert({
      create: {
        displayName: userId === DEV_CAREER_USER_ID ? "Career RPG Dev User" : "Learner",
        id: userId
      },
      update: {},
      where: { id: userId }
    });
    await this.prisma.userCareerState.upsert({
      create: { userId },
      update: {},
      where: { userId }
    });
    for (const axisCode of CAREER_SKILL_AXES) {
      await this.prisma.careerSkillStat.upsert({
        create: { axisCode, userId, value: 0 },
        update: {},
        where: { userId_axisCode: { axisCode, userId } }
      });
    }
    const npcs = await this.prisma.storyNpc.findMany({
      select: { slug: true },
      where: { status: "active" }
    });
    for (const npc of npcs) {
      await this.prisma.npcRelation.upsert({
        create: { npcSlug: npc.slug, trustScore: 50, userId },
        update: {},
        where: { userId_npcSlug: { npcSlug: npc.slug, userId } }
      });
    }
  }

  private async assertPublishedChapter(chapterId: string) {
    const chapter = await this.prisma.missionChapter.findUnique({
      include: { arc: true },
      where: { id: chapterId }
    });
    if (!chapter || chapter.arc.status !== "published") {
      throw new NotFoundException("Mission chapter not found");
    }
    return chapter;
  }

  private buildCareerResponse(
    state: Prisma.UserCareerStateGetPayload<object>,
    ranks: Prisma.CareerRankGetPayload<object>[],
    skills: Prisma.CareerSkillStatGetPayload<object>[],
    relations: Prisma.NpcRelationGetPayload<object>[],
    npcs: Prisma.StoryNpcGetPayload<object>[]
  ) {
    const currentRank = ranks.find((rank) => rank.rankCode === state.currentRankCode) ?? ranks[0]!;
    const nextRank = ranks.find((rank) => rank.displayOrder === currentRank.displayOrder + 1) ?? null;
    return {
      nextRank: nextRank ? this.mapRank(nextRank) : null,
      npcRelations: relations.map((relation) => this.mapNpcRelation(relation)),
      npcs: npcs.map((npc) => this.mapNpc(npc)),
      rank: this.mapRank(currentRank),
      state: {
        companyTheme: state.companyTheme,
        currentRankCode: state.currentRankCode,
        hireDate: dateOnly(state.hireDate),
        jpWorkName: state.jpWorkName,
        lastClockInAt: state.lastClockInAt?.toISOString() ?? null,
        rankXp: state.rankXp,
        rankXpToNext: currentRank.xpToNext,
        skills: skills.map((skill) => ({ axisCode: skill.axisCode, value: skill.value })),
        streakDays: state.streakDays,
        userId: state.userId
      }
    };
  }

  private mapRank(rank: Prisma.CareerRankGetPayload<object>) {
    return {
      bjtBandTarget: rank.bjtBandTarget,
      displayOrder: rank.displayOrder,
      minSkillFloor: rank.minSkillFloor,
      rankCode: rank.rankCode,
      requiredArcCount: rank.requiredArcCount,
      rewardsPayload: rank.rewardsPayload,
      titleJa: rank.titleJa,
      titleVi: rank.titleVi,
      unlockedSceneTypes: asArray(rank.unlockedSceneTypes),
      xpToNext: rank.xpToNext
    };
  }

  private mapArc(
    arc: Prisma.MissionArcGetPayload<{ include: { chapters: true } }>,
    ranks: Prisma.CareerRankGetPayload<object>[],
    currentRankCode: string,
    completedChapterIds: Set<string>
  ) {
    const story = objectJson(arc.storyPayload);
    const entryRank = ranks.find((rank) => rank.rankCode === arc.rankCodeEntry);
    const currentRank = ranks.find((rank) => rank.rankCode === currentRankCode);
    const unlocked = Boolean(entryRank && currentRank && entryRank.displayOrder <= currentRank.displayOrder);
    const completedChapters = arc.chapters.filter((chapter) => completedChapterIds.has(chapter.id)).length;
    return {
      artAccent: typeof story.artAccent === "string" ? story.artAccent : "#1B2A4A",
      bossChapterId: arc.chapters.find((chapter) => chapter.isBoss)?.id ?? null,
      chapterIds: arc.chapters.map((chapter) => chapter.id),
      completedChapters,
      displayOrder: arc.displayOrder,
      locked: !unlocked,
      npcSlugs: stringArray(story.npcSlugs),
      rankCodeEntry: arc.rankCodeEntry,
      slug: arc.slug,
      status: unlocked ? (completedChapters >= arc.chapters.length && arc.chapters.length > 0 ? "completed" : "active") : "locked",
      synopsisVi: typeof story.synopsisVi === "string" ? story.synopsisVi : "",
      titleJa: arc.titleJa,
      titleVi: arc.titleVi,
      totalChapters: arc.chapters.length
    };
  }

  private mapChapter(chapter: Prisma.MissionChapterGetPayload<{ include?: { arc?: true } }>, arcSlug: string) {
    const briefing = objectJson(chapter.briefingPayload);
    const scenario = objectJson(chapter.scenarioPayload);
    return {
      arcSlug,
      briefingJa: typeof briefing.briefingJa === "string" ? briefing.briefingJa : "",
      briefingVi: typeof briefing.briefingVi === "string" ? briefing.briefingVi : "",
      displayOrder: chapter.displayOrder,
      estimatedMinutes: typeof briefing.estimatedMinutes === "number" ? briefing.estimatedMinutes : 5,
      id: chapter.id,
      isBoss: chapter.isBoss,
      scenarios: Array.isArray(scenario.scenarios) ? scenario.scenarios : [],
      slug: chapter.slug,
      titleJa: chapter.titleJa,
      titleVi: chapter.titleVi,
      yourRoleVi: typeof briefing.yourRoleVi === "string" ? briefing.yourRoleVi : ""
    };
  }

  private mapNpc(npc: Prisma.StoryNpcGetPayload<object>) {
    const avatar = objectJson(npc.avatarMedia);
    return {
      avatarInitial: typeof avatar.avatarInitial === "string" ? avatar.avatarInitial : npc.nameJa.slice(0, 1),
      avatarTint: typeof avatar.avatarTint === "string" ? avatar.avatarTint : "#1B2A4A",
      bioVi: typeof avatar.bioVi === "string" ? avatar.bioVi : "",
      companyJa: npc.companyJa,
      defaultRelation: npc.defaultRelation,
      nameJa: npc.nameJa,
      roleJa: npc.roleJa,
      slug: npc.slug
    };
  }

  private mapNpcRelation(relation: Prisma.NpcRelationGetPayload<object>) {
    return {
      lastInteractionAt: relation.lastInteractionAt?.toISOString() ?? null,
      npcSlug: relation.npcSlug,
      trustScore: relation.trustScore
    };
  }
}

function parseRewards(value: Prisma.JsonValue): RewardsPayload {
  const raw = objectJson(value);
  return {
    contextMemoDrops: Array.isArray(raw.contextMemoDrops) ? raw.contextMemoDrops.filter(isRecord) : [],
    npcReactionMontage: Array.isArray(raw.npcReactionMontage) ? raw.npcReactionMontage.filter(isRecord) : [],
    npcTrustGains: Array.isArray(raw.npcTrustGains)
      ? raw.npcTrustGains.filter((item): item is { npcSlug: string; delta: number } => {
          return isRecord(item) && typeof item.npcSlug === "string" && typeof item.delta === "number";
        })
      : [],
    rankXp: typeof raw.rankXp === "number" ? raw.rankXp : 0,
    skillGains: isRecord(raw.skillGains) ? (raw.skillGains as Partial<Record<SkillAxisCode, number>>) : {}
  };
}

function mapContextMemo(value: Record<string, unknown>, fallbackDate?: Date): ContextMemo | null {
  if (typeof value.id !== "string" || typeof value.expressionJa !== "string") {
    return null;
  }
  const fallbackGeneratedAt = fallbackDate?.toISOString() ?? new Date().toISOString();
  return {
    bjtTrapVi: stringOrEmpty(value.bjtTrapVi),
    cardKind: contextMemoKind(value.cardKind),
    expressionJa: value.expressionJa,
    fromNpcSlug: stringOrEmpty(value.fromNpcSlug),
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : fallbackGeneratedAt,
    id: value.id,
    reading: stringOrEmpty(value.reading),
    realIntentVi: stringOrEmpty(value.realIntentVi),
    sceneJa: stringOrEmpty(value.sceneJa),
    status: value.status === "read" ? "read" : "unread",
    surfaceMeaningVi: stringOrEmpty(value.surfaceMeaningVi),
    toneVi: stringOrEmpty(value.toneVi)
  };
}

function deriveContextMemoFromAttempt(
  attempt: Prisma.ChapterAttemptGetPayload<{ include: { chapter: true } }>
): Record<string, unknown> {
  const chapter = attempt.chapter;
  const scenarioPayload = objectJson(chapter.scenarioPayload);
  const scenarios = Array.isArray(scenarioPayload.scenarios)
    ? scenarioPayload.scenarios.filter(isRecord)
    : [];
  const scenario = scenarios[0] ?? {};
  const question = isRecord(scenario.question) ? scenario.question : {};
  const options = Array.isArray(question.options) ? question.options.filter(isRecord) : [];
  const correctOption = options.find((option) => option.isCorrect === true);
  const characters = Array.isArray(scenario.characters) ? scenario.characters.filter(isRecord) : [];
  const rewards = parseRewards(chapter.rewardsPayload);
  const firstTrustGain = rewards.npcTrustGains?.[0];
  const firstCharacter = characters[0];
  const scenarioType = typeof scenario.scenarioType === "string" ? scenario.scenarioType : "";
  const skillList = Object.keys(rewards.skillGains ?? {});

  return {
    bjtTrapVi:
      stringOrEmpty(question.promptVi) ||
      "Ôn lại bối cảnh BJT của chapter này để tránh hiểu sai ý định, sắc thái và hành động tiếp theo.",
    cardKind: cardKindForScenario(scenarioType),
    expressionJa:
      stringOrEmpty(correctOption?.textJa) ||
      stringOrEmpty(scenario.goalJa) ||
      chapter.titleJa,
    fromNpcSlug:
      firstTrustGain?.npcSlug ||
      (typeof firstCharacter?.npcSlug === "string" ? firstCharacter.npcSlug : "") ||
      "tanaka_senpai",
    generatedAt: attempt.completedAt?.toISOString() ?? new Date().toISOString(),
    id: `chapter:${chapter.id}:reflection`,
    reading: "",
    realIntentVi:
      stringOrEmpty(scenario.goalVi) ||
      stringOrEmpty(scenario.contextSummaryVi) ||
      `Ghi chú ôn tập từ chapter "${chapter.titleVi}".`,
    sceneJa: stringOrEmpty(scenario.titleJa) || chapter.titleJa,
    status: "unread",
    surfaceMeaningVi: stringOrEmpty(scenario.titleVi) || chapter.titleVi,
    toneVi: skillList.length > 0 ? `Trọng tâm: ${skillList.join(", ")}` : "Ngữ cảnh công sở Nhật"
  };
}

function attachNpcMetadata(
  memo: ContextMemo,
  npc: Prisma.StoryNpcGetPayload<object> | undefined
): ContextMemo {
  if (!npc) return memo;
  const avatar = objectJson(npc.avatarMedia);
  return {
    ...memo,
    fromNpcAvatarInitial: typeof avatar.avatarInitial === "string" ? avatar.avatarInitial : npc.nameJa.slice(0, 1),
    fromNpcAvatarTint: typeof avatar.avatarTint === "string" ? avatar.avatarTint : "#1B2A4A",
    fromNpcNameJa: npc.nameJa
  };
}

function cardKindForScenario(scenarioType: string): ContextMemo["cardKind"] {
  if (scenarioType === "complaint") return "soft_refusal";
  if (scenarioType === "meeting") return "discourse_marker";
  if (scenarioType === "chat" || scenarioType === "deadline") return "nuance_pattern";
  if (scenarioType === "email") return "keigo_register";
  return "scene_pattern";
}

function contextMemoKind(value: unknown): ContextMemo["cardKind"] {
  const allowed: ContextMemo["cardKind"][] = [
    "expression_pair",
    "keigo_register",
    "scene_pattern",
    "nuance_pattern",
    "soft_refusal",
    "discourse_marker"
  ];
  return typeof value === "string" && allowed.includes(value as ContextMemo["cardKind"])
    ? (value as ContextMemo["cardKind"])
    : "scene_pattern";
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function objectJson(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: Prisma.JsonValue): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function tokyoDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric"
  }).format(value);
}

function offsetDateKey(value: Date, offsetDays: number) {
  const shifted = new Date(value);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return tokyoDateKey(shifted);
}
