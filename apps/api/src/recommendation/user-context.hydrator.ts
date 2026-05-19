import { Injectable, Logger } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

import type { UserContext } from "./pipeline/types.js";

/**
 * Hydrates UserContext from DB — equivalent to X's QueryHydrators.
 * Fetches engagement history, weak areas, enrolled topics, level, served history.
 * Falls back to onboarding preferences for cold-start users.
 */
@Injectable()
export class UserContextHydrator {
  private readonly logger = new Logger(UserContextHydrator.name);
  private readonly prisma = createPrismaClient();

  async hydrate(userId: string): Promise<UserContext> {
    const [engagement, weakSkills, enrolledTopics, level, recentlyServed, completedToday, streak, onboarding] =
      await Promise.all([
        this.fetchRecentEngagement(userId),
        this.fetchWeakSkills(userId),
        this.fetchEnrolledTopics(userId),
        this.estimateLevel(userId),
        this.fetchRecentlyServed(userId),
        this.fetchCompletedToday(userId),
        this.fetchCurrentStreak(userId),
        this.fetchOnboardingPreferences(userId),
      ]);

    // Cold start: use onboarding preferences if user has little activity data
    const totalEngagement = Object.values(engagement).reduce((s, v) => s + v, 0);
    const isColdStart = totalEngagement < 10;

    return {
      userId,
      recentEngagement: engagement,
      weakSkills,
      enrolledTopics: isColdStart && onboarding?.topics?.length
        ? onboarding.topics
        : enrolledTopics,
      estimatedLevel: isColdStart && onboarding?.currentLevel
        ? onboarding.currentLevel
        : level,
      recentlyServed: new Set(recentlyServed),
      completedToday: new Set(completedToday),
      currentStreak: streak,
    };
  }

  private async fetchRecentEngagement(userId: string): Promise<Record<string, number>> {
    const since = new Date();
    since.setDate(since.getDate() - 14);

    try {
      const rows = await this.prisma.$queryRawUnsafe<{ event_name: string; cnt: bigint }[]>(
        `SELECT event_name, COUNT(*)::bigint as cnt
         FROM analytics.analytics_event
         WHERE user_id = $1::uuid AND created_at >= $2
         GROUP BY event_name`,
        userId,
        since,
      );
      const map: Record<string, number> = {};
      for (const r of rows) map[r.event_name] = Number(r.cnt);
      return map;
    } catch {
      return {};
    }
  }

  private async fetchWeakSkills(userId: string): Promise<string[]> {
    try {
      // Find exercise tags where accuracy < 60% in recent sessions
      // exercise_answer → exercise_session (has user_id) → exercise (has tags[])
      const rows = await this.prisma.$queryRawUnsafe<{ tag: string }[]>(
        `WITH user_answers AS (
           SELECT ea.exercise_id, ea.is_correct
           FROM exercise.exercise_answer ea
           JOIN exercise.exercise_session es ON es.id = ea.session_id
           WHERE es.user_id = $1::uuid
             AND ea.answered_at >= NOW() - INTERVAL '30 days'
         )
         SELECT t.tag
         FROM user_answers ua
         JOIN exercise.exercise e ON e.id = ua.exercise_id,
         LATERAL unnest(e.tags) AS t(tag)
         WHERE array_length(e.tags, 1) > 0
         GROUP BY t.tag
         HAVING AVG(CASE WHEN ua.is_correct THEN 1.0 ELSE 0.0 END) < 0.6`,
        userId,
      );
      return rows.map((r) => r.tag);
    } catch {
      return [];
    }
  }

  private async fetchEnrolledTopics(userId: string): Promise<string[]> {
    try {
      // Use bookmark target_types as interest signals
      const rows = await this.prisma.$queryRawUnsafe<{ target_type: string }[]>(
        `SELECT DISTINCT target_type
         FROM learning.bookmark
         WHERE user_id = $1::uuid
         LIMIT 20`,
        userId,
      );
      return rows.map((r) => r.target_type).filter(Boolean);
    } catch {
      return [];
    }
  }

  private async estimateLevel(userId: string): Promise<number> {
    try {
      // Use latest quiz session's estimated_bjt_band, map to numeric
      const row = await this.prisma.$queryRawUnsafe<{ band: string | null }[]>(
        `SELECT estimated_bjt_band as band
         FROM assessment.quiz_session
         WHERE user_id = $1::uuid
           AND status = 'completed'
           AND estimated_bjt_band IS NOT NULL
         ORDER BY started_at DESC LIMIT 1`,
        userId,
      );
      if (row.length > 0 && row[0].band) {
        return UserContextHydrator.bjtBandToLevel(row[0].band);
      }
      return 3; // default N3
    } catch {
      return 3;
    }
  }

  /** Convert BJT band (J5/J4/J3/J2/J1) or JLPT level (N5/N4/N3/N2/N1) to numeric level (5/4/3/2/1) */
  static bjtBandToLevel(band: string): number {
    const map: Record<string, number> = {
      J5: 5, J4: 4, J3: 3, J2: 2, J1: 1, "J1+": 1,
      N5: 5, N4: 4, N3: 3, N2: 2, N1: 1,
    };
    return map[band] ?? 3;
  }

  /** Convert numeric level to BJT levelCode for curriculum queries */
  static levelToCode(level: number): string {
    const map: Record<number, string> = { 5: "J5", 4: "J4", 3: "J3", 2: "J2", 1: "J1" };
    return map[level] ?? "J3";
  }

  private async fetchRecentlyServed(userId: string): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ item_id: string }[]>(
        `SELECT item_id FROM recommendation.served_item
         WHERE user_id = $1::uuid AND served_at >= NOW() - INTERVAL '24 hours'`,
        userId,
      );
      return rows.map((r) => r.item_id);
    } catch {
      return [];
    }
  }

  private async fetchCompletedToday(userId: string): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ item_id: string }[]>(
        `SELECT DISTINCT ea.exercise_id::text as item_id
         FROM exercise.exercise_answer ea
         JOIN exercise.exercise_session es ON es.id = ea.session_id
         WHERE es.user_id = $1::uuid AND ea.answered_at >= CURRENT_DATE
         UNION
         SELECT DISTINCT re.user_flashcard_id::text as item_id
         FROM learning.review_event re
         WHERE re.user_id = $1::uuid AND re.reviewed_at >= CURRENT_DATE`,
        userId,
      );
      return rows.map((r) => r.item_id);
    } catch {
      return [];
    }
  }

  private async fetchCurrentStreak(userId: string): Promise<number> {
    try {
      const row = await this.prisma.$queryRawUnsafe<{ streak: number }[]>(
        `SELECT COALESCE(MAX(current_streak), 0) as streak
         FROM gamification.user_streak
         WHERE user_id = $1::uuid`,
        userId,
      );
      return row[0]?.streak ?? 0;
    } catch {
      return 0;
    }
  }

  private async fetchOnboardingPreferences(
    userId: string,
  ): Promise<{ currentLevel: number; topics: string[] } | null> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        { current_level: number; topics: string[] }[]
      >(
        `SELECT current_level, topics
         FROM recommendation.onboarding_preferences
         WHERE user_id = $1::uuid AND completed = true`,
        userId,
      );
      if (rows.length === 0) return null;
      return { currentLevel: rows[0].current_level, topics: rows[0].topics };
    } catch {
      return null;
    }
  }
}
