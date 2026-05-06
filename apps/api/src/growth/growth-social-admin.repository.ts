import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import {
  GROWTH_SOCIAL_TEMPLATE_KINDS,
  GROWTH_TEMPLATE_PRIVACY_CLASSES,
  type adminGrowthShareEventListQuerySchema,
  type adminGrowthSocialTemplateCreateSchema,
  type adminGrowthSocialTemplateListQuerySchema,
  type adminGrowthSocialTemplatePatchSchema
} from "@nihongo-bjt/shared";

type CreateInput = z.infer<typeof adminGrowthSocialTemplateCreateSchema>;
type PatchInput = z.infer<typeof adminGrowthSocialTemplatePatchSchema>;
type ListInput = z.infer<typeof adminGrowthSocialTemplateListQuerySchema>;
type EventListInput = z.infer<typeof adminGrowthShareEventListQuerySchema>;

const SOCIAL_KIND_SET = new Set<string>(GROWTH_SOCIAL_TEMPLATE_KINDS);

@Injectable()
export class GrowthSocialAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async listTemplates(input: ListInput) {
    const where: Prisma.ShareTemplateWhereInput = {
      kind: { in: GROWTH_SOCIAL_TEMPLATE_KINDS as unknown as string[] }
    };
    if (input.kind) where.kind = input.kind;
    if (input.q) where.slug = { contains: input.q, mode: "insensitive" };
    if (input.status === "published") where.active = true;
    if (input.status === "archived") where.active = false;
    const [items, total] = await Promise.all([
      this.prisma.shareTemplate.findMany({
        orderBy: { updatedAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.shareTemplate.count({ where })
    ]);
    return { items: items.map((it) => this.summarize(it)), page: input.page, pageSize: input.pageSize, total };
  }

  async detailTemplate(id: string) {
    const row = await this.prisma.shareTemplate.findUnique({ where: { id } });
    if (!row || !SOCIAL_KIND_SET.has(row.kind)) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      where: { targetId: id, targetType: "growth.social_template" }
    });
    return { ...this.summarize(row), audit, config: row.config };
  }

