import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import type {
  adminBattleBotCreateSchema,
  adminBattleBotListQuerySchema,
  adminBattleBotPatchSchema
} from "@nihongo-bjt/shared";

type CreateInput = z.infer<typeof adminBattleBotCreateSchema>;
type PatchInput = z.infer<typeof adminBattleBotPatchSchema>;
type ListInput = z.infer<typeof adminBattleBotListQuerySchema>;

const SUMMARY_SELECT = {
  avatarFallback: true,
  botKey: true,
  id: true,
  name: true,
  difficulty: true,
  status: true,
  accuracyPct: true,
  minDelayMs: true,
  maxDelayMs: true,
  riveSrc: true,
  styleToken: true,
  vocabularyLevel: true,
  createdAt: true,
  updatedAt: true
} as const;

@Injectable()
export class BattleBotsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.BattleBotWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.difficulty) where.difficulty = input.difficulty;
    if (input.q) {
      where.OR = [
        { name: { contains: input.q, mode: "insensitive" } },
        { persona: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.battleBot.findMany({
        orderBy: { updatedAt: "desc" },
        select: SUMMARY_SELECT,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.battleBot.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async detail(id: string) {
    const row = await this.prisma.battleBot.findUnique({ where: { id } });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      where: { targetId: id, targetType: "learning.battle_bot" }
    });
    return { ...row, audit };
  }

  async create(actorId: string, data: CreateInput) {
    const created = await this.prisma.battleBot.create({
      data: {
        accuracyPct: data.accuracyPct,
        avatarFallback: data.avatarFallback,
        botKey: data.botKey,
        createdById: actorId,
        difficulty: data.difficulty,
        maxDelayMs: data.maxDelayMs,
        minDelayMs: data.minDelayMs,
        name: data.name,
        persona: data.persona ?? null,
        riveArtboard: data.riveArtboard,
        riveLicense: data.riveLicense ?? null,
        riveProvenance: data.riveProvenance as Prisma.InputJsonValue,
        riveSrc: data.riveSrc ?? null,
        riveStateMachine: data.riveStateMachine,
        status: "active",
        styleToken: data.styleToken,
        updatedById: actorId,
        vocabularyLevel: data.vocabularyLevel
      }
    });
    await this.writeAudit({
      action: "admin.battle.bot.created",
      actorId,
      after: this.serialize(created),
      before: null,
      reason: data.reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  async patch(actorId: string, id: string, data: PatchInput) {
    const before = await this.prisma.battleBot.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Battle bot not found");
    const update: Prisma.BattleBotUpdateInput = { updatedById: actorId };
    if (data.botKey !== undefined) update.botKey = data.botKey;
    if (data.name !== undefined) update.name = data.name;
    if (data.difficulty !== undefined) update.difficulty = data.difficulty;
    if (data.persona !== undefined) update.persona = data.persona;
    if (data.accuracyPct !== undefined) update.accuracyPct = data.accuracyPct;
    if (data.minDelayMs !== undefined) update.minDelayMs = data.minDelayMs;
    if (data.maxDelayMs !== undefined) update.maxDelayMs = data.maxDelayMs;
    if (data.vocabularyLevel !== undefined) update.vocabularyLevel = data.vocabularyLevel;
    if (data.avatarFallback !== undefined) update.avatarFallback = data.avatarFallback;
    if (data.styleToken !== undefined) update.styleToken = data.styleToken;
    if (data.riveSrc !== undefined) update.riveSrc = data.riveSrc;
    if (data.riveArtboard !== undefined) update.riveArtboard = data.riveArtboard;
    if (data.riveStateMachine !== undefined) update.riveStateMachine = data.riveStateMachine;
    if (data.riveLicense !== undefined) update.riveLicense = data.riveLicense;
    if (data.riveProvenance !== undefined) update.riveProvenance = data.riveProvenance as Prisma.InputJsonValue;
    const updated = await this.prisma.battleBot.update({ data: update, where: { id } });
    await this.writeAudit({
      action: "admin.battle.bot.updated",
      actorId,
      after: this.serialize(updated),
      before: this.serialize(before),
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async toggle(actorId: string, id: string, reason: string, target: "active" | "disabled") {
    const before = await this.prisma.battleBot.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Battle bot not found");
    if (before.status === "archived") {
      throw new BadRequestException({ code: "cannot_toggle_archived" });
    }
    if (before.status === target) {
      return this.detail(id);
    }
    const updated = await this.prisma.battleBot.update({
      data: { status: target, updatedById: actorId },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.battle.bot.toggled",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async archive(actorId: string, id: string, reason: string) {
    const before = await this.prisma.battleBot.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Battle bot not found");
    if (before.status === "archived") return this.detail(id);
    const updated = await this.prisma.battleBot.update({
      data: { status: "archived", updatedById: actorId },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.battle.bot.archived",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async remove(actorId: string, id: string, reason: string) {
    const before = await this.prisma.battleBot.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Battle bot not found");
    if (before.status !== "archived") {
      throw new BadRequestException({ code: "only_archived_can_be_deleted", currentStatus: before.status });
    }
    await this.prisma.battleBot.delete({ where: { id } });
    await this.writeAudit({
      action: "admin.battle.bot.deleted",
      actorId,
      after: null,
      before: this.serialize(before),
      reason,
      targetId: id
    });
    return { deleted: true, id };
  }

  private serialize(row: {
    accuracyPct: number;
    avatarFallback: string;
    botKey: string;
    difficulty: string;
    maxDelayMs: number;
    minDelayMs: number;
    name: string;
    persona: string | null;
    riveArtboard: string;
    riveLicense: string | null;
    riveProvenance: Prisma.JsonValue;
    riveSrc: string | null;
    riveStateMachine: string;
    status: string;
    styleToken: string;
    vocabularyLevel: string;
  }) {
    return {
      accuracyPct: row.accuracyPct,
      avatarFallback: row.avatarFallback,
      botKey: row.botKey,
      difficulty: row.difficulty,
      maxDelayMs: row.maxDelayMs,
      minDelayMs: row.minDelayMs,
      name: row.name,
      persona: row.persona,
      riveArtboard: row.riveArtboard,
      riveLicense: row.riveLicense,
      riveProvenance: row.riveProvenance,
      riveSrc: row.riveSrc,
      riveStateMachine: row.riveStateMachine,
      status: row.status,
      styleToken: row.styleToken,
      vocabularyLevel: row.vocabularyLevel
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
        targetType: "learning.battle_bot"
      }
    });
  }
}
