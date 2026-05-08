import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import type {
  adminMockExamCreateSchema,
  adminMockExamListQuerySchema,
  adminMockExamPatchSchema,
  ASSESSMENT_EXAM_TYPES,
  ASSESSMENT_QUIZ_TEMPLATE_TYPES
} from "@nihongo-bjt/shared";

type CreateInput = z.infer<typeof adminMockExamCreateSchema>;
type PatchInput = z.infer<typeof adminMockExamPatchSchema>;
type ListInput = z.infer<typeof adminMockExamListQuerySchema>;

const TEMPLATE_TYPES: readonly (typeof ASSESSMENT_QUIZ_TEMPLATE_TYPES)[number][] = [
  "practice",
  "daily",
  "weekly",
  "topic_mastery",
  "diagnostic"
];

const EXAM_TYPES: readonly (typeof ASSESSMENT_EXAM_TYPES)[number][] = ["mock", "official"];
const VISIBLE_TEST_TYPES = [...EXAM_TYPES, "practice"] as const;

const SUMMARY_SELECT = {
  id: true,
  slug: true,
  titleVi: true,
  titleJa: true,
  type: true,
  status: true,
  level: true,
  timeLimitSeconds: true,
  description: true,
  blueprintMeta: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { sections: true, sessions: true } }
} satisfies Prisma.BjtMockTestSelect;

