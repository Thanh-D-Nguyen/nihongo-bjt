import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";
import type {
  adminCompetencyCreateSchema,
  adminCompetencyListQuerySchema,
  adminCompetencyPatchSchema
} from "@nihongo-bjt/shared";

type CreateInput = z.infer<typeof adminCompetencyCreateSchema>;
type PatchInput = z.infer<typeof adminCompetencyPatchSchema>;
type ListInput = z.infer<typeof adminCompetencyListQuerySchema>;

const TARGET_TYPE = "learning.competency";

@Injectable()
export class CompetenciesAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.CompetencyWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.level) where.level = input.level;
    if (input.q) {
      where.OR = [
        { code: { contains: input.q, mode: "insensitive" } },
        { titleVi: { contains: input.q, mode: "insensitive" } },
        { titleJa: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total, statusCounts] = await Promise.all([
      this.prisma.competency.findMany({
        orderBy: [{ status: "asc" }, { level: "asc" }, { updatedAt: "desc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.competency.count({ where }),
      this.prisma.competency.groupBy({ by: ["status"], _count: { _all: true } })
    ]);
    const counts = statusCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});
    return { items, page: input.page, pageSize: input.pageSize, total, statusCounts: counts };
  }

  async detail(id: string) {
    const row = await this.prisma.competency.findUnique({ where: { id } });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
      where: { targetId: id, targetType: TARGET_TYPE }
    });
    return { ...row, audit };
  }

  async create(actorId: string, data: CreateInput) {
    const conflict = await this.prisma.competency.findUnique({ where: { code: data.code } });
    if (conflict) {
      throw new BadRequestException({ code: "code_already_exists", competencyCode: data.code });
    }
    const created = await this.prisma.competency.create({
      data: {
        code: data.code,
        descriptionVi: data.descriptionVi ?? null,
        level: data.level,
        status: "draft",
        titleJa: data.titleJa ?? null,
        titleVi: data.titleVi
      }
    });
    await this.writeAudit({
      action: "admin.learning.competency.created",
      actorId,
      after: this.serialize(created),
      before: null,
      reason: data.reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  async patch(actorId: string, id: string, data: PatchInput) {
    const before = await this.prisma.competency.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Competency not found");
    if (data.code && data.code !== before.code) {
      const conflict = await this.prisma.competency.findUnique({ where: { code: data.code } });
      if (conflict) {
        throw new BadRequestException({ code: "code_already_exists", competencyCode: data.code });
      }
    }
    const update: Prisma.CompetencyUpdateInput = {};
    if (data.code !== undefined) update.code = data.code;
    if (data.titleVi !== undefined) update.titleVi = data.titleVi;
    if (data.titleJa !== undefined) update.titleJa = data.titleJa;
    if (data.descriptionVi !== undefined) update.descriptionVi = data.descriptionVi;
    if (data.level !== undefined) update.level = data.level;

    const updated = await this.prisma.competency.update({ data: update, where: { id } });
    await this.writeAudit({
      action: "admin.learning.competency.updated",
      actorId,
      after: this.serialize(updated),
      before: this.serialize(before),
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async publish(actorId: string, id: string, reason: string) {
    const before = await this.prisma.competency.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Competency not found");
    if (before.status === "archived") {
      throw new BadRequestException({ code: "cannot_publish_archived" });
    }
    if (before.status === "published") {
      await this.writeAudit({
        action: "admin.learning.competency.published",
        actorId,
        after: { status: "published", noop: true },
        before: { status: before.status },
        reason,
        targetId: id
      });
      return this.detail(id);
    }
    const updated = await this.prisma.competency.update({
      data: { status: "published" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.learning.competency.published",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async archive(actorId: string, id: string, reason: string) {
    const before = await this.prisma.competency.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Competency not found");
    if (before.status === "archived") return this.detail(id);
    const updated = await this.prisma.competency.update({
      data: { status: "archived" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.learning.competency.archived",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async remove(actorId: string, id: string, reason: string) {
    const before = await this.prisma.competency.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Competency not found");
    if (before.status !== "draft") {
      throw new BadRequestException({
        code: "only_draft_can_be_deleted",
        currentStatus: before.status
      });
    }
    await this.prisma.competency.delete({ where: { id } });
    await this.writeAudit({
      action: "admin.learning.competency.deleted",
      actorId,
      after: null,
      before: this.serialize(before),
      reason,
      targetId: id
    });
    return { deleted: true, id };
  }

  private serialize(row: {
    code: string;
    descriptionVi: string | null;
    level: string;
    status: string;
    titleJa: string | null;
    titleVi: string;
  }) {
    return {
      code: row.code,
      descriptionVi: row.descriptionVi,
      level: row.level,
      status: row.status,
      titleJa: row.titleJa,
      titleVi: row.titleVi
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
