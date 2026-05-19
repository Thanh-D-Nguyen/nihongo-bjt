import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";

import { GamificationRepository } from "./gamification.repository.js";

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);
  private readonly recentActivity = new Map<string, number>();

  constructor(
    @Inject(GamificationRepository) private readonly repo: GamificationRepository
  ) {}

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Streak Engine ──────────────────────────────────────────────────── */

  /**
   * Record an activity and update all relevant streaks for a user.
   * Called from exercise/quiz/review/battle completion hooks.
   */
  async recordActivity(userId: string, activityType: string): Promise<void> {
    const dedupKey = `${userId}:${activityType}`;
    const lastTime = this.recentActivity.get(dedupKey) ?? 0;
    if (Date.now() - lastTime < 5000) return; // Dedup same activity within 5s
    this.recentActivity.set(dedupKey, Date.now());

    const configs = await this.repo.enabledStreakConfigs();
    const today = startOfDay(new Date());

    for (const config of configs) {
      // Match activity type or "any"
      if (config.activityType !== "any" && config.activityType !== activityType) {
        continue;
      }

      const existing = await this.repo.findUserStreak(userId, config.id);

      if (!existing) {
        // First activity ever for this streak config
        await this.repo.upsertUserStreak({
          userId,
          streakConfigId: config.id,
          currentStreak: 1,
          longestStreak: 1,
          lastActivityDate: today,
          streakStartDate: today,
          freezesUsed: 0
        });
        continue;
      }

      const lastDate = existing.lastActivityDate
        ? startOfDay(existing.lastActivityDate)
        : null;

      // Already counted today
      if (lastDate && lastDate.getTime() === today.getTime()) {
        continue;
      }

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastDate && lastDate.getTime() === yesterday.getTime()) {
        // Consecutive day → extend streak
        const newStreak = existing.currentStreak + 1;
        await this.repo.upsertUserStreak({
          userId,
          streakConfigId: config.id,
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, existing.longestStreak),
          lastActivityDate: today,
          streakStartDate: existing.streakStartDate,
          freezesUsed: existing.freezesUsed
        });
      } else if (lastDate) {
        // Streak broken — check if freeze is available
        const daysMissed = Math.floor(
          (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        ) - 1;

        const freezesRemaining =
          config.freezesAllowed - existing.freezesUsed;

        if (daysMissed <= freezesRemaining && daysMissed > 0) {
          // Use freezes to bridge the gap
          const newStreak = existing.currentStreak + 1;
          await this.repo.upsertUserStreak({
            userId,
            streakConfigId: config.id,
            currentStreak: newStreak,
            longestStreak: Math.max(newStreak, existing.longestStreak),
            lastActivityDate: today,
            streakStartDate: existing.streakStartDate,
            freezesUsed: existing.freezesUsed + daysMissed
          });
        } else {
          // Streak broken, restart
          await this.repo.upsertUserStreak({
            userId,
            streakConfigId: config.id,
            currentStreak: 1,
            longestStreak: existing.longestStreak,
            lastActivityDate: today,
            streakStartDate: today,
            freezesUsed: 0
          });
        }
      } else {
        // No previous date at all
        await this.repo.upsertUserStreak({
          userId,
          streakConfigId: config.id,
          currentStreak: 1,
          longestStreak: Math.max(1, existing.longestStreak),
          lastActivityDate: today,
          streakStartDate: today,
          freezesUsed: 0
        });
      }
    }

    // After recording streaks, check for achievement progress
    await this.checkAchievementProgress(userId);
  }

  /** Get all streak data for a user. */
  async getUserStreaks(userId: string) {
    return this.repo.userStreaks(userId);
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Achievement Engine ─────────────────────────────────────────────── */

  /**
   * Check all achievement definitions and update user progress.
   * In a production system this would read from an event/metric store;
   * here we use streak data as the metric source for streak-based achievements.
   */
  async checkAchievementProgress(userId: string): Promise<void> {
    const definitions = await this.repo.enabledAchievementDefinitions();
    const streaks = await this.repo.userStreaks(userId);

    for (const def of definitions) {
      let metricValue: number;

      // Resolve metric value based on metricKey
      switch (def.metricKey) {
        case "streak_days": {
          // Use the highest current streak across all streak configs
          const maxStreak = streaks.reduce(
            (max, s) => Math.max(max, s.currentStreak),
            0
          );
          metricValue = maxStreak;
          break;
        }
        case "longest_streak": {
          const maxLongest = streaks.reduce(
            (max, s) => Math.max(max, s.longestStreak),
            0
          );
          metricValue = maxLongest;
          break;
        }
        // For other metrics (words_learned, exercises_completed, battles_won, etc.)
        // resolve from actual database tables.
        default: {
          const resolved = await this.repo.resolveMetricValue(userId, def.metricKey);
          if (resolved === null) continue;
          metricValue = resolved;
          break;
        }
      }

      // Check each tier
      for (const tier of def.tiers) {
        const existing = await this.repo.findUserAchievement(userId, tier.id);

        if (existing?.earnedAt) {
          // Already earned this tier, skip
          continue;
        }

        const earned = metricValue >= tier.threshold;

        await this.repo.upsertUserAchievement({
          userId,
          achievementId: def.id,
          tierId: tier.id,
          currentProgress: metricValue,
          earnedAt: earned ? new Date() : null
        });
      }
    }
  }

  /**
   * Increment a specific metric for achievement tracking.
   * Called from domain services when a countable event happens.
   */
  async incrementMetric(
    userId: string,
    metricKey: string,
    increment: number = 1
  ): Promise<void> {
    const definitions = await this.repo.enabledAchievementDefinitions();
    const matching = definitions.filter((d) => d.metricKey === metricKey);

    for (const def of matching) {
      for (const tier of def.tiers) {
        const existing = await this.repo.findUserAchievement(userId, tier.id);

        if (existing?.earnedAt) continue;

        const newProgress = (existing?.currentProgress ?? 0) + increment;
        const earned = newProgress >= tier.threshold;

        await this.repo.upsertUserAchievement({
          userId,
          achievementId: def.id,
          tierId: tier.id,
          currentProgress: newProgress,
          earnedAt: earned ? new Date() : null
        });
      }
    }
  }

  /** Get all achievements for a user (both earned and in-progress). */
  async getUserAchievements(userId: string) {
    return this.repo.userAchievements(userId);
  }

  /** Get only earned achievements for a user (for display/share). */
  async getUserEarnedAchievements(userId: string) {
    return this.repo.userEarnedAchievements(userId);
  }

  /** Get all achievement definitions with tiers (for learner browse). */
  async getAllAchievementDefinitions() {
    return this.repo.enabledAchievementDefinitions();
  }

  /** Browse all achievements with user progress overlay. */
  async browseAllAchievements(userId: string) {
    const definitions = await this.repo.enabledAchievementDefinitions();
    const userProgress = await this.repo.userAchievements(userId);
    const progressMap = new Map(userProgress.map((p: any) => [p.tierId, p]));

    return definitions.map((def: any) => ({
      ...def,
      tiers: def.tiers.map((tier: any) => ({
        ...tier,
        userProgress: progressMap.get(tier.id) ?? null
      }))
    }));
  }

  /** Get newly earned achievements not yet shown to user. */
  async getPendingNotifications(userId: string) {
    return this.repo.pendingAchievementNotifications(userId);
  }

  /** Mark achievements as acknowledged/shown. */
  async acknowledgeNotifications(userId: string, ids: string[]) {
    const pending = await this.repo.pendingAchievementNotifications(userId);
    const validIds = pending.map((p: any) => p.id).filter((id: string) => ids.includes(id));
    if (validIds.length > 0) await this.repo.markAchievementsNotified(validIds);
    return { acknowledged: validIds.length };
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Leaderboard Engine ─────────────────────────────────────────────── */

  /** Get leaderboard entries for a specific board and period. */
  async getLeaderboard(leaderboardId: string, periodStart?: Date) {
    const config = await this.repo.findLeaderboardConfig(leaderboardId);
    if (!config) throw new NotFoundException("Leaderboard not found");

    const start = periodStart ?? computePeriodStart(config.period);

    const entries = await this.repo.leaderboardEntries(
      leaderboardId,
      start,
      config.maxEntries
    );

    return {
      leaderboard: config,
      periodStart: start,
      entries
    };
  }

  /** Get a user's rank on a specific leaderboard. */
  async getUserRank(leaderboardId: string, userId: string, periodStart?: Date) {
    const config = await this.repo.findLeaderboardConfig(leaderboardId);
    if (!config) throw new NotFoundException("Leaderboard not found");

    const start = periodStart ?? computePeriodStart(config.period);
    return this.repo.userLeaderboardRank(leaderboardId, userId, start);
  }

  /** List all enabled leaderboards (for learner browse). */
  async getEnabledLeaderboards() {
    return this.repo.enabledLeaderboardConfigs();
  }

  /**
   * Update a user's score on a leaderboard.
   * In production this would be called by a BullMQ job that recomputes ranks.
   * Exposed here for direct updates from game events.
   */
  async updateLeaderboardScore(data: {
    leaderboardId: string;
    userId: string;
    scoreDelta: number;
  }) {
    const config = await this.repo.findLeaderboardConfig(data.leaderboardId);
    if (!config) throw new NotFoundException("Leaderboard not found");

    const start = computePeriodStart(config.period);
    const end = computePeriodEnd(config.period, start);

    const existing = await this.repo.userLeaderboardRank(
      data.leaderboardId,
      data.userId,
      start
    );

    const newScore = (existing?.score ?? 0) + data.scoreDelta;

    await this.repo.upsertLeaderboardEntry({
      leaderboardId: data.leaderboardId,
      userId: data.userId,
      rank: 0, // Rank will be recomputed
      score: newScore,
      periodStart: start,
      periodEnd: end
    });

    await this.repo.recomputeLeaderboardRanks(data.leaderboardId, start);
  }
}

/* ── Date Helpers ──────────────────────────────────────────────────────── */

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computePeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "daily":
      return startOfDay(now);
    case "weekly": {
      const d = startOfDay(now);
      d.setDate(d.getDate() - d.getDay()); // Sunday start
      return d;
    }
    case "monthly": {
      const d = startOfDay(now);
      d.setDate(1);
      return d;
    }
    case "all_time":
      return new Date("2024-01-01T00:00:00.000Z");
    default:
      return startOfDay(now);
  }
}

function computePeriodEnd(period: string, start: Date): Date {
  const end = new Date(start);
  switch (period) {
    case "daily":
      end.setDate(end.getDate() + 1);
      break;
    case "weekly":
      end.setDate(end.getDate() + 7);
      break;
    case "monthly":
      end.setMonth(end.getMonth() + 1);
      break;
    case "all_time":
      end.setFullYear(2099);
      break;
  }
  return end;
}
