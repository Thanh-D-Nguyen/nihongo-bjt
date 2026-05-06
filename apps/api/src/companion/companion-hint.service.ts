import {
  COMPANION_HINT_ALGORITHM_VERSION,
  type CompanionHintResponse,
  companionHintResponseSchema
} from "@nihongo-bjt/shared";
import { Inject, Injectable } from "@nestjs/common";

import { AnalyticsRepository } from "../analytics/analytics.repository.js";
import { FlashcardsRepository } from "../flashcards/flashcards.repository.js";
import { QuotaService } from "../monetization/quota.service.js";
import { CompanionHintRepository } from "./companion-hint.repository.js";
import { rankCompanionHint } from "./companion-hint.scoring.js";

@Injectable()
export class CompanionHintService {
  constructor(
    @Inject(AnalyticsRepository) private readonly analyticsRepository: AnalyticsRepository,
    @Inject(FlashcardsRepository) private readonly flashcardsRepository: FlashcardsRepository,
    @Inject(QuotaService) private readonly quotaService: QuotaService,
    @Inject(CompanionHintRepository) private readonly companionHintRepository: CompanionHintRepository
  ) {}

  async hintForLearner(userId: string, signalDays: number): Promise<CompanionHintResponse> {
    const days = signalDays;
    const [
      studySignals,
      dueCount,
      flashSummary,
      { hoursSinceLastBattle, hoursSinceLastQuiz, hoursSinceLastReview }
    ] = await Promise.all([
      this.analyticsRepository.learnerStudySignals(userId, days),
      this.flashcardsRepository.countDueForLearner(userId),
      this.quotaService.getFlashcardDaySummary(userId),
      this.companionHintRepository.studyRecency(userId)
    ]);

    const { alternatives, primary } = rankCompanionHint({
      bjtAccuracyPct: studySignals.bjtAccuracyPct,
      dueCount,
      flashcardRemaining: flashSummary.remaining,
      hoursSinceLastBattle,
      hoursSinceLastQuiz,
      hoursSinceLastReview,
      quizAnswerCount: studySignals.quizAnswerCount,
      reviewCount: studySignals.reviewCount,
      streakDays: studySignals.streakDays,
      weakSkills: studySignals.weakSkills
    });

    const computedAt = new Date().toISOString();

    const body: CompanionHintResponse = {
      algorithmVersion: COMPANION_HINT_ALGORITHM_VERSION,
      alternatives,
      computedAt,
      context: {
        bjtAccuracyPct: studySignals.bjtAccuracyPct,
        completedBjtSessions: studySignals.completedBjtSessions,
        dueCount,
        flashcardRemaining: flashSummary.remaining,
        quizAnswerCount: studySignals.quizAnswerCount,
        reviewCount: studySignals.reviewCount,
        signalDays: days,
        streakDays: studySignals.streakDays,
        topWeakSkill: studySignals.weakSkills[0]?.skillTag ?? null,
        weakSkillCount: studySignals.weakSkills.length
      },
      primary
    };

    return companionHintResponseSchema.parse(body);
  }
}
