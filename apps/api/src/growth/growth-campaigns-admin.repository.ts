import { Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import type {
  adminGrowthCampaignCreateSchema,
  adminGrowthCampaignListQuerySchema,
  adminGrowthCampaignPatchSchema
} from "@nihongo-bjt/shared";

type CreateInput = z.infer<typeof adminGrowthCampaignCreateSchema>;
type PatchInput = z.infer<typeof adminGrowthCampaignPatchSchema>;
type ListInput = z.infer<typeof adminGrowthCampaignListQuerySchema>;

const SUMMARY_SELECT = {
  id: true,
  name: true,
  status: true,
  channel: true,
  scheduleStart: true,
  scheduleEnd: true,
  createdAt: true,
  updatedAt: true
} as const;

const RISKY_PATTERNS = [
  /\bshame\b/i,
  /lose\s+your\s+streak/i,
  /streak\s+will\s+(end|expire)/i,
  /limited\s+time\s+offer\s+ending\s+in\s+\d+\s*(seconds?|minutes?)/i,
  /act\s+now\s+or/i,
  /don't\s+miss\s+out/i
];

export function detectEthicsWarnings(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const p of RISKY_PATTERNS) {
    if (p.test(text)) out.push(p.source);
  }
  return out;
}

@Injectable()
export class GrowthCampaignsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.GrowthCampaignWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.channel) where.channel = input.channel;
    if (input.q) {
      where.OR = [
        { name: { contains: input.q, mode: "insensitive" } },
        { description: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.growthCampaign.findMany({
        orderBy: { updatedAt: "desc" },
        select: SUMMARY_SELECT,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.growthCampaign.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async detail(id: string) {
    const row = await this.prisma.growthCampaign.findUnique({ where: { id } });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      where: { targetId: id, targetType: "growth.campaign" }
    });
    const warnings = detectEthicsWarnings(`${row.name}\n${row.description ?? ""}\n${row.contentBody ?? ""}`);
    return { ...row, audit, ethicsWarnings: warnings };
  }

  async estimateAudienceSize(audience: Record<string, unknown> | null | undefined) {
    const where: Prisma.UserProfileWhereInput = { status: "active" };
    if (audience && typeof audience === "object") {
      const a = audience as { locale?: string; level?: string };
      if (a.locale) where.uiLocale = a.locale;
      if (a.level) where.targetBjtBand = a.level;
    }
    const total = await this.prisma.userProfile.count({ where });
    return { total, filters: audience ?? {} };
  }

  async create(actorId: string, data: CreateInput) {
    const row = await this.prisma.growthCampaign.create({
      data: {
        audience: (data.audience ?? {}) as Prisma.InputJsonValue,
        channel: data.channel,
        contentBody: data.contentBody ?? null,
        createdById: actorId,
        cta: (data.cta ?? {}) as Prisma.InputJsonValue,
        description: data.description ?? null,
        name: data.name,
        scheduleEnd: data.scheduleEnd ?? null,
        scheduleStart: data.scheduleStart ?? null,
        status: "draft",
        trackingUtm: (data.trackingUtm ?? {}) as Prisma.InputJsonValue,
        updatedById: actorId
      }
    });
    await this.writeAudit({
      action: "admin.growth.campaign.created",
      actorId,
      after: this.toAudit(row),
      before: null,
      reason: data.reason,
      targetId: row.id
    });
    return this.detail(row.id);
  }

  async patch(actorId: string, id: string, data: PatchInput) {
    const before = await this.prisma.growthCampaign.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Growth campaign not found");
    const update: Prisma.GrowthCampaignUpdateInput = { updatedById: actorId };
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (data.channel !== undefined) update.channel = data.channel;
    if (data.audience !== undefined) update.audience = data.audience as Prisma.InputJsonValue;
    if (data.cta !== undefined) update.cta = data.cta as Prisma.InputJsonValue;
    if (data.contentBody !== undefined) update.contentBody = data.contentBody;
    if (data.trackingUtm !== undefined) update.trackingUtm = data.trackingUtm as Prisma.InputJsonValue;
    if (data.scheduleStart !== undefined) update.scheduleStart = data.scheduleStart;
    if (data.scheduleEnd !== undefined) update.scheduleEnd = data.scheduleEnd;
    const updated = await this.prisma.growthCampaign.update({ data: update, where: { id } });
    await this.writeAudit({
      action: "admin.growth.campaign.updated",
      actorId,
      after: this.toAudit(updated),
      before: this.toAudit(before),
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async transition(
    actorId: string,
    id: string,
    nextStatus: "scheduled" | "active" | "ended" | "archived",
    reason: string
  ) {
    const before = await this.prisma.growthCampaign.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Growth campaign not found");
    if (before.status === nextStatus) {
      await this.writeAudit({
        action: `admin.growth.campaign.${nextStatus}`,
        actorId,
        after: { status: nextStatus, noop: true },
        before: { status: before.status },
        reason,
        targetId: id
      });
      return this.detail(id);
    }
    const updated = await this.prisma.growthCampaign.update({
      data: { status: nextStatus, updatedById: actorId },
      where: { id }
    });
    await this.writeAudit({
      action: `admin.growth.campaign.${nextStatus}`,
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async duplicate(actorId: string, id: string, reason: string) {
    const src = await this.prisma.growthCampaign.findUnique({ where: { id } });
    if (!src) throw new NotFoundException("Growth campaign not found");
    const created = await this.prisma.growthCampaign.create({
      data: {
        audience: src.audience as Prisma.InputJsonValue,
        channel: src.channel,
        contentBody: src.contentBody,
        createdById: actorId,
        cta: src.cta as Prisma.InputJsonValue,
        description: src.description,
        name: this.suffixCopy(src.name),
        status: "draft",
        trackingUtm: src.trackingUtm as Prisma.InputJsonValue,
        updatedById: actorId
      }
    });
    await this.writeAudit({
      action: "admin.growth.campaign.duplicated",
      actorId,
      after: { name: created.name, newId: created.id, sourceId: id },
      before: null,
      reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  private suffixCopy(name: string): string {
    const base = " (copy)";
    if (name.length + base.length <= 200) return `${name}${base}`;
    return `${name.slice(0, 200 - base.length)}${base}`;
  }

  private toAudit(row: {
    audience: unknown;
    channel: string;
    contentBody: string | null;
    cta: unknown;
    description: string | null;
    name: string;
    scheduleEnd: Date | null;
    scheduleStart: Date | null;
    status: string;
    trackingUtm: unknown;
  }) {
    return {
      audience: row.audience,
      channel: row.channel,
      contentBody: row.contentBody,
      cta: row.cta,
      description: row.description,
      name: row.name,
      scheduleEnd: row.scheduleEnd,
      scheduleStart: row.scheduleStart,
      status: row.status,
      trackingUtm: row.trackingUtm
    };
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
        targetType: "growth.campaign"
      }
    });
  }
}
