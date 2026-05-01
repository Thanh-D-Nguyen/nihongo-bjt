import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";
import type {
  adminLearningPathCreateSchema,
  adminLearningPathListQuerySchema,
  adminLearningPathPatchSchema
} from "@nihongo-bjt/shared";

type CreateInput = z.infer<typeof adminLearningPathCreateSchema>;
type PatchInput = z.infer<typeof adminLearningPathPatchSchema>;
type ListInput = z.infer<typeof adminLearningPathListQuerySchema>;

const TARGET_TYPE = "learning.learning_path";

@Injectable()
export class LearningPathsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.LearningPathWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.targetLevel) where.targetLevel = input.targetLevel;
    if (input.q) {
      where.OR = [
        { slug: { contains: input.q, mode: "insensitive" } },
        { titleVi: { contains: input.q, mode: "insensitive" } },
        { titleJa: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total, statusCounts] = await Promise.all([
      this.prisma.learningPath.findMany({
        orderBy: [{ status: "asc" }, { displayOrder: "asc" }, { updatedAt: "desc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.learningPath.count({ where }),
      this.prisma.learningPath.groupBy({ by: ["status"], _count: { _all: true } })
    ]);
    const counts = statusCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});
    return { items, page: input.page, pageSize: input.pageSize, total, statusCounts: counts };
  }

  async detail(id: string) {
    const row = await this.prisma.learningPath.findUnique({ where: { id } });
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
    const conflict = await this.prisma.learningPath.findUnique({ where: { slug: data.slug } });
    if (conflict) {
      throw new BadRequestException({ code: "slug_already_exists", slug: data.slug });
    }
    const created = await this.prisma.learningPath.create({
      data: {
        descriptionJa: data.descriptionJa ?? null,
        descriptionVi: data.descriptionVi ?? null,
        displayOrder: data.displayOrder,
        slug: data.slug,
        status: "draft",
        targetLevel: data.targetLevel ?? null,
        titleJa: data.titleJa ?? null,
        titleVi: data.titleVi
      }
    });
    await this.writeAudit({
      action: "admin.learning.path.created",
      actorId,
      after: this.serialize(created),
      before: null,
      reason: data.reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  async patch(actorId: string, id: string, data: PatchInput) {
    const before = await this.prisma.learningPath.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Learning path not found");
    if (data.slug && data.slug !== before.slug) {
      const conflict = await this.prisma.learningPath.findUnique({ where: { slug: data.slug } });
      if (conflict) {
        throw new BadRequestException({ code: "slug_already_exists", slug: data.slug });
      }
    }
    const update: Prisma.LearningPathUpdateInput = {};
    if (data.slug !== undefined) update.slug = data.slug;
    if (data.titleVi !== undefined) update.titleVi = data.titleVi;
    if (data.titleJa !== undefined) update.titleJa = data.titleJa;
    if (data.descriptionVi !== undefined) update.descriptionVi = data.descriptionVi;
    if (data.descriptionJa !== undefined) update.descriptionJa = data.descriptionJa;
    if (data.targetLevel !== undefined) update.targetLevel = data.targetLevel;
    if (data.displayOrder !== undefined) update.displayOrder = data.displayOrder;

    const updated = await this.prisma.learningPath.update({ data: update, where: { id } });
    await this.writeAudit({
      action: "admin.learning.path.updated",
      actorId,
      after: this.serialize(updated),
      before: this.serialize(before),
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async publish(actorId: string, id: string, reason: string) {
    const before = await this.prisma.learningPath.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Learning path not found");
    if (before.status === "archived") {
      throw new BadRequestException({ code: "cannot_publish_archived" });
    }
    if (before.status === "published") {
      await this.writeAudit({
        action: "admin.learning.path.published",
        actorId,
        after: { status: "published", noop: true },
        before: { status: before.status },
        reason,
        targetId: id
      });
      return this.detail(id);
    }
    const updated = await this.prisma.learningPath.update({
      data: { status: "published" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.learning.path.published",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async archive(actorId: string, id: string, reason: string) {
    const before = await this.prisma.learningPath.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Learning path not found");
    if (before.status === "archived") return this.detail(id);
    const updated = await this.prisma.learningPath.update({
      data: { status: "archived" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.learning.path.archived",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async duplicate(actorId: string, id: string, reason: string) {
    const src = await this.prisma.learningPath.findUnique({ where: { id } });
    if (!src) throw new NotFoundException("Learning path not found");
    const baseSlug = `${src.slug}-copy`;
    const slug = await this.findFreeSlug(baseSlug);
    const created = await this.prisma.learningPath.create({
      data: {
        descriptionJa: src.descriptionJa,
        descriptionVi: src.descriptionVi,
        displayOrder: src.displayOrder,
        slug,
        status: "draft",
        targetLevel: src.targetLevel,
        titleJa: src.titleJa,
        titleVi: `${src.titleVi} (copy)`
      }
    });
    await this.writeAudit({
      action: "admin.learning.path.duplicated",
      actorId,
      after: { newId: created.id, slug, sourceId: id },
      before: null,
      reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  async remove(actorId: string, id: string, reason: string) {
    const before = await this.prisma.learningPath.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Learning path not found");
    if (before.status !== "draft") {
      throw new BadRequestException({
        code: "only_draft_can_be_deleted",
        currentStatus: before.status
      });
    }
    await this.prisma.learningPath.delete({ where: { id } });
    await this.writeAudit({
      action: "admin.learning.path.deleted",
      actorId,
      after: null,
      before: this.serialize(before),
      reason,
      targetId: id
    });
    return { deleted: true, id };
  }

  private async findFreeSlug(base: string): Promise<string> {
    let candidate = base;
    let n = 2;
    while (await this.prisma.learningPath.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${n}`;
      n += 1;
      if (n > 50) {
        candidate = `${base}-${Date.now()}`;
        break;
      }
    }
    return candidate.slice(0, 128);
  }

  private serialize(row: {
    descriptionJa: string | null;
    descriptionVi: string | null;
    displayOrder: number;
    slug: string;
    status: string;
    targetLevel: string | null;
    titleJa: string | null;
    titleVi: string;
  }) {
    return {
      descriptionJa: row.descriptionJa,
      descriptionVi: row.descriptionVi,
      displayOrder: row.displayOrder,
      slug: row.slug,
      status: row.status,
      targetLevel: row.targetLevel,
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
