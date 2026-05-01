import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import {
  ASSESSMENT_QUIZ_TEMPLATE_TYPES,
  type adminQuizTemplateCreateSchema,
  type adminQuizTemplateListQuerySchema,
  type adminQuizTemplatePatchSchema
} from "@nihongo-bjt/shared";
import type { z } from "zod";

type CreateInput = z.infer<typeof adminQuizTemplateCreateSchema>;
type PatchInput = z.infer<typeof adminQuizTemplatePatchSchema>;
type ListInput = z.infer<typeof adminQuizTemplateListQuerySchema>;

const TEMPLATE_TYPE_FILTER = { in: [...ASSESSMENT_QUIZ_TEMPLATE_TYPES] };

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
  updatedAt: true
} satisfies Prisma.BjtMockTestSelect;

@Injectable()
export class QuizTemplatesAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.BjtMockTestWhereInput = { type: TEMPLATE_TYPE_FILTER };
    if (input.status) where.status = input.status;
    if (input.level) where.level = input.level;
    if (input.type) where.type = input.type;
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
      where: { id, type: TEMPLATE_TYPE_FILTER }
    });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      where: { targetId: id, targetType: "assessment.quiz_template" }
    });
    const samplePreview = this.buildSamplePreview(row.blueprintMeta);
    return { ...row, samplePreview, audit };
  }

  async create(actorId: string, data: CreateInput) {
    await this.assertSlugUnique(data.slug, null);
    const blueprint = this.toBlueprint(data.generationRules);
    const created = await this.prisma.bjtMockTest.create({
      data: {
        slug: data.slug,
        titleVi: data.titleVi,
        titleJa: data.titleJa ?? null,
        description: data.description ?? null,
        type: data.type,
        status: "draft",
        level: data.level,
        timeLimitSeconds: data.generationRules.timeLimitSec,
        blueprintMeta: blueprint as Prisma.InputJsonValue
      }
    });
    await this.writeAudit({
      action: "admin.assessment.quiz_template.created",
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
      where: { id, type: TEMPLATE_TYPE_FILTER }
    });
    if (!before) throw new NotFoundException("Quiz template not found");
    if (data.slug && data.slug !== before.slug) await this.assertSlugUnique(data.slug, id);

    const update: Prisma.BjtMockTestUpdateInput = {};
    if (data.slug !== undefined) update.slug = data.slug;
    if (data.titleVi !== undefined) update.titleVi = data.titleVi;
    if (data.titleJa !== undefined) update.titleJa = data.titleJa;
    if (data.description !== undefined) update.description = data.description;
    if (data.level !== undefined) update.level = data.level;
    if (data.type !== undefined) update.type = data.type;
    if (data.generationRules !== undefined) {
      update.blueprintMeta = this.toBlueprint(data.generationRules) as Prisma.InputJsonValue;
      update.timeLimitSeconds = data.generationRules.timeLimitSec;
    }

    const updated = await this.prisma.bjtMockTest.update({ data: update, where: { id } });
    await this.writeAudit({
      action: "admin.assessment.quiz_template.updated",
      actorId,
      after: this.serializeForAudit(updated),
      before: this.serializeForAudit(before),
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async publish(actorId: string, id: string, reason: string) {
    const before = await this.requireRow(id);
    if (before.status === "archived") throw new BadRequestException({ code: "cannot_publish_archived" });
    if (before.status === "published") {
      await this.writeAudit({
        action: "admin.assessment.quiz_template.published",
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
      action: "admin.assessment.quiz_template.published",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async archive(actorId: string, id: string, reason: string) {
    const before = await this.requireRow(id);
    if (before.status === "archived") return this.detail(id);
    const updated = await this.prisma.bjtMockTest.update({
      data: { status: "archived" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.assessment.quiz_template.archived",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async duplicate(actorId: string, id: string, reason: string) {
    const src = await this.requireRow(id);
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
      action: "admin.assessment.quiz_template.duplicated",
      actorId,
      after: { newId: created.id, slug: created.slug, sourceId: id },
      before: null,
      reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  async remove(actorId: string, id: string, reason: string) {
    const before = await this.requireRow(id);
    if (before.status !== "draft") {
      throw new BadRequestException({ code: "only_draft_can_be_deleted", currentStatus: before.status });
    }
    const sessions = await this.prisma.quizSession.count({ where: { testId: id } });
    if (sessions > 0) {
      throw new BadRequestException({ code: "quiz_template_has_sessions", sessions });
    }
    await this.prisma.bjtMockTest.delete({ where: { id } });
    await this.writeAudit({
      action: "admin.assessment.quiz_template.deleted",
      actorId,
      after: null,
      before: this.serializeForAudit(before),
      reason,
      targetId: id
    });
    return { deleted: true, id };
  }

  private async requireRow(id: string) {
    const row = await this.prisma.bjtMockTest.findFirst({
      where: { id, type: TEMPLATE_TYPE_FILTER }
    });
    if (!row) throw new NotFoundException("Quiz template not found");
    return row;
  }

  private toBlueprint(rules: CreateInput["generationRules"]) {
    return {
      kind: "quiz_template",
      generationRules: rules,
      sections: [
        {
          code: "AUTO",
          titleVi: "Câu hỏi tự sinh",
          type: "auto",
          questionCount: rules.questionCount,
          timeLimitSec: rules.timeLimitSec
        }
      ],
      totalTimeMin: Math.max(1, Math.round(rules.timeLimitSec / 60))
    };
  }

  private buildSamplePreview(blueprint: unknown) {
    const meta = (blueprint && typeof blueprint === "object"
      ? (blueprint as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const rules = (meta.generationRules ?? {}) as {
      questionCount?: number;
      timeLimitSec?: number;
      difficultyMix?: { difficulty: string; weight: number }[];
      topicMix?: { topic: string; weight: number }[];
    };
    const total = rules.questionCount ?? 0;
    const difficultyMix = rules.difficultyMix ?? [];
    const topicMix = rules.topicMix ?? [];
    const allocateBy = (mix: { weight: number }[]) => {
      const sum = mix.reduce((acc, m) => acc + (m.weight ?? 0), 0) || 1;
      return mix.map((m) => Math.max(0, Math.round((total * (m.weight ?? 0)) / sum)));
    };
    const difficultyAlloc = allocateBy(difficultyMix);
    const topicAlloc = allocateBy(topicMix);
    return {
      totalQuestions: total,
      timeLimitSec: rules.timeLimitSec ?? 0,
      difficultyAllocation: difficultyMix.map((m, i) => ({
        difficulty: m.difficulty,
        target: difficultyAlloc[i] ?? 0
      })),
      topicAllocation: topicMix.map((m, i) => ({ topic: m.topic, target: topicAlloc[i] ?? 0 }))
    };
  }

  private async assertSlugUnique(slug: string, excludeId: string | null) {
    const existing = await this.prisma.bjtMockTest.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException({ code: "slug_already_in_use", slug });
    }
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
    type: string;
    status: string;
    timeLimitSeconds: number | null;
    blueprintMeta: unknown;
  }) {
    return {
      slug: row.slug,
      titleVi: row.titleVi,
      titleJa: row.titleJa,
      description: row.description,
      level: row.level,
      type: row.type,
      status: row.status,
      timeLimitSeconds: row.timeLimitSeconds,
      blueprintMeta: row.blueprintMeta
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
        targetType: "assessment.quiz_template"
      }
    });
  }
}
