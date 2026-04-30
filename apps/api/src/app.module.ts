import { Module } from "@nestjs/common";

import { AdminModule } from "./admin/admin.module.js";
import { KeycloakModule } from "./keycloak/keycloak.module.js";
import { AnalyticsModule } from "./analytics/analytics.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { BattleModule } from "./battle/battle.module.js";
import { BookmarksModule } from "./bookmarks/bookmarks.module.js";
import { ContentModule } from "./content/content.module.js";
import { DailyModule } from "./daily/daily.module.js";
import { FlashcardsModule } from "./flashcards/flashcards.module.js";
import { GrowthModule } from "./growth/growth.module.js";
import { HealthModule } from "./health/health.module.js";
import { LearnerModule } from "./learner/learner.module.js";
import { LearningModule } from "./learning/learning.module.js";
import { LegalModule } from "./legal/legal.module.js";
import { PrivacyModule } from "./privacy/privacy.module.js";
import { MediaModule } from "./media/media.module.js";
import { MonetizationModule } from "./monetization/monetization.module.js";
import { OperationsModule } from "./operations/operations.module.js";
import { QuizModule } from "./quiz/quiz.module.js";
import { ReadingAssistModule } from "./reading-assist/reading-assist.module.js";
import { SearchModule } from "./search/search.module.js";

@Module({
  imports: [
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
    DailyModule,
    MonetizationModule,
    OperationsModule
  ]
})
export class AppModule {}
