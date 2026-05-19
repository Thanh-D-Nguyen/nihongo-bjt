import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class GamificationRepository {
  private readonly prisma = createPrismaClient();

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Streak Config (admin) ──────────────────────────────────────────── */

  async listStreakConfigs() {
    return this.prisma.streakConfig.findMany({
      orderBy: { createdAt: "asc" }
    });
  }

  async findStreakConfig(id: string) {
    return this.prisma.streakConfig.findUnique({ where: { id } });
  }

  async createStreakConfig(data: {
    name: string;
    activityType: string;
    minActionsPerDay: number;
    freezesAllowed: number;
    enabled: boolean;
    actorId: string;
  }) {
    return this.prisma.streakConfig.create({
      data: {
        name: data.name,
        activityType: data.activityType,
        minActionsPerDay: data.minActionsPerDay,
        freezesAllowed: data.freezesAllowed,
        enabled: data.enabled,
        createdBy: data.actorId,
        updatedBy: data.actorId
      }
    });
  }

  async updateStreakConfig(
    id: string,
    data: {
      name: string;
      activityType: string;
      minActionsPerDay: number;
      freezesAllowed: number;
      enabled: boolean;
      actorId: string;
    }
  ) {
    return this.prisma.streakConfig.update({
      where: { id },
      data: {
        name: data.name,
        activityType: data.activityType,
        minActionsPerDay: data.minActionsPerDay,
        freezesAllowed: data.freezesAllowed,
        enabled: data.enabled,
        updatedBy: data.actorId
      }
    });
  }

  async deleteStreakConfig(id: string) {
    return this.prisma.streakConfig.delete({ where: { id } });
  }

  async enabledStreakConfigs() {
    return this.prisma.streakConfig.findMany({
      where: { enabled: true },
      orderBy: { activityType: "asc" }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── User Streak ────────────────────────────────────────────────────── */

  async findUserStreak(userId: string, streakConfigId: string) {
    return this.prisma.userStreak.findUnique({
      where: {
        userId_streakConfigId: { userId, streakConfigId }
      },
      include: { streakConfig: true }
    });
  }

  async upsertUserStreak(data: {
    userId: string;
    streakConfigId: string;
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: Date | null;
    streakStartDate: Date | null;
    freezesUsed: number;
  }) {
    return this.prisma.userStreak.upsert({
      where: {
        userId_streakConfigId: {
          userId: data.userId,
          streakConfigId: data.streakConfigId
        }
      },
      create: data,
      update: {
        currentStreak: data.currentStreak,
        longestStreak: data.longestStreak,
        lastActivityDate: data.lastActivityDate,
        streakStartDate: data.streakStartDate,
        freezesUsed: data.freezesUsed
      }
    });
  }

  async userStreaks(userId: string) {
    return this.prisma.userStreak.findMany({
      where: { userId },
      include: { streakConfig: true },
      orderBy: { currentStreak: "desc" }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Achievement Definition (admin) ─────────────────────────────────── */

  async listAchievementDefinitions() {
    return this.prisma.achievementDefinition.findMany({
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
      include: {
        tiers: { orderBy: { threshold: "asc" } }
      }
    });
  }

  async findAchievementDefinition(id: string) {
    return this.prisma.achievementDefinition.findUnique({
      where: { id },
      include: { tiers: { orderBy: { threshold: "asc" } } }
    });
  }

  async findAchievementBySlug(slug: string) {
    return this.prisma.achievementDefinition.findUnique({
      where: { slug },
      include: { tiers: { orderBy: { threshold: "asc" } } }
    });
  }

  async createAchievementDefinition(data: {
    slug: string;
    nameKey: string;
    descriptionKey: string;
    category: string;
    metricKey: string;
    iconUrl: string | null;
    displayOrder: number;
    enabled: boolean;
    actorId: string;
  }) {
    return this.prisma.achievementDefinition.create({
      data: {
        slug: data.slug,
        nameKey: data.nameKey,
        descriptionKey: data.descriptionKey,
        category: data.category,
        metricKey: data.metricKey,
        iconUrl: data.iconUrl,
        displayOrder: data.displayOrder,
        enabled: data.enabled,
        createdBy: data.actorId,
        updatedBy: data.actorId
      }
    });
  }

  async updateAchievementDefinition(
    id: string,
    data: {
      slug: string;
      nameKey: string;
      descriptionKey: string;
      category: string;
      metricKey: string;
      iconUrl: string | null;
      displayOrder: number;
      enabled: boolean;
      actorId: string;
    }
  ) {
    return this.prisma.achievementDefinition.update({
      where: { id },
      data: {
        slug: data.slug,
        nameKey: data.nameKey,
        descriptionKey: data.descriptionKey,
        category: data.category,
        metricKey: data.metricKey,
        iconUrl: data.iconUrl,
        displayOrder: data.displayOrder,
        enabled: data.enabled,
        updatedBy: data.actorId
      }
    });
  }

  async deleteAchievementDefinition(id: string) {
    return this.prisma.achievementDefinition.delete({ where: { id } });
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Achievement Tier (admin) ───────────────────────────────────────── */

  async createAchievementTier(
    achievementId: string,
    data: {
      tier: string;
      threshold: number;
      rewardType: string | null;
      rewardValue: string | null;
      iconUrl: string | null;
      nameKey: string | null;
    }
  ) {
    return this.prisma.achievementTier.create({
      data: {
        achievementId,
        tier: data.tier,
        threshold: data.threshold,
        rewardType: data.rewardType,
        rewardValue: data.rewardValue,
        iconUrl: data.iconUrl,
        nameKey: data.nameKey
      }
    });
  }

  async updateAchievementTier(
    id: string,
    data: {
      tier: string;
      threshold: number;
      rewardType: string | null;
      rewardValue: string | null;
      iconUrl: string | null;
      nameKey: string | null;
    }
  ) {
    return this.prisma.achievementTier.update({
      where: { id },
      data
    });
  }

  async deleteAchievementTier(id: string) {
    return this.prisma.achievementTier.delete({ where: { id } });
  }

  async tiersForAchievement(achievementId: string) {
    return this.prisma.achievementTier.findMany({
      where: { achievementId },
      orderBy: { threshold: "asc" }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── User Achievement ───────────────────────────────────────────────── */

  async findUserAchievement(userId: string, tierId: string) {
    return this.prisma.userAchievement.findUnique({
      where: { userId_tierId: { userId, tierId } }
    });
  }

  async upsertUserAchievement(data: {
    userId: string;
    achievementId: string;
    tierId: string;
    currentProgress: number;
    earnedAt: Date | null;
  }) {
    return this.prisma.userAchievement.upsert({
      where: {
        userId_tierId: { userId: data.userId, tierId: data.tierId }
      },
      create: data,
      update: {
        currentProgress: data.currentProgress,
        earnedAt: data.earnedAt
      }
    });
  }

  async userAchievements(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: {
        tier: {
          include: { achievement: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });
  }

  async userEarnedAchievements(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId, earnedAt: { not: null } },
      include: {
        tier: {
          include: { achievement: true }
        }
      },
      orderBy: { earnedAt: "desc" }
    });
  }

  async enabledAchievementDefinitions() {
    return this.prisma.achievementDefinition.findMany({
      where: { enabled: true },
      include: { tiers: { orderBy: { threshold: "asc" } } },
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }]
    });
  }

  /** Generic metric resolver — returns count for any supported metric */
  async resolveMetricValue(userId: string, metricKey: string): Promise<number | null> {
    switch (metricKey) {
      case "exercises_completed":
        return this.prisma.exerciseSession.count({
          where: { userId, completedAt: { not: null } }
        });
      case "words_learned":
        return this.prisma.userFlashcard.count({
          where: { userId, repetitions: { gte: 4 } }
        });
      case "quizzes_completed":
        return this.prisma.quizSession.count({
          where: { userId, completedAt: { not: null } }
        });
      case "battles_won":
        return this.prisma.$queryRaw<[{ count: number }]>`
          SELECT COUNT(*)::int as count FROM learning.battle_session
          WHERE user_id = ${userId}::uuid
            AND completed_at IS NOT NULL
            AND user_score > opponent_score
        `.then(r => Number(r[0]?.count ?? 0));
      case "reviews_completed":
        return this.prisma.reviewEvent.count({
          where: { userId }
        });
      default:
        return null;
    }
  }

  /** Get newly earned achievements not yet shown to user */
  async pendingAchievementNotifications(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId, earnedAt: { not: null }, notifiedAt: null },
      include: { tier: { include: { achievement: true } } },
      orderBy: { earnedAt: "desc" }
    });
  }

  /** Mark achievements as notified */
  async markAchievementsNotified(ids: string[]): Promise<void> {
    await this.prisma.userAchievement.updateMany({
      where: { id: { in: ids } },
      data: { notifiedAt: new Date() }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Leaderboard Config (admin) ─────────────────────────────────────── */

  async listLeaderboardConfigs() {
    return this.prisma.leaderboardConfig.findMany({
      orderBy: [{ period: "asc" }, { metricType: "asc" }]
    });
  }

  async findLeaderboardConfig(id: string) {
    return this.prisma.leaderboardConfig.findUnique({ where: { id } });
  }

  async createLeaderboardConfig(data: {
    name: string;
    nameKey: string | null;
    metricType: string;
    period: string;
    maxEntries: number;
    enabled: boolean;
    actorId: string;
  }) {
    return this.prisma.leaderboardConfig.create({
      data: {
        name: data.name,
        nameKey: data.nameKey,
        metricType: data.metricType,
        period: data.period,
        maxEntries: data.maxEntries,
        enabled: data.enabled,
        createdBy: data.actorId,
        updatedBy: data.actorId
      }
    });
  }

  async updateLeaderboardConfig(
    id: string,
    data: {
      name: string;
      nameKey: string | null;
      metricType: string;
      period: string;
      maxEntries: number;
      enabled: boolean;
      actorId: string;
    }
  ) {
    return this.prisma.leaderboardConfig.update({
      where: { id },
      data: {
        name: data.name,
        nameKey: data.nameKey,
        metricType: data.metricType,
        period: data.period,
        maxEntries: data.maxEntries,
        enabled: data.enabled,
        updatedBy: data.actorId
      }
    });
  }

  async deleteLeaderboardConfig(id: string) {
    return this.prisma.leaderboardConfig.delete({ where: { id } });
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Leaderboard Entries ────────────────────────────────────────────── */

  async leaderboardEntries(
    leaderboardId: string,
    periodStart: Date,
    limit: number
  ) {
    // TODO: Add user relation include once LeaderboardEntry has a UserProfile relation in schema
    return this.prisma.leaderboardEntry.findMany({
      where: { leaderboardId, periodStart },
      orderBy: { rank: "asc" },
      take: limit
    });
  }

  /** Recompute ranks for a leaderboard period using window function */
  async recomputeLeaderboardRanks(leaderboardId: string, periodStart: Date): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE gamification.leaderboard_entry le
      SET rank = ranked.new_rank, computed_at = NOW()
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC) as new_rank
        FROM gamification.leaderboard_entry
        WHERE leaderboard_id = ${leaderboardId}::uuid
          AND period_start = ${periodStart}
      ) ranked
      WHERE le.id = ranked.id
    `;
  }

  async upsertLeaderboardEntry(data: {
    leaderboardId: string;
    userId: string;
    rank: number;
    score: number;
    periodStart: Date;
    periodEnd: Date;
  }) {
    return this.prisma.leaderboardEntry.upsert({
      where: {
        leaderboardId_userId_periodStart: {
          leaderboardId: data.leaderboardId,
          userId: data.userId,
          periodStart: data.periodStart
        }
      },
      create: data,
      update: {
        rank: data.rank,
        score: data.score,
        computedAt: new Date()
      }
    });
  }

  async userLeaderboardRank(
    leaderboardId: string,
    userId: string,
    periodStart: Date
  ) {
    return this.prisma.leaderboardEntry.findUnique({
      where: {
        leaderboardId_userId_periodStart: {
          leaderboardId,
          userId,
          periodStart
        }
      }
    });
  }

  async enabledLeaderboardConfigs() {
    return this.prisma.leaderboardConfig.findMany({
      where: { enabled: true },
      orderBy: [{ period: "asc" }, { metricType: "asc" }]
    });
  }
}
