import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { shuffleDeterministic } from "@nihongo-bjt/shared";
import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

export const PLACEMENT_QUESTION_COUNT = 5;

@Injectable()
export class LearnerRepository {
  private readonly prisma = createPrismaClient();

  findOnboarding(userId: string) {
    return this.prisma.learnerOnboarding.findUnique({
      include: { placement: true },
      where: { userId }
    });
  }

  upsertOnboardingEntry(userId: string) {
    return this.prisma.learnerOnboarding.upsert({
      create: { currentStep: "not_started", userId },
      update: {},
      where: { userId }
    });
  }

  loadQuestionPool() {
    return this.prisma.bjtQuestion.findMany({
      include: { options: { orderBy: { optionKey: "asc" } } },
      take: 200,
      where: {
        status: "published",
        section: { test: { status: "published" } }
      }
    });
  }

  createPlacementSession(input: { fairnessSeed: string; questionIds: string[]; userId: string }) {
    return this.prisma.placementTestSession.create({
      data: {
        fairnessSeed: input.fairnessSeed,
        questionIds: input.questionIds as unknown as Prisma.InputJsonValue,
        userId: input.userId
      }
    });
  }

  linkOnboardingPlacement(userId: string, placementSessionId: string, step: string) {
    return this.prisma.learnerOnboarding.update({
      data: {
        currentStep: step,
        placementTestSessionId: placementSessionId
      },
      where: { userId }
    });
  }

  getPlacementSession(sessionId: string, userId: string) {
    return this.prisma.placementTestSession.findFirst({
      where: { id: sessionId, userId }
    });
  }

  completePlacement(input: {
    completedAt: Date;
    correctCount: number;
    estimatedBjtBand: string;
    onboardingStep: string;
    onboardedAt: Date | null;
    questionIds: string[];
    sessionId: string;
    userId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.placementTestSession.update({
        data: {
          completedAt: input.completedAt,
          correctCount: input.correctCount,
          estimatedBjtBand: input.estimatedBjtBand,
          status: "completed"
        },
        where: { id: input.sessionId }
      });

      await tx.learnerOnboarding.update({
        data: {
          currentStep: input.onboardingStep,
          onboardedAt: input.onboardedAt,
          placementTestSessionId: input.sessionId
        },
        where: { userId: input.userId }
      });

      const updated = await tx.userProfile.updateMany({
        data: { targetBjtBand: input.estimatedBjtBand },
        where: { id: input.userId, status: "active" }
      });

      await tx.inAppNotification.create({
        data: {
          kind: "placement_complete",
          payload: {
            correctCount: input.correctCount,
            estimatedBjtBand: input.estimatedBjtBand,
            totalQuestions: input.questionIds.length
          } as Prisma.InputJsonValue,
          userId: input.userId
        }
      });

      await tx.analyticsEvent.create({
        data: {
          eventName: "learner_placement_completed",
          payload: {
            correctCount: input.correctCount,
            estimatedBjtBand: input.estimatedBjtBand,
            sessionId: input.sessionId,
            totalQuestions: input.questionIds.length
          } as Prisma.InputJsonValue,
          source: "api",
          userId: input.userId
        }
      });

      return { profileRowsUpdated: updated.count };
    });
  }

  getOrCreateNotificationPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      create: { userId },
      update: {},
      where: { userId }
    });
  }

  updateNotificationPreferences(
    userId: string,
    data: Partial<{
      emailEnabled: boolean;
      inAppEnabled: boolean;
      productNewsEnabled: boolean;
      studyRemindersEnabled: boolean;
    }>
  ) {
    return this.prisma.notificationPreference.upsert({
      create: { userId, ...data },
      update: data,
      where: { userId }
    });
  }

  listInAppNotifications(userId: string, limit: number) {
    return this.prisma.inAppNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      where: { userId }
    });
  }

  markInAppRead(id: string, userId: string) {
    return this.prisma.inAppNotification.updateMany({
      data: { readAt: new Date() },
      where: { id, readAt: null, userId }
    });
  }

  createPrivacyRequest(input: {
    completedAt?: Date;
    kind: string;
    resultPayload?: Prisma.InputJsonValue;
    status: string;
    userId: string;
  }) {
    return this.prisma.privacyRequest.create({
      data: {
        completedAt: input.completedAt,
        kind: input.kind,
        resultPayload: input.resultPayload,
        status: input.status,
        userId: input.userId
      }
    });
  }

  listPrivacyRequests(userId: string) {
    return this.prisma.privacyRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      where: { userId }
    });
  }

  newFairnessSeed() {
    return randomBytes(16).toString("hex");
  }

  pickPlacementQuestions(
    questions: Awaited<ReturnType<LearnerRepository["loadQuestionPool"]>>,
    seed: string
  ) {
    if (questions.length === 0) {
      return [];
    }
    const n = Math.min(PLACEMENT_QUESTION_COUNT, questions.length);
    return shuffleDeterministic(questions, seed).slice(0, n);
  }
}
