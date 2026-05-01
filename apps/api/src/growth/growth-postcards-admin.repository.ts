import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import {
  GROWTH_POSTCARD_EVENT_KINDS,
  GROWTH_TEMPLATE_PRIVACY_CLASSES,
  type adminGrowthPostcardCreateSchema,
  type adminGrowthPostcardListQuerySchema,
  type adminGrowthPostcardPatchSchema
} from "@nihongo-bjt/shared";

type CreateInput = z.infer<typeof adminGrowthPostcardCreateSchema>;
type PatchInput = z.infer<typeof adminGrowthPostcardPatchSchema>;
type ListInput = z.infer<typeof adminGrowthPostcardListQuerySchema>;

const POSTCARD_KIND_SET = new Set<string>(GROWTH_POSTCARD_EVENT_KINDS);

@Injectable()
export class GrowthPostcardsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.ShareTemplateWhereInput = {
      kind: { in: GROWTH_POSTCARD_EVENT_KINDS as unknown as string[] }
    };
    if (input.kind) where.kind = input.kind;
    if (input.q) where.slug = { contains: input.q, mode: "insensitive" };
    if (input.status === "published") where.active = true;
    if (input.status === "archived") where.active = false;
    // "draft" maps to inactive + version=1; we treat published=active for simplicity.

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

  async detail(id: string) {
    const row = await this.prisma.shareTemplate.findUnique({ where: { id } });
    if (!row) return null;
    if (!POSTCARD_KIND_SET.has(row.kind)) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      where: { targetId: id, targetType: "growth.postcard_template" }
    });
    return { ...this.summarize(row), config: row.config, audit };
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
      surface: typeof config.surface === "string" ? (config.surface as string) : "postcard",
      thumbnailKey: typeof config.thumbnailKey === "string" ? (config.thumbnailKey as string) : null,
      updatedAt: row.updatedAt,
      version: row.version
    };
  }

  async create(actorId: string, data: CreateInput) {
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
    await this.writeAudit({
      action: "admin.growth.postcard_template.created",
      actorId,
      after: { config: data.config, kind: data.kind, slug: data.slug },
      before: null,
      reason: data.reason,
      targetId: row.id
    });
    return this.detail(row.id);
  }

  async patch(actorId: string, id: string, data: PatchInput) {
    const before = await this.prisma.shareTemplate.findUnique({ where: { id } });
    if (!before || !POSTCARD_KIND_SET.has(before.kind)) {
      throw new NotFoundException("Postcard template not found");
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
    await this.writeAudit({
      action: "admin.growth.postcard_template.updated",
      actorId,
      after: { config: updated.config, kind: updated.kind, slug: updated.slug, version: updated.version },
      before: { config: before.config, kind: before.kind, slug: before.slug, version: before.version },
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async publish(actorId: string, id: string, reason: string) {
    const before = await this.prisma.shareTemplate.findUnique({ where: { id } });
    if (!before || !POSTCARD_KIND_SET.has(before.kind)) {
      throw new NotFoundException("Postcard template not found");
    }
    const cfg = (before.config ?? {}) as Record<string, unknown>;
    const privacyClass = typeof cfg.privacyClass === "string" ? (cfg.privacyClass as string) : "learner_private";
    const noPiiVerified = cfg.noPiiVerified === true;
    this.assertPrivacy(privacyClass, noPiiVerified, true);
    const updated = await this.prisma.shareTemplate.update({ data: { active: true }, where: { id } });
    await this.writeAudit({
      action: "admin.growth.postcard_template.published",
      actorId,
      after: { active: updated.active, privacyClass },
      before: { active: before.active },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async archive(actorId: string, id: string, reason: string) {
    const before = await this.prisma.shareTemplate.findUnique({ where: { id } });
    if (!before || !POSTCARD_KIND_SET.has(before.kind)) {
      throw new NotFoundException("Postcard template not found");
    }
    const updated = await this.prisma.shareTemplate.update({ data: { active: false }, where: { id } });
    await this.writeAudit({
      action: "admin.growth.postcard_template.archived",
      actorId,
      after: { active: updated.active },
      before: { active: before.active },
      reason,
      targetId: id
    });
    return this.detail(id);
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

  private writeAudit(input: {
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
        targetType: "growth.postcard_template"
      }
    });
  }
}
