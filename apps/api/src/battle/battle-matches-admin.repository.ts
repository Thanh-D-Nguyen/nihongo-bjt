import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import type {
  adminBattleMatchListQuerySchema,
  adminBattleMatchActionBodySchema
} from "@nihongo-bjt/shared";

type ListInput = z.infer<typeof adminBattleMatchListQuerySchema>;
type ActionInput = z.infer<typeof adminBattleMatchActionBodySchema>;

const SUMMARY_SELECT = {
  id: true,
  userId: true,
  roomCode: true,
  mode: true,
  botKey: true,
  status: true,
  userScore: true,
  opponentScore: true,
  maxRounds: true,
  currentRoundIndex: true,
  startedAt: true,
  completedAt: true,
  abandonedReason: true,
  _count: { select: { rounds: true } }
} satisfies Prisma.BattleSessionSelect;

@Injectable()
export class BattleMatchesAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.BattleSessionWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.userId) where.userId = input.userId;
    if (input.mode) where.mode = input.mode;
    if (input.from || input.to) {
      where.startedAt = {};
      if (input.from) (where.startedAt as Record<string, Date>).gte = input.from;
      if (input.to) (where.startedAt as Record<string, Date>).lte = input.to;
    }
    if (input.q) {
      where.OR = [
        { id: { equals: input.q } },
        { roomCode: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.battleSession.findMany({
        orderBy: { startedAt: "desc" },
        select: SUMMARY_SELECT,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.battleSession.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async detail(id: string) {
    const row = await this.prisma.battleSession.findUnique({
      include: {
        rounds: {
          orderBy: { roundIndex: "asc" }
        }
      },
      where: { id }
    });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      where: { targetId: id, targetType: "learning.battle_session" }
    });
    return { ...row, audit };
  }

  async abort(actorId: string, id: string, input: ActionInput) {
    const before = await this.prisma.battleSession.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Battle match not found");
    if (before.status !== "in_progress") {
      throw new BadRequestException({ code: "only_in_progress_can_be_aborted", currentStatus: before.status });
    }
    const updated = await this.prisma.battleSession.update({
      data: {
        abandonedReason: "admin_abort",
        completedAt: new Date(),
        status: "abandoned"
      },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.battle.match.aborted",
      actorId,
      after: { abandonedReason: updated.abandonedReason, completedAt: updated.completedAt, status: updated.status },
      before: { abandonedReason: before.abandonedReason, status: before.status },
      reason: input.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async rerun(actorId: string, id: string, input: ActionInput) {
    const src = await this.prisma.battleSession.findUnique({ where: { id } });
    if (!src) throw new NotFoundException("Battle match not found");
    if (src.status === "in_progress") {
      throw new BadRequestException({ code: "cannot_rerun_in_progress" });
    }
    const fairnessSeed = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
    const created = await this.prisma.battleSession.create({
      data: {
        botKey: src.botKey,
        fairnessSeed,
        maxRounds: src.maxRounds,
        mode: src.mode,
        roomCode: `${src.roomCode.slice(0, 10)}-r${Math.random().toString(16).slice(2, 6)}`,
        status: "in_progress",
        userId: src.userId
      }
    });
    await this.writeAudit({
      action: "admin.battle.match.rerun",
      actorId,
      after: { newId: created.id, roomCode: created.roomCode, sourceId: id },
      before: null,
      reason: input.reason,
      targetId: id
    });
    return this.detail(created.id);
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
        targetType: "learning.battle_session"
      }
    });
  }
}
