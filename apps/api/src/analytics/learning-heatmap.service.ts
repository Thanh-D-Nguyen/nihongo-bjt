import { Injectable } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

export interface HeatmapDay {
  date: string; // "YYYY-MM-DD"
  reviews: number;
  quizzes: number;
  focusMinutes: number;
  total: number; // weighted activity score
  level: 0 | 1 | 2 | 3 | 4; // intensity bucket for color
}

export interface HeatmapResult {
  days: HeatmapDay[];
  totalDaysActive: number;
  longestStreak: number;
  currentStreak: number;
}

@Injectable()
export class LearningHeatmapService {
  private readonly prisma = createPrismaClient();

  async getHeatmap(userId: string, days = 365): Promise<HeatmapResult> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const [reviewsByDay, quizzesByDay, focusByDay] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ day: string; count: bigint }[]>(
        `SELECT DATE(reviewed_at AT TIME ZONE 'UTC') as day, COUNT(*)::bigint as count
         FROM learning.review_event
         WHERE user_id = $1::uuid AND reviewed_at >= $2
         GROUP BY day ORDER BY day`,
        userId,
        startDate,
      ),
      this.prisma.$queryRawUnsafe<{ day: string; count: bigint }[]>(
        `SELECT DATE(started_at AT TIME ZONE 'UTC') as day, COUNT(*)::bigint as count
         FROM assessment.quiz_session
         WHERE user_id = $1::uuid AND started_at >= $2 AND status = 'completed'
         GROUP BY day ORDER BY day`,
        userId,
        startDate,
      ),
      this.prisma.$queryRawUnsafe<{ day: string; minutes: string }[]>(
        `SELECT DATE(started_at AT TIME ZONE 'UTC') as day, SUM(duration_minutes)::text as minutes
         FROM learning.study_session
         WHERE user_id = $1::uuid AND started_at >= $2 AND completed = true
         GROUP BY day ORDER BY day`,
        userId,
        startDate,
      ),
    ]);

    // Build lookup maps
    const reviewMap = new Map(reviewsByDay.map((r) => [String(r.day).slice(0, 10), Number(r.count)]));
    const quizMap = new Map(quizzesByDay.map((r) => [String(r.day).slice(0, 10), Number(r.count)]));
    const focusMap = new Map(focusByDay.map((r) => [String(r.day).slice(0, 10), Number(r.minutes)]));

    // Build day array
    const heatmapDays: HeatmapDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const reviews = reviewMap.get(dateStr) ?? 0;
      const quizzes = quizMap.get(dateStr) ?? 0;
      const focusMinutes = focusMap.get(dateStr) ?? 0;
      const total = reviews + quizzes * 5 + focusMinutes;

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (total >= 50) level = 4;
      else if (total >= 25) level = 3;
      else if (total >= 10) level = 2;
      else if (total > 0) level = 1;

      heatmapDays.push({ date: dateStr, reviews, quizzes, focusMinutes, total, level });
    }

    // Longest streak
    let longestStreak = 0;
    let streak = 0;
    for (const day of heatmapDays) {
      if (day.total > 0) {
        streak++;
        longestStreak = Math.max(longestStreak, streak);
      } else {
        streak = 0;
      }
    }

    // Current streak: consecutive active days from today backwards
    let currentStreak = 0;
    for (let i = heatmapDays.length - 1; i >= 0; i--) {
      if (heatmapDays[i].total > 0) currentStreak++;
      else break;
    }

    const totalDaysActive = heatmapDays.filter((d) => d.total > 0).length;

    return { days: heatmapDays, totalDaysActive, longestStreak, currentStreak };
  }
}
