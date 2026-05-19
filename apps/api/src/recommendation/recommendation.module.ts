import { Module } from "@nestjs/common";

import { FlashcardReviewPipeline } from "./flashcard-review.pipeline.js";
import { NewsFeedPipeline } from "./news-feed.pipeline.js";
import { OnboardingController } from "./onboarding.controller.js";
import { OnboardingRepository } from "./onboarding.repository.js";
import { RecommendationController } from "./recommendation.controller.js";
import { RecommendationService } from "./recommendation.service.js";
import { StudyFeedPipeline } from "./study-feed.pipeline.js";
import { UserContextHydrator } from "./user-context.hydrator.js";

@Module({
  controllers: [RecommendationController, OnboardingController],
  providers: [
    RecommendationService,
    UserContextHydrator,
    StudyFeedPipeline,
    NewsFeedPipeline,
    FlashcardReviewPipeline,
    OnboardingRepository,
  ],
  exports: [RecommendationService, OnboardingRepository],
})
export class RecommendationModule {}
