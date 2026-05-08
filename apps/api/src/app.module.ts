import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AdminModule } from "./admin/admin.module.js";
import { AnnouncementModule } from "./announcement/announcement.module.js";
import { KeycloakModule } from "./keycloak/keycloak.module.js";
import { AnalyticsModule } from "./analytics/analytics.module.js";
import { AssessmentModule } from "./assessment/assessment.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { BattleModule } from "./battle/battle.module.js";
import { BookmarksModule } from "./bookmarks/bookmarks.module.js";
import { CardgenModule } from "./cardgen/cardgen.module.js";
import { ContentModule } from "./content/content.module.js";
import { CompanionModule } from "./companion/companion.module.js";
import { DailyModule } from "./daily/daily.module.js";
import { ExerciseModule } from "./exercise/exercise.module.js";
import { FlashcardsModule } from "./flashcards/flashcards.module.js";
import { GamificationModule } from "./gamification/gamification.module.js";
import { GrowthModule } from "./growth/growth.module.js";
import { HealthModule } from "./health/health.module.js";
import { LearnerModule } from "./learner/learner.module.js";
import { LearningModule } from "./learning/learning.module.js";
import { LegalModule } from "./legal/legal.module.js";
import { PrivacyModule } from "./privacy/privacy.module.js";
import { MediaModule } from "./media/media.module.js";
import { MonetizationModule } from "./monetization/monetization.module.js";
import { NhkNewsModule } from "./nhk-news/nhk-news.module.js";
import { OperationsModule } from "./operations/operations.module.js";
import { QuizModule } from "./quiz/quiz.module.js";
import { ReadingAssistModule } from "./reading-assist/reading-assist.module.js";
import { SearchModule } from "./search/search.module.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: "short", ttl: 1000, limit: 20 },
      { name: "medium", ttl: 10000, limit: 100 },
      { name: "long", ttl: 60000, limit: 300 },
    ]),
    KeycloakModule,
    AuthModule,
    GrowthModule,
    HealthModule,
    LearnerModule,
    LearningModule,
    LegalModule,
      PrivacyModule,
    BookmarksModule,
    BattleModule,
    ContentModule,
    SearchModule,
    ReadingAssistModule,
    MediaModule,
    FlashcardsModule,
    QuizModule,
    AdminModule,
    AnalyticsModule,
    AssessmentModule,
    DailyModule,
    AnnouncementModule,
    MonetizationModule,
    NhkNewsModule,
    OperationsModule,
    CompanionModule,
    ExerciseModule,
    GamificationModule,
    CardgenModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
