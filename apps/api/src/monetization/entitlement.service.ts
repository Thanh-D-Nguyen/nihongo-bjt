import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { Inject, Injectable } from "@nestjs/common";

import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { EntitlementKey, FeatureFlagKey } from "./monetization.constants.js";
import { MonetizationRepository } from "./monetization.repository.js";

/**
 * Exposes **entitlement keys** derived from the resolved plan. Use `has()` in guards or services — not
 * ad-hoc plan slug checks — so product can add plans without scattering string comparisons.
 */
@Injectable()
export class EntitlementService {
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(
    @Inject(MonetizationRepository) private readonly repository: MonetizationRepository,
    @Inject(RuntimeFeatureGateService) private readonly featureGate: RuntimeFeatureGateService
  ) {}

  async listEntitlementKeysForUser(userId: string) {
    const [resolved, enforcement] = await Promise.all([
      this.repository.resolvePlanForUser(userId, this.prisma),
      this.featureGate.status(FeatureFlagKey.monetization_enforcement, {
        missingBehavior: "allow"
      })
    ]);
    const planEntitlements = resolved.plan.entitlements.map((row) => row.entitlement.key);

    return {
      entitlements: enforcement.enabled ? planEntitlements : Object.values(EntitlementKey),
      planSlug: resolved.plan.slug
    };
  }

  /**
   * Server-side check for a single entitlement (use from guards or use-cases).
   */
  async has(userId: string, entitlementKey: string) {
    const { entitlements } = await this.listEntitlementKeysForUser(userId);
    return entitlements.includes(entitlementKey);
  }
}
