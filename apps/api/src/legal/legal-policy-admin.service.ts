import { Injectable } from "@nestjs/common";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { z } from "zod";

const POLICY_KEY_VALUES = [
  "terms_of_service",
  "privacy_policy",
  "cookie_policy",
  "tokusho",
  "consent_marketing",
  "consent_analytics",
  "legal_document"
] as const;
const STATUS_VALUES = ["draft", "published", "archived"] as const;

export const createPolicySchema = z.object({
  policyKey: z.enum(POLICY_KEY_VALUES),
  version: z.string().trim().min(1).max(32),
  effectiveAt: z.string().datetime({ message: "effectiveAt must be an ISO-8601 datetime" }),
  contentMd: z.string().max(200_000).optional(),
  status: z.enum(STATUS_VALUES).default("draft")
});

export const updatePolicySchema = z.object({
  version: z.string().trim().min(1).max(32).optional(),
  effectiveAt: z.string().datetime().optional(),
  contentMd: z.string().max(200_000).optional()
});

export const listQuerySchema = z.object({
  policyKey: z.enum(POLICY_KEY_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0)
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

/**
 * Legal policy admin service.
 *
 * Manages versioned legal policy documents. `policyKey` covers terms_of_service,
 * privacy_policy, cookie_policy, tokusho (Japanese 特定商取引法), and consent_*
 * variants. Mutations are audited via AdminAuditInterceptor on the controller.
 *
 * partial_schema_pending: locale-specific policy variants are not modelled in
 * `legal_policy` (single contentMd). Tokushoho structured fields (company,
 * address, contact, refund, etc.) are stored as a JSON block embedded in
 * contentMd; once schema is added, migrate to a dedicated `tokushoho_disclosure`
 * table. See company/admin-module-inventory.md.
 */
@Injectable()
export class LegalPolicyAdminService {
  private readonly prisma: PrismaClient = createPrismaClient();

  async listPolicies(filter: z.infer<typeof listQuerySchema>) {
    const where: Prisma.LegalPolicyWhereInput = {};
    if (filter.policyKey) where.policyKey = filter.policyKey;
    if (filter.status) where.status = filter.status;
    const [items, total] = await Promise.all([
      this.prisma.legalPolicy.findMany({
        orderBy: [{ policyKey: "asc" }, { effectiveAt: "desc" }],
        skip: filter.offset,
        take: filter.limit,
        where
      }),
      this.prisma.legalPolicy.count({ where })
    ]);
    return { items, total };
  }

  async getPolicy(id: string) {
    const found = await this.prisma.legalPolicy.findUnique({ where: { id } });
    if (!found) throw new NotFoundException({ code: "LEGAL_POLICY_NOT_FOUND" });
    const audit = await this.prisma.adminAuditEvent.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
      where: { resourceId: id, resourceType: "admin.legal_policy" }
    });
    return { ...found, audit };
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

  async updatePolicy(id: string, input: unknown) {
    const parsed = updatePolicySchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const before = await this.prisma.legalPolicy.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "LEGAL_POLICY_NOT_FOUND" });
    if (before.status !== "draft") {
      throw new ConflictException({
        code: "LEGAL_POLICY_NOT_DRAFT",
        message: "Only draft policy versions can be edited; duplicate to create a new draft."
      });
    }
    const data: Prisma.LegalPolicyUpdateInput = {};
    if (parsed.data.version) data.version = parsed.data.version;
    if (parsed.data.effectiveAt) data.effectiveAt = new Date(parsed.data.effectiveAt);
    if (parsed.data.contentMd !== undefined) data.contentMd = parsed.data.contentMd;
    return this.prisma.legalPolicy.update({ data, where: { id } });
  }

  async publishPolicy(id: string) {
    const before = await this.prisma.legalPolicy.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "LEGAL_POLICY_NOT_FOUND" });
    if (before.status === "archived") {
      throw new ConflictException({ code: "LEGAL_POLICY_ARCHIVED" });
    }
    return this.prisma.legalPolicy.update({
      data: { status: "published" },
      where: { id }
    });
  }

  async archivePolicy(id: string) {
    const before = await this.prisma.legalPolicy.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "LEGAL_POLICY_NOT_FOUND" });
    return this.prisma.legalPolicy.update({
      data: { status: "archived" },
      where: { id }
    });
  }

  async deletePolicy(id: string) {
    const before = await this.prisma.legalPolicy.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "LEGAL_POLICY_NOT_FOUND" });
    if (before.status !== "draft") {
      throw new ConflictException({
        code: "LEGAL_POLICY_NOT_DRAFT",
        message: "Only draft policy versions can be deleted; archive published versions instead."
      });
    }
    await this.prisma.legalPolicy.delete({ where: { id } });
    return { id, deleted: true };
  }

  async duplicatePolicy(id: string) {
    const source = await this.prisma.legalPolicy.findUnique({ where: { id } });
    if (!source) throw new NotFoundException({ code: "LEGAL_POLICY_NOT_FOUND" });
    // Generate suffixed version (vN → vN-copy or vN.1) with uniqueness retries.
    const base = source.version;
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const candidate = attempt === 1 ? `${base}-copy` : `${base}-copy${attempt}`;
      const exists = await this.prisma.legalPolicy.findFirst({
        select: { id: true },
        where: { policyKey: source.policyKey, version: candidate }
      });
      if (!exists) {
        return this.prisma.legalPolicy.create({
          data: {
            contentMd: source.contentMd,
            effectiveAt: source.effectiveAt,
            policyKey: source.policyKey,
            status: "draft",
            version: candidate
          }
        });
      }
    }
    throw new ConflictException({ code: "LEGAL_POLICY_DUPLICATE_VERSION_LIMIT" });
  }

  async diffPolicies(aId: string, bId: string) {
    const [a, b] = await Promise.all([
      this.prisma.legalPolicy.findUnique({ where: { id: aId } }),
      this.prisma.legalPolicy.findUnique({ where: { id: bId } })
    ]);
    if (!a || !b) throw new NotFoundException({ code: "LEGAL_POLICY_NOT_FOUND" });
    return {
      a: { id: a.id, version: a.version, status: a.status, contentMd: a.contentMd ?? "" },
      b: { id: b.id, version: b.version, status: b.status, contentMd: b.contentMd ?? "" },
      sameKey: a.policyKey === b.policyKey
    };
  }
}
