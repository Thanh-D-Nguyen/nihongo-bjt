import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

function hoursSince(when: Date | null | undefined, now: Date): number | null {
  if (!when) {
    return null;
  }
  return (now.getTime() - when.getTime()) / 3_600_000;
}

@Injectable()
export class CompanionHintRepository {
  private readonly prisma = createPrismaClient();

  studyRecency(userId: string, now = new Date()) {
    return Promise.all([
      this.prisma.reviewEvent.findFirst({
        orderBy: { reviewedAt: "desc" },
        select: { reviewedAt: true },
        where: { userId }
      }),
      this.prisma.quizSession.findFirst({
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
        where: { userId }
      }),
      this.prisma.battleSession.findFirst({
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
        where: {
          OR: [{ userId }, { opponentUserId: userId }],
          completedAt: { not: null },
          status: "completed"
        }
      })
    ]).then(([lastReview, lastQuiz, lastBattle]) => ({
      hoursSinceLastBattle: hoursSince(lastBattle?.completedAt ?? null, now),
      hoursSinceLastQuiz: hoursSince(lastQuiz?.startedAt ?? null, now),
      hoursSinceLastReview: hoursSince(lastReview?.reviewedAt ?? null, now)
    }));
  }
}
