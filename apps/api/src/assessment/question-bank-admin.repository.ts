import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type {
  adminQuestionBankBulkActionSchema,
  adminQuestionBankCreateSchema,
  adminQuestionBankListQuerySchema,
  adminQuestionBankPatchSchema,
  adminQuestionBankSuggestEditSchema
} from "@nihongo-bjt/shared";
import type { z } from "zod";

type ListInput = z.infer<typeof adminQuestionBankListQuerySchema>;
type CreateInput = z.infer<typeof adminQuestionBankCreateSchema>;
type PatchInput = z.infer<typeof adminQuestionBankPatchSchema>;
type BulkInput = z.infer<typeof adminQuestionBankBulkActionSchema>;
type SuggestInput = z.infer<typeof adminQuestionBankSuggestEditSchema>;

const SUMMARY_SELECT = {
  id: true,
  sectionId: true,
  prompt: true,
  scenario: true,
  skillTag: true,
  difficulty: true,
  tags: true,
  status: true,
  remediationCardId: true,
  createdAt: true,
  updatedAt: true,
  section: {
    select: {
      id: true,
      code: true,
      titleVi: true,
      test: { select: { id: true, slug: true, titleVi: true, level: true, type: true } }
    }
  },
  _count: { select: { options: true, answers: true } }
} satisfies Prisma.BjtQuestionSelect;

