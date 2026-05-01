import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import type {
  adminBattleAbuseEscalateSchema,
  adminBattleAbuseListQuerySchema,
  adminBattleAbuseResolveSchema
} from "@nihongo-bjt/shared";

type ListInput = z.infer<typeof adminBattleAbuseListQuerySchema>;
type ResolveInput = z.infer<typeof adminBattleAbuseResolveSchema>;
type EscalateInput = z.infer<typeof adminBattleAbuseEscalateSchema>;

const SUMMARY_SELECT = {
  id: true,
  reporterId: true,
  subjectId: true,
  matchId: true,
  severity: true,
  kind: true,
  status: true,
  actionTaken: true,
  resolvedAt: true,
  escalatedAt: true,
  createdAt: true,
  updatedAt: true
} as const;

@Injectable()
export class BattleAbuseAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.BattleAbuseReportWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.severity) where.severity = input.severity;
    if (input.kind) where.kind = input.kind;
    if (input.reporterId) where.reporterId = input.reporterId;
    if (input.subjectId) where.subjectId = input.subjectId;
    if (input.from || input.to) {
      where.createdAt = {};
      if (input.from) (where.createdAt as Record<string, Date>).gte = input.from;
      if (input.to) (where.createdAt as Record<string, Date>).lte = input.to;
    }
    const [items, total] = await Promise.all([
      this.prisma.battleAbuseReport.findMany({
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        select: SUMMARY_SELECT,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.battleAbuseReport.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async detail(id: string) {
    const row = await this.prisma.battleAbuseReport.findUnique({ where: { id } });
    if (!row) return null;
    const [priorAgainstSubject, audit] = await Promise.all([
      this.prisma.battleAbuseReport.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          severity: true,
          kind: true,
          actionTaken: true,
          createdAt: true
        },
        take: 25,
        where: { id: { not: id }, subjectId: row.subjectId }
      }),
      this.prisma.adminAuditLog.findMany({
        include: { actor: { select: { id: true, displayName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
        where: { targetId: id, targetType: "learning.battle_abuse_report" }
      })
    ]);
    return { ...row, audit, priorAgainstSubject };
  }

  async resolve(actorId: string, id: string, data: ResolveInput) {
    const before = await this.prisma.battleAbuseReport.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Battle abuse report not found");
    if (before.status === "resolved" || before.status === "dismissed") {
      throw new BadRequestException({ code: "already_resolved", currentStatus: before.status });
    }
    const newStatus = data.action === "dismissed" ? "dismissed" : "resolved";
    const updated = await this.prisma.battleAbuseReport.update({
      data: {
        actionTaken: data.action,
        resolutionNotes: data.notes,
        resolvedAt: new Date(),
        resolvedById: actorId,
        status: newStatus
      },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.battle.abuse.resolved",
      actorId,
      after: { actionTaken: updated.actionTaken, status: updated.status },
      before: { actionTaken: before.actionTaken, status: before.status },
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async escalate(actorId: string, id: string, data: EscalateInput) {
    const before = await this.prisma.battleAbuseReport.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Battle abuse report not found");
    if (before.status === "resolved" || before.status === "dismissed" || before.status === "escalated") {
      throw new BadRequestException({ code: "cannot_escalate", currentStatus: before.status });
    }
    const updated = await this.prisma.battleAbuseReport.update({
      data: { escalatedAt: new Date(), status: "escalated" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.battle.abuse.escalated",
      actorId,
      after: { escalatedAt: updated.escalatedAt, status: updated.status },
      before: { status: before.status },
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
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
        targetType: "learning.battle_abuse_report"
      }
    });
  }
}
