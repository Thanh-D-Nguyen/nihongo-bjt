import { createPrismaClient, Prisma } from "@nihongo-bjt/database";
import { Inject, Injectable } from "@nestjs/common";

import { QuotaService } from "../monetization/quota.service.js";
import { QuizRepository } from "./quiz.repository.js";

@Injectable()
export class QuizService {
  private readonly prisma = createPrismaClient();

  constructor(
    @Inject(QuizRepository) private readonly quizRepository: QuizRepository,
    @Inject(QuotaService) private readonly quotaService: QuotaService
  ) {}

  async startSessionWithQuota(testId: string, userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const session = await this.quizRepository.startSession(testId, userId, tx);
        await this.quotaService.consumeQuizStartInTransaction(tx, userId);
        return session;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}
