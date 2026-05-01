import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { Inject, Injectable } from "@nestjs/common";

import { MonetizationRepository } from "./monetization.repository.js";

/**
 * Exposes **entitlement keys** derived from the resolved plan. Use `has()` in guards or services — not
 * ad-hoc plan slug checks — so product can add plans without scattering string comparisons.
 */
@Injectable()
export class EntitlementService {
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(@Inject(MonetizationRepository) private readonly repository: MonetizationRepository) {}

  async listEntitlementKeysForUser(userId: string) {
    const resolved = await this.repository.resolvePlanForUser(userId, this.prisma);
    return {
      entitlements: resolved.plan.entitlements.map((row) => row.entitlement.key),
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
