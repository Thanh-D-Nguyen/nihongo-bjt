import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { adminQuizSessionListQuerySchema } from "@nihongo-bjt/shared";
import type { z } from "zod";

type ListInput = z.infer<typeof adminQuizSessionListQuerySchema>;

const SUMMARY_SELECT = {
  id: true,
  userId: true,
  testId: true,
  status: true,
  currentQuestionNo: true,
  totalQuestions: true,
  correctCount: true,
  estimatedScore: true,
  estimatedBjtBand: true,
  startedAt: true,
  completedAt: true,
  test: { select: { id: true, slug: true, titleVi: true, type: true, level: true, timeLimitSeconds: true } }
} satisfies Prisma.QuizSessionSelect;

@Injectable()
export class QuizSessionsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.QuizSessionWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.userId) where.userId = input.userId;
    if (input.testId) where.testId = input.testId;
    if (input.from || input.to) {
      where.startedAt = {};
      if (input.from) (where.startedAt as Record<string, Date>).gte = new Date(input.from);
      if (input.to) (where.startedAt as Record<string, Date>).lte = new Date(input.to);
    }
    if (input.q && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.q)) {
      where.id = input.q;
    }

    const [items, total] = await Promise.all([
      this.prisma.quizSession.findMany({
        orderBy: { startedAt: "desc" },
        select: SUMMARY_SELECT,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.quizSession.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async detail(id: string) {
    const row = await this.prisma.quizSession.findUnique({
      include: {
        test: {
          select: {
            id: true,
            slug: true,
            titleVi: true,
            type: true,
            level: true,
            timeLimitSeconds: true,
            sections: {
              orderBy: { displayOrder: "asc" },
              select: {
                id: true,
                code: true,
                titleVi: true,
                _count: { select: { questions: true } }
              }
            }
          }
        },
        answers: {
          orderBy: { answeredAt: "asc" },
          include: {
            question: {
              select: {
                id: true,
                prompt: true,
                skillTag: true,
                difficulty: true,
                sectionId: true,
                options: { select: { optionKey: true, isCorrect: true, text: true } }
              }
            }
          }
        }
      },
      where: { id }
    });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
      where: { targetId: id, targetType: "assessment.quiz_session" }
    });
    const breakdown = this.computeBreakdown(row.answers);
    const expiresAt = this.computeExpiresAt(row.startedAt, row.test.timeLimitSeconds);
    return { ...row, breakdown, expiresAt, audit };
  }

  async abort(actorId: string, id: string, reason: string) {
    const before = await this.prisma.quizSession.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Quiz session not found");
    if (before.status !== "in_progress") {
      // idempotent: record audit but no state change
      await this.writeAudit({
        action: "admin.assessment.quiz_session.abort_noop",
        actorId,
        after: { status: before.status, noop: true },
        before: { status: before.status },
        reason,
        targetId: id
      });
      return this.detail(id);
    }
    const updated = await this.prisma.quizSession.update({
      data: { status: "abandoned", completedAt: new Date() },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.assessment.quiz_session.aborted",
      actorId,
      after: { status: updated.status, completedAt: updated.completedAt },
      before: { status: before.status, completedAt: before.completedAt },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async extendTime(actorId: string, id: string, addSeconds: number, reason: string) {
    const before = await this.prisma.quizSession.findUnique({
      include: { test: { select: { timeLimitSeconds: true } } },
      where: { id }
    });
    if (!before) throw new NotFoundException("Quiz session not found");
    if (before.status !== "in_progress") {
      throw new BadRequestException({ code: "session_not_in_progress", currentStatus: before.status });
    }
    const adjustedStartedAt = new Date(before.startedAt.getTime() - addSeconds * 1000);
    const updated = await this.prisma.quizSession.update({
      data: { startedAt: adjustedStartedAt },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.assessment.quiz_session.time_extended",
      actorId,
      after: { startedAt: updated.startedAt, addSeconds },
      before: { startedAt: before.startedAt },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  private computeBreakdown(
    answers: { isCorrect: boolean; question: { skillTag: string; difficulty: string; sectionId: string } }[]
  ) {
    const bySkill = new Map<string, { total: number; correct: number }>();
    const byDifficulty = new Map<string, { total: number; correct: number }>();
    const bySection = new Map<string, { total: number; correct: number }>();
    for (const a of answers) {
      const skill = a.question.skillTag;
      const diff = a.question.difficulty;
      const section = a.question.sectionId;
      for (const [map, key] of [[bySkill, skill], [byDifficulty, diff], [bySection, section]] as const) {
        const cur = map.get(key) ?? { total: 0, correct: 0 };
        cur.total += 1;
        if (a.isCorrect) cur.correct += 1;
        map.set(key, cur);
      }
    }
    const toArray = (m: Map<string, { total: number; correct: number }>, label: string) =>
      Array.from(m.entries()).map(([k, v]) => ({ [label]: k, total: v.total, correct: v.correct }));
    return {
      bySkill: toArray(bySkill, "skill"),
      byDifficulty: toArray(byDifficulty, "difficulty"),
      bySection: toArray(bySection, "sectionId")
    };
  }

  private computeExpiresAt(startedAt: Date, timeLimitSeconds: number | null): string | null {
    if (!timeLimitSeconds || timeLimitSeconds <= 0) return null;
    return new Date(startedAt.getTime() + timeLimitSeconds * 1000).toISOString();
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
        targetType: "assessment.quiz_session"
      }
    });
  }
}