@Injectable()
export class MockExamsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.BjtMockTestWhereInput = input.type
      ? { type: input.type }
      : { type: { in: [...VISIBLE_TEST_TYPES] } };
    if (input.status) where.status = input.status;
    if (input.level) where.level = { in: this.levelCandidates(input.level) };
    if (input.q) {
      where.OR = [
        { slug: { contains: input.q, mode: "insensitive" } },
        { titleVi: { contains: input.q, mode: "insensitive" } },
        { titleJa: { contains: input.q, mode: "insensitive" } },
        { description: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.bjtMockTest.findMany({
        orderBy: { updatedAt: "desc" },
        select: SUMMARY_SELECT,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.bjtMockTest.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async detail(id: string) {
    const row = await this.prisma.bjtMockTest.findFirst({
      include: {
        sections: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            code: true,
            titleVi: true,
            titleJa: true,
            displayOrder: true,
            _count: { select: { questions: true } }
          }
        },
        _count: { select: { sessions: true } }
      },
      where: { id, type: { in: [...VISIBLE_TEST_TYPES] } }
    });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      where: { targetId: id, targetType: "assessment.mock_exam" }
    });
    const audienceEstimate = await this.estimateAudience(row.level);
    return { ...row, audienceEstimate, audit };
  }

  async create(actorId: string, data: CreateInput) {
    await this.assertSlugUnique(data.slug, null);
    const created = await this.prisma.bjtMockTest.create({
      data: {
        slug: data.slug,
        titleVi: data.titleVi,
        titleJa: data.titleJa ?? null,
        description: data.description ?? null,
        type: data.type ?? "mock",
        status: "draft",
        level: data.level,
        timeLimitSeconds: data.timeLimitSeconds,
        blueprintMeta: data.blueprintMeta as unknown as Prisma.InputJsonValue
      }
    });
    await this.writeAudit({
      action: "admin.assessment.mock_exam.created",
      actorId,
      after: this.serializeForAudit(created),
      before: null,
      reason: data.reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  async patch(actorId: string, id: string, data: PatchInput) {
    const before = await this.prisma.bjtMockTest.findFirst({
      where: { id, type: { in: [...EXAM_TYPES] } }
    });
    if (!before) throw new NotFoundException("Mock exam not found");
    if (data.slug && data.slug !== before.slug) await this.assertSlugUnique(data.slug, id);

    const update: Prisma.BjtMockTestUpdateInput = {};
    if (data.slug !== undefined) update.slug = data.slug;
    if (data.titleVi !== undefined) update.titleVi = data.titleVi;
    if (data.titleJa !== undefined) update.titleJa = data.titleJa;
    if (data.description !== undefined) update.description = data.description;
    if (data.type !== undefined) update.type = data.type;
    if (data.level !== undefined) update.level = data.level;
    if (data.timeLimitSeconds !== undefined) update.timeLimitSeconds = data.timeLimitSeconds;
    if (data.blueprintMeta !== undefined) {
      update.blueprintMeta = data.blueprintMeta as unknown as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.bjtMockTest.update({ data: update, where: { id } });
    await this.writeAudit({
      action: "admin.assessment.mock_exam.updated",
      actorId,
      after: this.serializeForAudit(updated),
      before: this.serializeForAudit(before),
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async publish(actorId: string, id: string, reason: string) {
    const before = await this.prisma.bjtMockTest.findFirst({
      where: { id, type: { in: [...EXAM_TYPES] } }
    });
    if (!before) throw new NotFoundException("Mock exam not found");
    if (before.status === "archived") {
      throw new BadRequestException({ code: "cannot_publish_archived" });
    }
    if (before.status === "published") {
      await this.writeAudit({
        action: "admin.assessment.mock_exam.published",
        actorId,
        after: { status: "published", noop: true },
        before: { status: before.status },
        reason,
        targetId: id
      });
      return this.detail(id);
    }
    const updated = await this.prisma.bjtMockTest.update({
      data: { status: "published" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.assessment.mock_exam.published",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async archive(actorId: string, id: string, reason: string) {
    const before = await this.prisma.bjtMockTest.findFirst({
      where: { id, type: { in: [...EXAM_TYPES] } }
    });
    if (!before) throw new NotFoundException("Mock exam not found");
    if (before.status === "archived") return this.detail(id);
    const updated = await this.prisma.bjtMockTest.update({
      data: { status: "archived" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.assessment.mock_exam.archived",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async duplicate(actorId: string, id: string, reason: string) {
    const src = await this.prisma.bjtMockTest.findFirst({
      where: { id, type: { in: [...EXAM_TYPES] } }
    });
    if (!src) throw new NotFoundException("Mock exam not found");
    const slug = await this.uniqueCopySlug(src.slug);
    const created = await this.prisma.bjtMockTest.create({
      data: {
        slug,
        titleVi: this.suffixCopy(src.titleVi),
        titleJa: src.titleJa,
        description: src.description,
        type: src.type,
        status: "draft",
        level: src.level,
        timeLimitSeconds: src.timeLimitSeconds,
        blueprintMeta: (src.blueprintMeta ?? Prisma.JsonNull) as Prisma.InputJsonValue
      }
    });
    await this.writeAudit({
      action: "admin.assessment.mock_exam.duplicated",
      actorId,
      after: { newId: created.id, slug: created.slug, sourceId: id },
      before: null,
      reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  async remove(actorId: string, id: string, reason: string) {
    const before = await this.prisma.bjtMockTest.findFirst({
      where: { id, type: { in: [...EXAM_TYPES] } }
    });
    if (!before) throw new NotFoundException("Mock exam not found");
    if (before.status !== "draft") {
      throw new BadRequestException({
        code: "only_draft_can_be_deleted",
        currentStatus: before.status
      });
    }
    const sessions = await this.prisma.quizSession.count({ where: { testId: id } });
    if (sessions > 0) {
      throw new BadRequestException({ code: "mock_exam_has_sessions", sessions });
    }
    await this.prisma.bjtMockTest.delete({ where: { id } });
    await this.writeAudit({
      action: "admin.assessment.mock_exam.deleted",
      actorId,
      after: null,
      before: this.serializeForAudit(before),
      reason,
      targetId: id
    });
    return { deleted: true, id };
  }

  /** Audience estimate: count of active learners whose `targetBjtBand` matches the level (loose). */
  private async estimateAudience(level: string | null): Promise<number> {
    if (!level) return 0;
    const candidates = Array.from(
      new Set([
        level,
        level.replace(/^BJT-/, ""),
        level.replace(/^BJT-J/, "J"),
        level.replace(/^BJT-J/, "")
      ])
    );
    return this.prisma.userProfile
      .count({
        where: { status: "active", targetBjtBand: { in: candidates } }
      })
      .catch(() => 0);
  }

  private async assertSlugUnique(slug: string, excludeId: string | null) {
    const existing = await this.prisma.bjtMockTest.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException({ code: "slug_already_in_use", slug });
    }
  }

  private levelCandidates(level: string) {
    return Array.from(
      new Set([
        level,
        level.replace(/^BJT-/, ""),
        level.startsWith("BJT-") ? level : `BJT-${level}`
      ])
    );
  }

  private async uniqueCopySlug(base: string) {
    let candidate = `${base}-copy`;
    for (let n = 1; n <= 50; n += 1) {
      const found = await this.prisma.bjtMockTest.findUnique({ where: { slug: candidate } });
      if (!found) return candidate;
      candidate = `${base}-copy-${n + 1}`;
    }
    return `${base}-copy-${Date.now()}`;
  }

  private suffixCopy(name: string): string {
    const base = ` (copy)`;
    if (name.length + base.length <= 200) return `${name}${base}`;
    return `${name.slice(0, 200 - base.length)}${base}`;
  }

  private serializeForAudit(row: {
    slug: string;
    titleVi: string;
    titleJa: string | null;
    description: string | null;
    level: string | null;
    timeLimitSeconds: number | null;
    blueprintMeta: unknown;
    status: string;
  }) {
    return {
      slug: row.slug,
      titleVi: row.titleVi,
      titleJa: row.titleJa,
      description: row.description,
      level: row.level,
      timeLimitSeconds: row.timeLimitSeconds,
      blueprintMeta: row.blueprintMeta,
      status: row.status
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
        targetType: "assessment.mock_exam"
      }
    });
  }

  /** Re-export for module wiring tests. */
  static readonly TEMPLATE_TYPES = TEMPLATE_TYPES;
}
