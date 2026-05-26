import { Injectable, Logger } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";
import type { CompanionPet } from "@nihongo-bjt/database";

const STAGES = ["egg", "baby", "teen", "adult", "master"] as const;
const STAGE_THRESHOLDS: Record<string, number> = {
  egg: 0,
  baby: 50,
  teen: 200,
  adult: 500,
  master: 1500,
};

const FEED_REWARDS: Record<string, { xp: number; happiness: number }> = {
  review: { xp: 5, happiness: 10 },
  quiz: { xp: 10, happiness: 15 },
  daily_phrase: { xp: 3, happiness: 5 },
  focus_session: { xp: 8, happiness: 12 },
  login: { xp: 2, happiness: 5 },
};

function getMood(happiness: number): string {
  if (happiness >= 80) return "happy";
  if (happiness >= 50) return "neutral";
  if (happiness >= 20) return "sad";
  return "sick";
}

function getStage(xp: number): string {
  if (xp >= 1500) return "master";
  if (xp >= 500) return "adult";
  if (xp >= 200) return "teen";
  if (xp >= 50) return "baby";
  return "egg";
}

@Injectable()
export class CompanionPetService {
  private readonly logger = new Logger(CompanionPetService.name);
  private readonly prisma = createPrismaClient();

  /** Get or create pet for user */
  async getPet(userId: string) {
    let pet = await this.prisma.companionPet.findUnique({ where: { userId } });
    if (!pet) {
      pet = await this.prisma.companionPet.create({ data: { userId } });
    }

    // Apply happiness decay
    pet = await this.applyDecay(pet);

    const currentStageIdx = STAGES.indexOf(pet.stage as (typeof STAGES)[number]);
    const nextStage = currentStageIdx < STAGES.length - 1 ? STAGES[currentStageIdx + 1] : null;
    const nextThreshold = nextStage ? STAGE_THRESHOLDS[nextStage] : null;

    return {
      id: pet.id,
      name: pet.name,
      stage: pet.stage,
      xp: pet.xp,
      happiness: pet.happiness,
      mood: pet.mood,
      costumeSlug: pet.costumeSlug,
      totalFeedings: pet.totalFeedings,
      lastFedAt: pet.lastFedAt,
      evolvedAt: pet.evolvedAt,
      nextStage,
      nextThreshold,
      stageProgress: nextThreshold ? Math.min(100, Math.round((pet.xp / nextThreshold) * 100)) : 100,
    };
  }

  /** Feed pet (called when learner does study activity) */
  async feedPet(userId: string, action: string) {
    const reward = FEED_REWARDS[action] ?? FEED_REWARDS.review;

    let pet = await this.prisma.companionPet.findUnique({ where: { userId } });
    if (!pet) {
      pet = await this.prisma.companionPet.create({ data: { userId } });
    }

    const newXp = pet.xp + reward.xp;
    const newHappiness = Math.min(100, pet.happiness + reward.happiness);
    const newStage = getStage(newXp);
    const evolved = newStage !== pet.stage;

    const updated = await this.prisma.companionPet.update({
      where: { userId },
      data: {
        xp: newXp,
        happiness: newHappiness,
        mood: getMood(newHappiness),
        stage: newStage,
        totalFeedings: { increment: 1 },
        lastFedAt: new Date(),
        ...(evolved ? { evolvedAt: new Date() } : {}),
      },
    });

    return {
      xpGained: reward.xp,
      happinessGained: reward.happiness,
      evolved,
      newStage: evolved ? newStage : null,
      pet: {
        stage: updated.stage,
        xp: updated.xp,
        happiness: updated.happiness,
        mood: updated.mood,
      },
    };
  }

  /** Rename pet */
  async renamePet(userId: string, name: string) {
    const cleanName = name.trim().slice(0, 30);
    if (!cleanName) return null;
    return this.prisma.companionPet.update({
      where: { userId },
      data: { name: cleanName },
    });
  }

  /** List pet costumes owned by a user. */
  getCostumes(userId: string) {
    return this.prisma.petCostumeInventory.findMany({
      orderBy: { obtainedAt: "desc" },
      where: { userId },
    });
  }

  /** Apply happiness decay based on last fed time */
  private async applyDecay(pet: CompanionPet): Promise<CompanionPet> {
    if (!pet.lastFedAt) return pet;

    const hoursSinceLastFed = (Date.now() - pet.lastFedAt.getTime()) / (1000 * 60 * 60);
    const daysNotFed = Math.floor(hoursSinceLastFed / 24);

    if (daysNotFed <= 0) return pet;

    const decay = Math.min(pet.happiness, daysNotFed * 10);
    if (decay === 0) return pet;

    const newHappiness = Math.max(0, pet.happiness - decay);
    return this.prisma.companionPet.update({
      where: { id: pet.id },
      data: { happiness: newHappiness, mood: getMood(newHappiness) },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Admin Methods ──────────────────────────────────────────────────── */

  /** Admin: list all pets with optional filters */
  async adminListPets(filters: { stage?: string; search?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.stage && STAGES.includes(filters.stage as (typeof STAGES)[number])) {
      where.stage = filters.stage;
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { userId: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    return this.prisma.companionPet.findMany({
      where,
      orderBy: { xp: "desc" },
      take: 200,
    });
  }

  /** Admin: get aggregate stats */
  async adminGetStats() {
    const [total, byStage, avgHappiness] = await Promise.all([
      this.prisma.companionPet.count(),
      this.prisma.companionPet.groupBy({ by: ["stage"], _count: true }),
      this.prisma.companionPet.aggregate({ _avg: { happiness: true, xp: true } }),
    ]);
    return {
      total,
      byStage: byStage.map((s) => ({ stage: s.stage, count: s._count })),
      avgHappiness: Math.round(avgHappiness._avg.happiness ?? 0),
      avgXp: Math.round(avgHappiness._avg.xp ?? 0),
    };
  }

  /** Admin: get single pet */
  async adminGetPet(id: string) {
    return this.prisma.companionPet.findUnique({ where: { id } });
  }

  /** Admin: update pet fields */
  async adminUpdatePet(id: string, data: { stage?: string; xp?: number; happiness?: number; name?: string }) {
    const update: Record<string, unknown> = {};
    if (data.stage && STAGES.includes(data.stage as (typeof STAGES)[number])) {
      update.stage = data.stage;
    }
    if (data.xp != null && data.xp >= 0) update.xp = data.xp;
    if (data.happiness != null && data.happiness >= 0 && data.happiness <= 100) {
      update.happiness = data.happiness;
      update.mood = getMood(data.happiness);
    }
    if (data.name) update.name = data.name.trim().slice(0, 30);
    return this.prisma.companionPet.update({ where: { id }, data: update });
  }

  /** Admin: reset pet to egg */
  async adminResetPet(id: string) {
    return this.prisma.companionPet.update({
      where: { id },
      data: { stage: "egg", xp: 0, happiness: 100, mood: "happy", totalFeedings: 0, lastFedAt: null, evolvedAt: null, costumeSlug: null },
    });
  }
}
