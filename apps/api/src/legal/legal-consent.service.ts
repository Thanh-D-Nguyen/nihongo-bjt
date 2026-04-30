import { createPrismaClient } from "@nihongo-bjt/database";
import { ForbiddenException, Injectable } from "@nestjs/common";

type ConsentKey = "terms_of_service" | "privacy_policy" | "cookie_policy";

const FALLBACK_POLICY_VERSION: Record<ConsentKey, string> = {
  cookie_policy: "v1",
  privacy_policy: "v1",
  terms_of_service: "v1"
};

const GATED_CONSENT_KEYS: ConsentKey[] = ["terms_of_service", "privacy_policy"];

@Injectable()
export class LegalConsentService {
  private readonly prisma = createPrismaClient();

  /**
   * Load required policy versions from DB (LegalPolicy table).
   * Falls back to hardcoded FALLBACK_POLICY_VERSION if no published policy exists for a key.
   * Only considers policies with status="published" and effectiveAt <= now().
   */
  private async loadRequiredVersions(): Promise<Record<ConsentKey, string>> {
    const rows = await this.prisma.legalPolicy.findMany({
      orderBy: { effectiveAt: "desc" },
      select: { policyKey: true, version: true },
      where: {
        effectiveAt: { lte: new Date() },
        policyKey: { in: Object.keys(FALLBACK_POLICY_VERSION) },
        status: "published"
      }
    });

    const required = { ...FALLBACK_POLICY_VERSION };
    // Latest effectiveAt per key (result is already sorted desc)
    const seen = new Set<string>();
    for (const row of rows) {
      if (!seen.has(row.policyKey) && row.policyKey in required) {
        required[row.policyKey as ConsentKey] = row.version;
        seen.add(row.policyKey);
      }
    }
    return required;
  }

  async getStatus(userId: string) {
    const [rows, required] = await Promise.all([
      this.prisma.$queryRaw<Array<{ acceptedAt: Date; consentKey: string; policyVersion: string }>>`
        SELECT DISTINCT ON (consent_key)
          consent_key AS "consentKey",
          policy_version AS "policyVersion",
          accepted_at AS "acceptedAt"
        FROM legal.consent_record
        WHERE user_id = ${userId}::uuid
        ORDER BY consent_key, accepted_at DESC
      `,
      this.loadRequiredVersions()
    ]);

    const byKey = new Map(rows.map((row) => [row.consentKey, row]));
    return {
      accepted: {
        cookie_policy: byKey.get("cookie_policy") ?? null,
        privacy_policy: byKey.get("privacy_policy") ?? null,
        terms_of_service: byKey.get("terms_of_service") ?? null
      },
      required
    };
  }

  async getHistory(userId: string) {
    return this.prisma.$queryRaw<Array<{
      acceptedAt: Date;
      consentKey: string;
      policyVersion: string;
      source: string;
    }>>`
      SELECT
        consent_key AS "consentKey",
        policy_version AS "policyVersion",
        source,
        accepted_at AS "acceptedAt"
      FROM legal.consent_record
      WHERE user_id = ${userId}::uuid
      ORDER BY accepted_at DESC
    `;
  }

  async accept(input: {
    consentKey: ConsentKey;
    policyVersion: string;
    source: "web" | "mobile" | "admin";
    userId: string;
  }) {
    await this.prisma.$executeRaw`
      INSERT INTO legal.consent_record (user_id, consent_key, policy_version, source)
      VALUES (${input.userId}::uuid, ${input.consentKey}, ${input.policyVersion}, ${input.source})
      ON CONFLICT (user_id, consent_key, policy_version)
      DO NOTHING
    `;

    return this.getStatus(input.userId);
  }

  async requireCheckoutConsent(userId: string) {
    const status = await this.getStatus(userId);

    const missing = GATED_CONSENT_KEYS.filter((key) => {
      const accepted = status.accepted[key];
      if (!accepted) {
        return true;
      }
      return accepted.policyVersion !== status.required[key];
    });

    if (missing.length > 0) {
      throw new ForbiddenException({
        code: "CONSENT_REQUIRED",
        message: "Latest legal consent is required before checkout",
        required: status.required,
        missing
      });
    }
  }
}
