import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { BadRequestException, Injectable } from "@nestjs/common";
import { z } from "zod";

const createPolicySchema = z.object({
  policyKey: z.enum(["terms_of_service", "privacy_policy", "cookie_policy", "tokusho"]),
  version: z.string().min(1).max(32),
  effectiveAt: z.string().datetime({ message: "effectiveAt must be an ISO-8601 datetime" }),
  contentMd: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft")
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

/**
 * Legal policy admin service.
 * Manages versioned legal policy documents (terms, privacy, cookie, tokusho).
 * LegalConsentService reads the latest published policy per key at runtime.
 *
 * Security: all mutating operations require audit log (caller's responsibility).
 */
@Injectable()
export class LegalPolicyAdminService {
  private readonly prisma: PrismaClient = createPrismaClient();

  async listPolicies(policyKey?: string) {
    return this.prisma.legalPolicy.findMany({
      orderBy: [{ policyKey: "asc" }, { effectiveAt: "desc" }],
      where: { policyKey: policyKey ?? undefined }
    });
  }

  async createPolicy(input: unknown) {
    const parsed = createPolicySchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.prisma.legalPolicy.create({
      data: {
        contentMd: parsed.data.contentMd,
        effectiveAt: new Date(parsed.data.effectiveAt),
        policyKey: parsed.data.policyKey,
        status: parsed.data.status,
        version: parsed.data.version
      }
    });
  }

  async publishPolicy(id: string) {
    return this.prisma.legalPolicy.update({
      data: { status: "published" },
      where: { id }
    });
  }

  async archivePolicy(id: string) {
    return this.prisma.legalPolicy.update({
      data: { status: "archived" },
      where: { id }
    });
  }
}