@Injectable()
export class QuestionBankAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.BjtQuestionWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.topic) where.skillTag = input.topic;
    if (input.difficulty) where.difficulty = input.difficulty;
    if (input.sectionId) where.sectionId = input.sectionId;
    if (input.tags && input.tags.length > 0) where.tags = { hasEvery: input.tags };
    if (input.level) where.section = { test: { level: input.level } };
    if (input.q) {
      where.OR = [
        { prompt: { contains: input.q, mode: "insensitive" } },
        { explanationVi: { contains: input.q, mode: "insensitive" } },
        { scenario: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.bjtQuestion.findMany({
        orderBy: { updatedAt: "desc" },
        select: SUMMARY_SELECT,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.bjtQuestion.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async detail(id: string) {
    const row = await this.prisma.bjtQuestion.findUnique({
      include: {
        section: {
          select: {
            id: true,
            code: true,
            titleVi: true,
            test: { select: { id: true, slug: true, titleVi: true, level: true, type: true } }
          }
        },
        options: { orderBy: { optionKey: "asc" } },
        remediationCard: { select: { id: true, sourceType: true, sourceId: true, frontText: true } },
        _count: { select: { answers: true } }
      },
      where: { id }
    });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
      where: { targetId: id, targetType: "assessment.question" }
    });
    return { ...row, audit };
  }

  async create(actorId: string, data: CreateInput) {
    const created = await this.prisma.$transaction(async (tx) => {
      const q = await tx.bjtQuestion.create({
        data: {
          sectionId: data.sectionId,
          prompt: data.prompt,
          scenario: data.scenario ?? null,
          explanationVi: data.explanationVi,
          skillTag: data.skillTag,
          difficulty: data.difficulty,
          tags: data.tags,
          sourceType: data.sourceType ?? null,
          sourceId: data.sourceId ?? null,
          status: "draft",
          options: {
            create: data.options.map((o) => ({
              optionKey: o.optionKey,
              text: o.text,
              isCorrect: o.isCorrect
            }))
          }
        }
      });
      return q;
    });
    await this.writeAudit({
      action: "admin.assessment.question.created",
      actorId,
      after: this.serializeForAudit(created),
      before: null,
      reason: data.reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  async patch(actorId: string, id: string, data: PatchInput) {
    const before = await this.prisma.bjtQuestion.findUnique({
      include: { options: { orderBy: { optionKey: "asc" } } },
      where: { id }
    });
    if (!before) throw new NotFoundException("Question not found");

    await this.prisma.$transaction(async (tx) => {
      const update: Prisma.BjtQuestionUpdateInput = {};
      if (data.sectionId !== undefined) update.section = { connect: { id: data.sectionId } };
      if (data.prompt !== undefined) update.prompt = data.prompt;
      if (data.scenario !== undefined) update.scenario = data.scenario;
      if (data.explanationVi !== undefined) update.explanationVi = data.explanationVi;
      if (data.skillTag !== undefined) update.skillTag = data.skillTag;
      if (data.difficulty !== undefined) update.difficulty = data.difficulty;
      if (data.tags !== undefined) update.tags = data.tags;
      if (data.sourceType !== undefined) update.sourceType = data.sourceType;
      if (data.sourceId !== undefined) update.sourceId = data.sourceId ?? null;
      await tx.bjtQuestion.update({ data: update, where: { id } });
      if (data.options) {
        await tx.bjtQuestionOption.deleteMany({ where: { questionId: id } });
        await tx.bjtQuestionOption.createMany({
          data: data.options.map((o) => ({
            questionId: id,
            optionKey: o.optionKey,
            text: o.text,
            isCorrect: o.isCorrect
          }))
        });
      }
    });
    const updated = await this.prisma.bjtQuestion.findUnique({
      include: { options: { orderBy: { optionKey: "asc" } } },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.assessment.question.updated",
      actorId,
      after: updated ? this.serializeForAudit(updated) : null,
      before: this.serializeForAudit(before),
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async bulk(actorId: string, data: BulkInput) {
    const rows = await this.prisma.bjtQuestion.findMany({ where: { id: { in: data.ids } } });
    let processed = 0;
    for (const row of rows) {
      let after: Prisma.BjtQuestionUpdateInput | null = null;
      let action = "";
      if (data.action === "publish") {
        if (row.status === "archived") continue;
        after = { status: "published" };
        action = "admin.assessment.question.published";
      } else if (data.action === "archive") {
        if (row.status === "archived") continue;
        after = { status: "archived" };
        action = "admin.assessment.question.archived";
      } else if (data.action === "tag" && data.tags) {
        const merged = Array.from(new Set([...row.tags, ...data.tags]));
        if (merged.length === row.tags.length) continue;
        after = { tags: merged };
        action = "admin.assessment.question.tagged";
      } else if (data.action === "untag" && data.tags) {
        const removeSet = new Set(data.tags);
        const filtered = row.tags.filter((t) => !removeSet.has(t));
        if (filtered.length === row.tags.length) continue;
        after = { tags: filtered };
        action = "admin.assessment.question.untagged";
      }
      if (!after) continue;
      const updated = await this.prisma.bjtQuestion.update({ data: after, where: { id: row.id } });
      await this.writeAudit({
        action,
        actorId,
        after: { tags: updated.tags, status: updated.status },
        before: { tags: row.tags, status: row.status },
        reason: data.reason,
        targetId: row.id
      });
      processed += 1;
    }
    return { processed, totalRequested: data.ids.length, action: data.action };
  }

  async suggestEdit(actorId: string, id: string, data: SuggestInput) {
    const exists = await this.prisma.bjtQuestion.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException("Question not found");
    await this.writeAudit({
      action: "admin.assessment.question.suggested_edit",
      actorId,
      after: { field: data.field, proposedValue: data.proposedValue, rationale: data.rationale },
      before: null,
      reason: data.reason,
      targetId: id
    });
    return { suggested: true, id, field: data.field };
  }

  async remove(actorId: string, id: string, reason: string) {
    const before = await this.prisma.bjtQuestion.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Question not found");
    if (before.status !== "draft") {
      throw new BadRequestException({ code: "only_draft_can_be_deleted", currentStatus: before.status });
    }
    const answers = await this.prisma.quizAnswer.count({ where: { questionId: id } });
    if (answers > 0) {
      throw new BadRequestException({ code: "question_has_answers", answers });
    }
    await this.prisma.bjtQuestion.delete({ where: { id } });
    await this.writeAudit({
      action: "admin.assessment.question.deleted",
      actorId,
      after: null,
      before: this.serializeForAudit(before),
      reason,
      targetId: id
    });
    return { deleted: true, id };
  }

  private serializeForAudit(row: {
    sectionId: string;
    prompt: string;
    scenario: string | null;
    explanationVi: string;
    skillTag: string;
    difficulty: string;
    tags: string[];
    status: string;
    options?: { optionKey: string; text: string; isCorrect: boolean }[];
  }) {
    return {
      sectionId: row.sectionId,
      prompt: row.prompt,
      scenario: row.scenario,
      explanationVi: row.explanationVi,
      skillTag: row.skillTag,
      difficulty: row.difficulty,
      tags: row.tags,
      status: row.status,
      options: row.options?.map((o) => ({
        optionKey: o.optionKey,
        text: o.text,
        isCorrect: o.isCorrect
      }))
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
        targetType: "assessment.question"
      }
    });
  }
}
