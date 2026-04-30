import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import {
  inAppMarkReadParamSchema,
  inAppNotificationListQuerySchema,
  learnerOnboardingQuerySchema,
  notificationPreferencesUpdateSchema,
  placementStartSchema,
  placementSubmitSchema,
  privacyRequestCreateSchema,
  privacyRequestListQuerySchema,
  scoreBjtPractice
} from "@nihongo-bjt/shared";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { LearnerRepository, PLACEMENT_QUESTION_COUNT } from "./learner.repository.js";

type PlacementQuestionOption = { optionKey: string; text: string };
type PlacementQuestionPublic = {
  id: string;
  options: PlacementQuestionOption[];
  prompt: string;
  skillTag: string;
};

@Injectable()
export class LearnerService {
  private readonly prisma = createPrismaClient();

  constructor(@Inject(LearnerRepository) private readonly repo: LearnerRepository) {}

  async getOnboarding(query: Record<string, string | undefined>) {
    const parsed = learnerOnboardingQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { userId } = parsed.data;
    await this.repo.upsertOnboardingEntry(userId);
    return this.repo.findOnboarding(userId);
  }

  async startPlacement(body: unknown) {
    const parsed = placementStartSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { userId } = parsed.data;
    await this.repo.upsertOnboardingEntry(userId);

    const existing = await this.repo.findOnboarding(userId);
    if (existing?.placement && existing.placement.status === "in_progress") {
      return this.formatPlacementStartResponse(existing.placement);
    }

    const pool = await this.repo.loadQuestionPool();
    if (pool.length === 0) {
      throw new BadRequestException("No published BJT questions available for placement");
    }
    const seed = this.repo.newFairnessSeed();
    const picked = this.repo.pickPlacementQuestions(pool, seed);
    if (picked.length === 0) {
      throw new BadRequestException("No published BJT questions available for placement");
    }

    const session = await this.repo.createPlacementSession({
      fairnessSeed: seed,
      questionIds: picked.map((q) => q.id),
      userId
    });
    await this.repo.linkOnboardingPlacement(userId, session.id, "placement_active");
    return this.formatPlacementStartResponse(
      (await this.repo.getPlacementSession(session.id, userId))!
    );
  }

  private async formatPlacementStartResponse(
    session: NonNullable<Awaited<ReturnType<LearnerRepository["getPlacementSession"]>>>
  ) {
    const questionIds = session.questionIds as string[];
    const questions = await this.prisma.bjtQuestion.findMany({
      include: { options: { orderBy: { optionKey: "asc" } } },
      where: { id: { in: questionIds } }
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    const ordered: PlacementQuestionPublic[] = [];
    for (const id of questionIds) {
      const q = byId.get(id);
      if (!q) {
        throw new BadRequestException("Placement question not found (content drift)");
      }
      ordered.push({
        id: q.id,
        options: q.options.map((o) => ({ optionKey: o.optionKey, text: o.text })),
        prompt: q.prompt,
        skillTag: q.skillTag
      });
    }
    return {
      estimatedQuestionCount: PLACEMENT_QUESTION_COUNT,
      questions: ordered,
      sessionId: session.id
    };
  }

  async submitPlacement(body: unknown) {
    const parsed = placementSubmitSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { answers, sessionId, userId } = parsed.data;
    const session = await this.repo.getPlacementSession(sessionId, userId);
    if (!session) {
      throw new NotFoundException("Placement session not found");
    }
    if (session.status === "completed") {
      return {
        alreadyCompleted: true as const,
        correctCount: session.correctCount,
        estimatedBjtBand: session.estimatedBjtBand
      };
    }
    const questionIds = session.questionIds as string[];
    if (questionIds.length === 0) {
      throw new BadRequestException("Empty placement session");
    }
    for (const qid of questionIds) {
      if (answers[qid] === undefined) {
        throw new BadRequestException(`Missing answer for question ${qid}`);
      }
    }

    const dbQuestions = await this.prisma.bjtQuestion.findMany({
      include: { options: true },
      where: { id: { in: questionIds } }
    });
    const byId = new Map(dbQuestions.map((q) => [q.id, q]));
    let correct = 0;
    for (const qid of questionIds) {
      const q = byId.get(qid);
      if (!q) {
        throw new BadRequestException("Question not found");
      }
      const selected = answers[qid];
      const option = q.options.find((o) => o.optionKey === selected);
      if (option?.isCorrect) {
        correct += 1;
      }
    }

    const score = scoreBjtPractice({ correctCount: correct, totalQuestions: questionIds.length });
    const now = new Date();
    const after = await this.repo.completePlacement({
      completedAt: now,
      correctCount: correct,
      estimatedBjtBand: score.estimatedBjtBand,
      onboardedAt: now,
      onboardingStep: "completed",
      questionIds,
      sessionId: session.id,
      userId
    });
    return {
      alreadyCompleted: false as const,
      correctCount: correct,
      estimatedBjtBand: score.estimatedBjtBand,
      estimatedScore: score.estimatedScore,
      profileRowsUpdated: after.profileRowsUpdated
    };
  }

  getNotificationPreferences(query: Record<string, string | undefined>) {
    const parsed = learnerOnboardingQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.getOrCreateNotificationPreferences(parsed.data.userId);
  }

  updateNotificationPreferences(body: unknown) {
    const parsed = notificationPreferencesUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { userId, ...rest } = parsed.data;
    return this.repo.updateNotificationPreferences(userId, rest);
  }

  listInAppNotifications(query: Record<string, string | undefined>) {
    const parsed = inAppNotificationListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.listInAppNotifications(parsed.data.userId, parsed.data.limit);
  }

  markInAppRead(paramId: string, body: unknown) {
    const parsed = inAppMarkReadParamSchema.safeParse({ id: paramId, ...(body as object) });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo
      .markInAppRead(parsed.data.id, parsed.data.userId)
      .then((r) => ({ updated: r.count }));
  }

  createPrivacyRequest(body: unknown) {
    const parsed = privacyRequestCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { kind, userId } = parsed.data;
    const now = new Date();
    if (kind === "data_export") {
      return this.repo.createPrivacyRequest({
        completedAt: now,
        kind: "data_export",
        resultPayload: {
          note: "phase09_skeleton_queued"
        } as Prisma.InputJsonValue,
        status: "completed",
        userId
      });
    }
    return this.repo.createPrivacyRequest({
      kind: "account_deletion",
      status: "pending",
      userId
    });
  }

  listPrivacyRequests(query: Record<string, string | undefined>) {
    const parsed = privacyRequestListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.listPrivacyRequests(parsed.data.userId);
  }
}
