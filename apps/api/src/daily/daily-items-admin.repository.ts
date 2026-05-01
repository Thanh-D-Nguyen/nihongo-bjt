import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";
import type {
  adminDailyContentItemCreateSchema,
  adminDailyContentItemListQuerySchema,
  adminDailyContentItemPatchSchema
} from "@nihongo-bjt/shared";

type CreateInput = z.infer<typeof adminDailyContentItemCreateSchema>;
type PatchInput = z.infer<typeof adminDailyContentItemPatchSchema>;
type ListInput = z.infer<typeof adminDailyContentItemListQuerySchema>;

const TARGET_TYPE = "daily.daily_content_item";

@Injectable()
export class DailyItemsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.DailyContentItemWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.locale) where.locale = input.locale;
    if (input.widgetKind) where.widgetKind = input.widgetKind;
    if (input.from) where.contentDate = { ...(where.contentDate as object), gte: this.toDate(input.from) };
    if (input.to) where.contentDate = { ...(where.contentDate as object), lte: this.toDate(input.to) };
    if (input.q) {
      where.OR = [
        { title: { contains: input.q, mode: "insensitive" } },
        { japaneseText: { contains: input.q, mode: "insensitive" } },
        { explanationText: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total, statusCounts] = await Promise.all([
      this.prisma.dailyContentItem.findMany({
        orderBy: [{ contentDate: "desc" }, { widgetKind: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.dailyContentItem.count({ where }),
      this.prisma.dailyContentItem.groupBy({ by: ["status"], _count: { _all: true } })
    ]);
    const counts = statusCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});
    return { items, page: input.page, pageSize: input.pageSize, total, statusCounts: counts };
  }

  async detail(id: string) {
    const row = await this.prisma.dailyContentItem.findUnique({
      include: { extraction: true, _count: { select: { actions: true } } },
      where: { id }
    });
    if (!row) return null;

    const [actionsByType, audit] = await Promise.all([
      this.prisma.dailyUserAction.groupBy({
        by: ["actionType"],
        _count: { _all: true },
        where: { dailyContentItemId: id }
      }),
      this.prisma.adminAuditLog.findMany({
        include: { actor: { select: { id: true, displayName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 25,
        where: { targetId: id, targetType: TARGET_TYPE }
      })
    ]);
    const engagement = actionsByType.reduce<Record<string, number>>((acc, row) => {
      acc[row.actionType] = row._count._all;
      return acc;
    }, {});
    return { ...row, engagement, audit };
  }

  async create(actorId: string, data: CreateInput) {
    const widgetConfig = await this.prisma.dailyWidgetConfig.findFirst({
      where: { locale: data.locale, widgetKind: data.widgetKind }
    });
    const created = await this.prisma.dailyContentItem.create({
      data: {
        bodyMd: data.bodyMd ?? null,
        contentDate: this.toDate(data.contentDate),
        explanationText: data.explanationText ?? null,
        japaneseText: data.japaneseText ?? null,
        locale: data.locale,
        readingText: data.readingText ?? null,
        sourceProvider: data.sourceProvider ?? null,
        sourceRef: data.sourceRef ?? null,
        status: "draft",
        title: data.title,
        widgetConfigId: widgetConfig?.id ?? null,
        widgetKind: data.widgetKind
      }
    });
    await this.writeAudit({
      action: "admin.daily.item.created",
      actorId,
      after: this.serialize(created),
      before: null,
      reason: data.reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  async patch(actorId: string, id: string, data: PatchInput) {
    const before = await this.prisma.dailyContentItem.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Daily content item not found");

    const update: Prisma.DailyContentItemUpdateInput = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.widgetKind !== undefined) update.widgetKind = data.widgetKind;
    if (data.locale !== undefined) update.locale = data.locale;
    if (data.contentDate !== undefined) update.contentDate = this.toDate(data.contentDate);
    if (data.bodyMd !== undefined) update.bodyMd = data.bodyMd;
    if (data.japaneseText !== undefined) update.japaneseText = data.japaneseText;
    if (data.readingText !== undefined) update.readingText = data.readingText;
    if (data.explanationText !== undefined) update.explanationText = data.explanationText;
    if (data.sourceProvider !== undefined) update.sourceProvider = data.sourceProvider;
    if (data.sourceRef !== undefined) update.sourceRef = data.sourceRef;

    const updated = await this.prisma.dailyContentItem.update({ data: update, where: { id } });
    await this.writeAudit({
      action: "admin.daily.item.updated",
      actorId,
      after: this.serialize(updated),
      before: this.serialize(before),
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async publish(actorId: string, id: string, reason: string) {
    const before = await this.prisma.dailyContentItem.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Daily content item not found");
    if (before.status === "archived") {
      throw new BadRequestException({ code: "cannot_publish_archived" });
    }
    if (before.status === "published") {
      await this.writeAudit({
        action: "admin.daily.item.published",
        actorId,
        after: { status: "published", noop: true },
        before: { status: before.status },
        reason,
        targetId: id
      });
      return this.detail(id);
    }
    const updated = await this.prisma.dailyContentItem.update({
      data: { status: "published" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.daily.item.published",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async schedule(actorId: string, id: string, reason: string) {
    const before = await this.prisma.dailyContentItem.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Daily content item not found");
    if (before.status === "archived") {
      throw new BadRequestException({ code: "cannot_schedule_archived" });
    }
    if (before.status === "scheduled") {
      return this.detail(id);
    }
    const updated = await this.prisma.dailyContentItem.update({
      data: { status: "scheduled" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.daily.item.scheduled",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async archive(actorId: string, id: string, reason: string) {
    const before = await this.prisma.dailyContentItem.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Daily content item not found");
    if (before.status === "archived") return this.detail(id);
    const updated = await this.prisma.dailyContentItem.update({
      data: { status: "archived" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.daily.item.archived",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async remove(actorId: string, id: string, reason: string) {
    const before = await this.prisma.dailyContentItem.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Daily content item not found");
    if (before.status !== "draft") {
      throw new BadRequestException({
        code: "only_draft_can_be_deleted",
        currentStatus: before.status
      });
    }
    await this.prisma.dailyContentItem.delete({ where: { id } });
    await this.writeAudit({
      action: "admin.daily.item.deleted",
      actorId,
      after: null,
      before: this.serialize(before),
      reason,
      targetId: id
    });
    return { deleted: true, id };
  }

  private toDate(input: string | Date): Date {
    if (input instanceof Date) return input;
    return new Date(`${input}T00:00:00.000Z`);
  }

  private serialize(row: {
    bodyMd: string | null;
    contentDate: Date;
    explanationText: string | null;
    japaneseText: string | null;
    locale: string;
    readingText: string | null;
    sourceProvider: string | null;
    sourceRef: string | null;
    status: string;
    title: string;
    widgetKind: string;
  }) {
    return {
      bodyMd: row.bodyMd,
      contentDate: row.contentDate.toISOString().slice(0, 10),
      explanationText: row.explanationText,
      japaneseText: row.japaneseText,
      locale: row.locale,
      readingText: row.readingText,
      sourceProvider: row.sourceProvider,
      sourceRef: row.sourceRef,
      status: row.status,
      title: row.title,
      widgetKind: row.widgetKind
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
        targetType: TARGET_TYPE
      }
    });
  }
}
