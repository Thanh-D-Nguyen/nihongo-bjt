import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable, Logger, BadRequestException, Inject } from "@nestjs/common";
import { SeasonalEventService } from "./seasonal-event.service.js";

@Injectable()
export class StudyTimerService {
  private readonly logger = new Logger(StudyTimerService.name);
  private readonly prisma = createPrismaClient();

  constructor(
    @Inject(SeasonalEventService) private readonly seasonalEventService: SeasonalEventService,
  ) {}

  /** Start a new focus session */
  async startSession(userId: string, durationMinutes: number, mode = "focus") {
    if (durationMinutes < 5 || durationMinutes > 120) {
      throw new BadRequestException("Duration must be 5-120 minutes");
    }

    // Auto-close any uncompleted sessions
    await this.prisma.studySession.updateMany({
      where: { userId, completed: false },
      data: { completed: false, endedAt: new Date() },
    });

    return this.prisma.studySession.create({
      data: { userId, durationMinutes, mode },
    });
  }

  /** End a session (completed or abandoned) */
  async endSession(
    userId: string,
    sessionId: string,
    completed: boolean,
    stats?: { reviewsDone?: number; quizzesDone?: number; xpEarned?: number },
  ) {
    const session = await this.prisma.studySession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new BadRequestException("Session not found");

    const updated = await this.prisma.studySession.update({
      where: { id: sessionId },
      data: {
        completed,
        endedAt: new Date(),
        reviewsDone: stats?.reviewsDone ?? session.reviewsDone,
        quizzesDone: stats?.quizzesDone ?? session.quizzesDone,
        xpEarned: stats?.xpEarned ?? session.xpEarned,
      },
    });

    // Fire-and-forget: update seasonal event progress for focus time
    if (completed) {
      this.seasonalEventService.updateProgress(userId, "focus_minutes", session.durationMinutes).catch((e) =>
        this.logger.warn("Seasonal progress update failed", e instanceof Error ? e.message : e),
      );
    }

    return updated;
  }

  /** Get today's study stats */
  async getTodayStats(userId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sessions = await this.prisma.studySession.findMany({
      where: { userId, startedAt: { gte: todayStart } },
      orderBy: { startedAt: "desc" },
    });

    const completedSessions = sessions.filter((s) => s.completed);
    const totalMinutes = completedSessions.reduce(
      (sum, s) => sum + s.durationMinutes,
      0,
    );
    const totalReviews = completedSessions.reduce(
      (sum, s) => sum + s.reviewsDone,
      0,
    );
    const totalXp = completedSessions.reduce(
      (sum, s) => sum + s.xpEarned,
      0,
    );

    const activeSession = sessions.find((s) => !s.endedAt);

    return {
      todayMinutes: totalMinutes,
      todaySessions: completedSessions.length,
      todayReviews: totalReviews,
      todayXp: totalXp,
      activeSession: activeSession
        ? {
            id: activeSession.id,
            mode: activeSession.mode,
            durationMinutes: activeSession.durationMinutes,
            startedAt: activeSession.startedAt,
          }
        : null,
    };
  }

  /** Get weekly study time totals */
  async getWeeklyStats(userId: string) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const sessions = await this.prisma.studySession.findMany({
      where: {
        userId,
        completed: true,
        startedAt: { gte: weekStart },
      },
    });

    const totalMinutes = sessions.reduce(
      (sum, s) => sum + s.durationMinutes,
      0,
    );
    const totalSessions = sessions.length;

    const dailyMap = new Map<string, number>();
    for (const s of sessions) {
      const dayKey = s.startedAt.toISOString().slice(0, 10);
      dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + s.durationMinutes);
    }
    const dailyBreakdown = [...dailyMap.entries()].map(([date, minutes]) => ({
      date,
      minutes,
    }));

    return { totalMinutes, totalSessions, dailyBreakdown };
  }

  /** Recent session history */
  async getHistory(userId: string, limit = 10) {
    return this.prisma.studySession.findMany({
      where: { userId, completed: true },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }
}
