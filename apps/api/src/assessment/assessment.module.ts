import { Module } from "@nestjs/common";

import { AdminModule } from "../admin/admin.module.js";
import { BjtDashboardAdminController } from "./bjt-dashboard-admin.controller.js";
import { BjtDashboardAdminRepository } from "./bjt-dashboard-admin.repository.js";
import { MockExamsAdminController } from "./mock-exams-admin.controller.js";
import { MockExamsAdminRepository } from "./mock-exams-admin.repository.js";
import { QuestionBankAdminController } from "./question-bank-admin.controller.js";
import { QuestionBankAdminRepository } from "./question-bank-admin.repository.js";
import { QuizSessionsAdminController } from "./quiz-sessions-admin.controller.js";
import { QuizSessionsAdminRepository } from "./quiz-sessions-admin.repository.js";
import { QuizTemplatesAdminController } from "./quiz-templates-admin.controller.js";
import { QuizTemplatesAdminRepository } from "./quiz-templates-admin.repository.js";
import { RemediationAdminController } from "./remediation-admin.controller.js";
import { RemediationAdminRepository } from "./remediation-admin.repository.js";

@Module({
  controllers: [
    MockExamsAdminController,
    QuizTemplatesAdminController,
    QuestionBankAdminController,
    QuizSessionsAdminController,
    RemediationAdminController,
    BjtDashboardAdminController
  ],
  imports: [AdminModule],
  providers: [
    MockExamsAdminRepository,
    QuizTemplatesAdminRepository,
    QuestionBankAdminRepository,
    QuizSessionsAdminRepository,
    RemediationAdminRepository,
    BjtDashboardAdminRepository
  ]
})
export class AssessmentModule {}