  private summarize(row: {
    id: string;
    slug: string;
    kind: string;
    version: number;
    active: boolean;
    config: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const config = (row.config ?? {}) as Record<string, unknown>;
    return {
      active: row.active,
      createdAt: row.createdAt,
      id: row.id,
      kind: row.kind,
      name: typeof config.name === "string" ? (config.name as string) : row.slug,
      privacyClass: typeof config.privacyClass === "string" ? (config.privacyClass as string) : "learner_private",
      noPiiVerified: config.noPiiVerified === true,
      slug: row.slug,
      surface: typeof config.surface === "string" ? (config.surface as string) : "social",
      updatedAt: row.updatedAt,
      version: row.version
    };
  }

  async createTemplate(actorId: string, data: CreateInput) {
    this.assertSlug(data.slug);
    this.assertPrivacy(data.config.privacyClass, data.config.noPiiVerified ?? false, false);
    const row = await this.prisma.shareTemplate.create({
      data: {
        active: false,
        config: data.config as unknown as Prisma.InputJsonValue,
        kind: data.kind,
        slug: data.slug,
        version: 1
      }
    });
    await this.writeTemplateAudit({
      action: "admin.growth.social_template.created",
      actorId,
      after: { config: data.config, kind: data.kind, slug: data.slug },
      before: null,
      reason: data.reason,
      targetId: row.id
    });
    return this.detailTemplate(row.id);
  }

  async patchTemplate(actorId: string, id: string, data: PatchInput) {
    const before = await this.prisma.shareTemplate.findUnique({ where: { id } });
    if (!before || !SOCIAL_KIND_SET.has(before.kind)) {
      throw new NotFoundException("Social template not found");
    }
    if (data.config?.privacyClass) {
      this.assertPrivacy(data.config.privacyClass, data.config.noPiiVerified ?? false, before.active);
    }
    const update: Prisma.ShareTemplateUpdateInput = {};
    if (data.slug) {
      this.assertSlug(data.slug);
      update.slug = data.slug;
    }
    if (data.kind) update.kind = data.kind;
    if (data.config) {
      update.config = data.config as unknown as Prisma.InputJsonValue;
      update.version = { increment: 1 };
    }
    const updated = await this.prisma.shareTemplate.update({ data: update, where: { id } });
    await this.writeTemplateAudit({
      action: "admin.growth.social_template.updated",
      actorId,
      after: { config: updated.config, kind: updated.kind, slug: updated.slug, version: updated.version },
      before: { config: before.config, kind: before.kind, slug: before.slug, version: before.version },
      reason: data.reason,
      targetId: id
    });
    return this.detailTemplate(id);
  }

  async publishTemplate(actorId: string, id: string, reason: string) {
    const before = await this.prisma.shareTemplate.findUnique({ where: { id } });
    if (!before || !SOCIAL_KIND_SET.has(before.kind)) {
      throw new NotFoundException("Social template not found");
    }
    const cfg = (before.config ?? {}) as Record<string, unknown>;
    const privacyClass = typeof cfg.privacyClass === "string" ? (cfg.privacyClass as string) : "learner_private";
    const noPiiVerified = cfg.noPiiVerified === true;
    this.assertPrivacy(privacyClass, noPiiVerified, true);
    const updated = await this.prisma.shareTemplate.update({ data: { active: true }, where: { id } });
    await this.writeTemplateAudit({
      action: "admin.growth.social_template.published",
      actorId,
      after: { active: updated.active, privacyClass },
      before: { active: before.active },
      reason,
      targetId: id
    });
    return this.detailTemplate(id);
  }

  async archiveTemplate(actorId: string, id: string, reason: string) {
    const before = await this.prisma.shareTemplate.findUnique({ where: { id } });
    if (!before || !SOCIAL_KIND_SET.has(before.kind)) {
      throw new NotFoundException("Social template not found");
    }
    const updated = await this.prisma.shareTemplate.update({ data: { active: false }, where: { id } });
    await this.writeTemplateAudit({
      action: "admin.growth.social_template.archived",
      actorId,
      after: { active: updated.active },
      before: { active: before.active },
      reason,
      targetId: id
    });
    return this.detailTemplate(id);
  }

  async listEvents(input: EventListInput) {
    const where: Prisma.ShareItemWhereInput = {};
    if (input.templateId) where.templateId = input.templateId;
    if (input.userId) where.userId = input.userId;
    if (input.fromDate) where.createdAt = { ...(where.createdAt as object), gte: input.fromDate };
    if (input.toDate) where.createdAt = { ...(where.createdAt as object), lte: input.toDate };
    if (input.hidden === "active") where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
    if (input.hidden === "hidden") where.expiresAt = { lte: new Date() };
    if (input.q) where.publicToken = { contains: input.q, mode: "insensitive" };

    const [items, total] = await Promise.all([
      this.prisma.shareItem.findMany({
        include: {
          template: { select: { id: true, kind: true, slug: true } },
          user: { select: { id: true, displayName: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.shareItem.count({ where })
    ]);
    return {
      items: items.map((it) => ({
        ...it,
        hidden: it.expiresAt !== null && it.expiresAt <= new Date(),
        // Privacy: redact summaryPayload to a safe preview (kind + a single sanitized headline if present)
        summaryPreview: this.safePreview(it.summaryPayload),
        summaryPayload: undefined
      })),
      page: input.page,
      pageSize: input.pageSize,
      total
    };
  }

  private safePreview(payload: unknown): { headline?: string; sub?: string } {
    if (!payload || typeof payload !== "object") return {};
    const p = payload as Record<string, unknown>;
    const out: { headline?: string; sub?: string } = {};
    if (typeof p.headline === "string") out.headline = (p.headline as string).slice(0, 200);
    if (typeof p.sub === "string") out.sub = (p.sub as string).slice(0, 200);
    return out;
  }

  async moderateEvent(
    actorId: string,
    id: string,
    action: "dismiss" | "hide_from_public" | "report_to_legal",
    reason: string
  ) {
    const before = await this.prisma.shareItem.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Share item not found");
    let after: Record<string, unknown>;
    if (action === "hide_from_public") {
      const updated = await this.prisma.shareItem.update({
        data: { expiresAt: new Date() },
        where: { id }
      });
      after = { expiresAt: updated.expiresAt };
    } else if (action === "report_to_legal") {
      // Hide and tag in audit; legal queue is downstream from audit log filtered by action code.
      const updated = await this.prisma.shareItem.update({
        data: { expiresAt: new Date() },
        where: { id }
      });
      after = { expiresAt: updated.expiresAt, reportedToLegal: true };
    } else {
      after = { dismissed: true };
    }
    await this.prisma.adminAuditLog.create({
      data: {
        action: `admin.growth.share_item.${action}`,
        actorId,
        after: after as Prisma.InputJsonValue,
        before: { expiresAt: before.expiresAt } as Prisma.InputJsonValue,
        reason,
        targetId: id,
        targetType: "growth.share_item"
      }
    });
    return { action, id, ok: true };
  }

  private assertSlug(slug: string) {
    if (!/^[a-z0-9_-]+$/i.test(slug) || slug.length < 2 || slug.length > 64) {
      throw new BadRequestException({ code: "invalid_slug", slug });
    }
  }

  private assertPrivacy(privacyClass: string, noPiiVerified: boolean, publishing: boolean) {
    if (!(GROWTH_TEMPLATE_PRIVACY_CLASSES as readonly string[]).includes(privacyClass)) {
      throw new BadRequestException({ code: "invalid_privacy_class", privacyClass });
    }
    if (publishing && privacyClass === "public" && !noPiiVerified) {
      throw new BadRequestException({
        code: "public_template_requires_no_pii_verification",
        message: "Public templates must explicitly set noPiiVerified=true before publish."
      });
    }
  }

  private writeTemplateAudit(input: {
    action: string;
    actorId: string;
    after: unknown;
    before: unknown;
    reason: string;
    targetId: string;
  }) {
    return this.prisma.adminAuditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId,
        after: input.after as Prisma.InputJsonValue,
        before: input.before as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.targetId,
        targetType: "growth.social_template"
      }
    });
  }
}
