import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

@Injectable()
export class SeasonalEventService {
  private readonly logger = new Logger(SeasonalEventService.name);
  private readonly prisma = createPrismaClient();

  /** Get active events (currently running) */
  async getActiveEvents() {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return await this.prisma.seasonalEvent.findMany({
        where: {
          active: true,
          startDate: { lte: today },
          endDate: { gte: today },
        },
        include: {
          challenges: { orderBy: { sortOrder: "asc" } },
          _count: { select: { participants: true } },
        },
        orderBy: { endDate: "asc" },
      });
    } catch (err) {
      this.logger.error("getActiveEvents failed", err instanceof Error ? err.stack : err);
      return [];
    }
  }

  /** Get event detail with user progress */
  async getEventWithProgress(eventId: string, userId: string) {
    const event = await this.prisma.seasonalEvent.findUnique({
      where: { id: eventId },
      include: {
        challenges: { orderBy: { sortOrder: "asc" } },
        _count: { select: { participants: true } },
      },
    });
    if (!event) throw new NotFoundException("Event not found");

    const participant = await this.prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    const progress = await this.prisma.eventChallengeProgress.findMany({
      where: {
        userId,
        challengeId: { in: event.challenges.map((c) => c.id) },
      },
    });
    const progressMap = new Map(progress.map((p) => [p.challengeId, p]));

    return {
      ...event,
      joined: !!participant,
      participantCount: event._count.participants,
      challenges: event.challenges.map((c) => ({
        ...c,
        currentValue: progressMap.get(c.id)?.currentValue ?? 0,
        completed: progressMap.get(c.id)?.completed ?? false,
        completedAt: progressMap.get(c.id)?.completedAt ?? null,
      })),
      daysRemaining: Math.max(
        0,
        Math.ceil((new Date(event.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      ),
    };
  }

  /** Join an event */
  async joinEvent(eventId: string, userId: string) {
    const event = await this.prisma.seasonalEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException("Event not found");
    if (!event.active) throw new BadRequestException("Event not active");

    const now = new Date();
    if (now > new Date(event.endDate)) throw new BadRequestException("Event has ended");

    return this.prisma.eventParticipant.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId },
      update: {},
    });
  }

  /** Update challenge progress for a user across all active joined events */
  async updateProgress(userId: string, challengeType: string, incrementValue: number) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const joined = await this.prisma.eventParticipant.findMany({
      where: {
        userId,
        event: { active: true, startDate: { lte: today }, endDate: { gte: today } },
      },
      select: { eventId: true },
    });
    if (joined.length === 0) return [];

    const challenges = await this.prisma.eventChallenge.findMany({
      where: {
        eventId: { in: joined.map((j) => j.eventId) },
        challengeType,
      },
    });

    const results = [];
    for (const challenge of challenges) {
      const progress = await this.prisma.eventChallengeProgress.upsert({
        where: { challengeId_userId: { challengeId: challenge.id, userId } },
        create: { challengeId: challenge.id, userId, currentValue: incrementValue },
        update: { currentValue: { increment: incrementValue } },
      });

      if (!progress.completed && progress.currentValue >= challenge.targetValue) {
        await this.prisma.eventChallengeProgress.update({
          where: { id: progress.id },
          data: { completed: true, completedAt: new Date() },
        });
        results.push({ challengeId: challenge.id, completed: true, rewardXp: challenge.rewardXp });
      }
    }

    return results;
  }

  /** Set absolute progress value (for non-incremental metrics like streak_days) */
  async setAbsoluteProgress(userId: string, challengeType: string, absoluteValue: number) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const joined = await this.prisma.eventParticipant.findMany({
      where: {
        userId,
        event: { active: true, startDate: { lte: today }, endDate: { gte: today } },
      },
      select: { eventId: true },
    });
    if (joined.length === 0) return;

    const challenges = await this.prisma.eventChallenge.findMany({
      where: {
        eventId: { in: joined.map((j) => j.eventId) },
        challengeType,
      },
    });

    for (const challenge of challenges) {
      const progress = await this.prisma.eventChallengeProgress.upsert({
        where: { challengeId_userId: { challengeId: challenge.id, userId } },
        create: { challengeId: challenge.id, userId, currentValue: absoluteValue },
        update: { currentValue: absoluteValue },
      });

      if (!progress.completed && progress.currentValue >= challenge.targetValue) {
        await this.prisma.eventChallengeProgress.update({
          where: { id: progress.id },
          data: { completed: true, completedAt: new Date() },
        });
      }
    }
  }
}
