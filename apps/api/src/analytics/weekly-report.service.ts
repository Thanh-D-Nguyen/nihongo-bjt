import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class WeeklyReportService {
  private readonly logger = new Logger(WeeklyReportService.name);
  private readonly prisma = createPrismaClient();

  /** Get the most recent weekly report for a user */
  async getLatest(userId: string) {
    try {
      return await this.prisma.weeklyReport.findFirst({
        where: { userId },
        orderBy: { weekStart: "desc" },
      });
    } catch (err) {
      this.logger.error(`getLatest failed for user ${userId}`, err instanceof Error ? err.stack : err);
      return null;
    }
  }

  /** Get report history */
  async getHistory(userId: string, limit = 8) {
    return this.prisma.weeklyReport.findMany({
      where: { userId },
      orderBy: { weekStart: "desc" },
      take: limit,
    });
  }

  /** Generate weekly report for a single user */
  async generateForUser(userId: string, weekStart: Date, weekEnd: Date) {
    // Count reviews in this week
    const reviews = await this.prisma.reviewEvent.count({
      where: {
        userId,
        reviewedAt: { gte: weekStart, lt: weekEnd },
      },
    });

    // Calculate accuracy
    const goodReviews = await this.prisma.reviewEvent.count({
      where: {
        userId,
        reviewedAt: { gte: weekStart, lt: weekEnd },
        rating: { in: ["good", "easy"] },
      },
    });
    const accuracyPct = reviews > 0 ? Math.round((goodReviews / reviews) * 100) : 0;

    // Count quiz sessions
    const quizSessions = await this.prisma.quizSession.count({
      where: {
        userId,
        startedAt: { gte: weekStart, lt: weekEnd },
        status: "completed",
      },
    });

    // Count new cards learned (user_flashcard created this week)
    const newCards = await this.prisma.userFlashcard.count({
      where: {
        userId,
        createdAt: { gte: weekStart, lt: weekEnd },
      },
    });

    // Get streak from gamification
    const streakRecord = await this.prisma.userStreak.findFirst({
      where: { userId },
      orderBy: { currentStreak: "desc" },
    });
    const streakDays = streakRecord?.currentStreak ?? 0;

    // Get weak skills from quiz answers
    const wrongAnswers = await this.prisma.quizAnswer.findMany({
      where: {
        isCorrect: false,
        answeredAt: { gte: weekStart, lt: weekEnd },
        session: { userId },
      },
      include: { question: { select: { skillTag: true } } },
    });
    const skillFails = new Map<string, number>();
    for (const a of wrongAnswers) {
      const tag = a.question.skillTag;
      if (tag) skillFails.set(tag, (skillFails.get(tag) ?? 0) + 1);
    }
    const weakSkills = [...skillFails.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    // Get previous week's report for comparison
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevReport = await this.prisma.weeklyReport.findUnique({
      where: { userId_weekStart: { userId, weekStart: prevWeekStart } },
    });

    // Upsert report
    return this.prisma.weeklyReport.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: {
        userId,
        weekStart,
        weekEnd,
        totalReviews: reviews,
        accuracyPct,
        streakDays,
        quizSessions,
        newCardsLearned: newCards,
        weakSkills,
        prevWeekReviews: prevReport?.totalReviews ?? null,
        prevWeekAccuracy: prevReport?.accuracyPct ?? null,
      },
      update: {
        totalReviews: reviews,
        accuracyPct,
        streakDays,
        quizSessions,
        newCardsLearned: newCards,
        weakSkills,
        prevWeekReviews: prevReport?.totalReviews ?? null,
        prevWeekAccuracy: prevReport?.accuracyPct ?? null,
      },
    });
  }

  /** Batch generate for all active users (called by cron) */
  async generateForAllUsers() {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - weekEnd.getDay()); // Last Sunday
    weekEnd.setHours(0, 0, 0, 0);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    // Get distinct users who had any activity this week
    const activeUsers = await this.prisma.reviewEvent.findMany({
      select: { userId: true },
      where: {
        reviewedAt: { gte: weekStart, lt: weekEnd },
      },
      distinct: ["userId"],
    });

    this.logger.log(`Generating weekly reports for ${activeUsers.length} users`);

    let generated = 0;
    for (const { userId } of activeUsers) {
      try {
        await this.generateForUser(userId, weekStart, weekEnd);
        generated++;
      } catch (e) {
        this.logger.warn(`Failed to generate report for ${userId}: ${e}`);
      }
    }

    return { generated, total: activeUsers.length };
  }
}
