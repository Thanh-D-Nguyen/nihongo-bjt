import { createPrismaClient, Prisma } from "@nihongo-bjt/database";
import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { EntitlementService } from "../monetization/entitlement.service.js";
import { EntitlementKey, FeatureFlagKey } from "../monetization/monetization.constants.js";
import { QuotaService } from "../monetization/quota.service.js";
import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { QuizRepository } from "./quiz.repository.js";

@Injectable()
export class QuizService {
  private readonly prisma = createPrismaClient();

  constructor(
    @Inject(QuizRepository) private readonly quizRepository: QuizRepository,
    @Inject(QuotaService) private readonly quotaService: QuotaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService,
    @Inject(RuntimeFeatureGateService) private readonly featureGate: RuntimeFeatureGateService
  ) {}

  async startSessionWithQuota(testId: string, userId: string) {
    const template = await this.quizRepository.templateAccessMeta(testId);
    if (!template) {
      throw new NotFoundException("Quiz template not found");
    }

    if (template.type === "official") {
      await this.featureGate.requireEnabled(FeatureFlagKey.quiz_official_simulation, {
        message: "Official BJT simulation is temporarily closed"
      });
      const enforcement = await this.featureGate.status(FeatureFlagKey.monetization_enforcement, { missingBehavior: "allow" });
      if (enforcement.enabled) {
        const { entitlements, planSlug } =
          await this.entitlementService.listEntitlementKeysForUser(userId);
        if (!entitlements.includes(EntitlementKey.quiz_official_simulation)) {
          throw new ForbiddenException({
            code: "ENTITLEMENT_DENIED",
            entitlementKey: EntitlementKey.quiz_official_simulation,
            message: "Your current plan does not include official BJT simulation",
            planSlug,
            upgradeRequired: true
          });
        }
      }
    }

    return this.prisma.$transaction(
      async (tx) => {
        const session = await this.quizRepository.startSession(testId, userId, tx);
        await this.quotaService.consumeQuizStartInTransaction(tx, userId);
        return session;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async officialSimulationStatus(userId: string) {
    const [feature, enforcement, resolved, availableTemplates] = await Promise.all([
      this.featureGate.status(FeatureFlagKey.quiz_official_simulation),
      this.featureGate.status(FeatureFlagKey.monetization_enforcement, { missingBehavior: "allow" }),
      this.entitlementService.listEntitlementKeysForUser(userId),
      this.prisma.bjtMockTest.count({ where: { status: "published", type: "official" } })
    ]);

    // When monetization enforcement is off, treat user as entitled (free mode)
    const entitled = !enforcement.enabled || resolved.entitlements.includes(EntitlementKey.quiz_official_simulation);

    return {
      availableTemplates,
      enabled: feature.enabled,
      enforcementEnabled: enforcement.enabled,
      entitlementKey: EntitlementKey.quiz_official_simulation,
      entitled,
      featureFlag: FeatureFlagKey.quiz_official_simulation,
      planSlug: resolved.planSlug
    };
  }
}
