import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import type {
  adminBattleConfigCreateSchema,
  adminBattleConfigListQuerySchema,
  adminBattleConfigPatchSchema
} from "@nihongo-bjt/shared";

type CreateInput = z.infer<typeof adminBattleConfigCreateSchema>;
type PatchInput = z.infer<typeof adminBattleConfigPatchSchema>;
type ListInput = z.infer<typeof adminBattleConfigListQuerySchema>;

const SUMMARY_SELECT = {
  id: true,
  name: true,
  level: true,
  status: true,
  questionCount: true,
  timePerQuestionSec: true,
  maxParticipants: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true
} as const;

@Injectable()
export class BattleConfigsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.BattleConfigWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.level) where.level = input.level;
    if (input.q) {
      where.OR = [
        { name: { contains: input.q, mode: "insensitive" } },
        { description: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.battleConfig.findMany({
        orderBy: { updatedAt: "desc" },
        select: SUMMARY_SELECT,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.battleConfig.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async detail(id: string) {
    const row = await this.prisma.battleConfig.findUnique({ where: { id } });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      where: { targetId: id, targetType: "learning.battle_config" }
    });
    return { ...row, audit };
  }

  async create(actorId: string, data: CreateInput) {
    const created = await this.prisma.battleConfig.create({
      data: {
        botDifficulties: data.botDifficulties,
        createdById: actorId,
        description: data.description ?? null,
        level: data.level,
        maxParticipants: data.maxParticipants,
        name: data.name,
        questionCount: data.questionCount,
        questionPoolKey: data.questionPoolKey,
        scheduleEnd: data.scheduleEnd ?? null,
        scheduleStart: data.scheduleStart ?? null,
        scoringRules: (data.scoringRules ?? {}) as Prisma.InputJsonValue,
        status: "draft",
        timePerQuestionSec: data.timePerQuestionSec,
        updatedById: actorId
      }
    });
    await this.writeAudit({
      action: "admin.battle.config.created",
      actorId,
      after: this.serializeForAudit(created),
      before: null,
      reason: data.reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  async patch(actorId: string, id: string, data: PatchInput) {
    const before = await this.prisma.battleConfig.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Battle config not found");

    const update: Prisma.BattleConfigUpdateInput = { updatedById: actorId };
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (data.level !== undefined) update.level = data.level;
    if (data.questionPoolKey !== undefined) update.questionPoolKey = data.questionPoolKey;
    if (data.questionCount !== undefined) update.questionCount = data.questionCount;
    if (data.timePerQuestionSec !== undefined) update.timePerQuestionSec = data.timePerQuestionSec;
    if (data.maxParticipants !== undefined) update.maxParticipants = data.maxParticipants;
    if (data.botDifficulties !== undefined) update.botDifficulties = data.botDifficulties;
    if (data.scoringRules !== undefined) update.scoringRules = data.scoringRules as Prisma.InputJsonValue;
    if (data.scheduleStart !== undefined) update.scheduleStart = data.scheduleStart;
    if (data.scheduleEnd !== undefined) update.scheduleEnd = data.scheduleEnd;

    const updated = await this.prisma.battleConfig.update({ data: update, where: { id } });
    await this.writeAudit({
      action: "admin.battle.config.updated",
      actorId,
      after: this.serializeForAudit(updated),
      before: this.serializeForAudit(before),
      reason: data.reason,
      targetId: id
    });
    return this.detail(id);
  }

  async publish(actorId: string, id: string, reason: string) {
    const before = await this.prisma.battleConfig.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Battle config not found");
    if (before.status === "archived") {
      throw new BadRequestException({ code: "cannot_publish_archived" });
    }
    if (before.status === "published") {
      // Idempotent: still record the audit so timeline reflects intent, but don't bump publishedAt.
      await this.writeAudit({
        action: "admin.battle.config.published",
        actorId,
        after: { status: "published", noop: true },
        before: { status: before.status },
        reason,
        targetId: id
      });
      return this.detail(id);
    }
    const updated = await this.prisma.battleConfig.update({
      data: { publishedAt: new Date(), status: "published", updatedById: actorId },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.battle.config.published",
      actorId,
      after: { publishedAt: updated.publishedAt, status: updated.status },
      before: { publishedAt: before.publishedAt, status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async archive(actorId: string, id: string, reason: string) {
    const before = await this.prisma.battleConfig.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Battle config not found");
    if (before.status === "archived") {
      return this.detail(id);
    }
    const updated = await this.prisma.battleConfig.update({
      data: { archivedAt: new Date(), status: "archived", updatedById: actorId },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.battle.config.archived",
      actorId,
      after: { archivedAt: updated.archivedAt, status: updated.status },
      before: { archivedAt: before.archivedAt, status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async duplicate(actorId: string, id: string, reason: string) {
    const src = await this.prisma.battleConfig.findUnique({ where: { id } });
    if (!src) throw new NotFoundException("Battle config not found");
    const created = await this.prisma.battleConfig.create({
      data: {
        botDifficulties: src.botDifficulties,
        createdById: actorId,
        description: src.description,
        level: src.level,
        maxParticipants: src.maxParticipants,
        name: this.suffixCopy(src.name),
        questionCount: src.questionCount,
        questionPoolKey: src.questionPoolKey,
        scoringRules: src.scoringRules as Prisma.InputJsonValue,
        status: "draft",
        timePerQuestionSec: src.timePerQuestionSec,
        updatedById: actorId
      }
    });
    await this.writeAudit({
      action: "admin.battle.config.duplicated",
      actorId,
      after: { newId: created.id, name: created.name, sourceId: id },
      before: null,
      reason,
      targetId: created.id
    });
    return this.detail(created.id);
  }

  async remove(actorId: string, id: string, reason: string) {
    const before = await this.prisma.battleConfig.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Battle config not found");
    if (before.status !== "draft") {
      throw new BadRequestException({ code: "only_draft_can_be_deleted", currentStatus: before.status });
    }
    await this.prisma.battleConfig.delete({ where: { id } });
    await this.writeAudit({
      action: "admin.battle.config.deleted",
      actorId,
      after: null,
      before: this.serializeForAudit(before),
      reason,
      targetId: id
    });
    return { deleted: true, id };
  }

  private suffixCopy(name: string): string {
    const base = ` (copy)`;
    if (name.length + base.length <= 120) return `${name}${base}`;
    return `${name.slice(0, 120 - base.length)}${base}`;
  }

  private serializeForAudit(row: {
    botDifficulties: string[];
    description: string | null;
    level: string;
    maxParticipants: number;
    name: string;
    questionCount: number;
    questionPoolKey: string;
    scheduleEnd: Date | null;
    scheduleStart: Date | null;
    scoringRules: unknown;
    status: string;
    timePerQuestionSec: number;
  }) {
    return {
      botDifficulties: row.botDifficulties,
      description: row.description,
      level: row.level,
      maxParticipants: row.maxParticipants,
      name: row.name,
      questionCount: row.questionCount,
      questionPoolKey: row.questionPoolKey,
      scheduleEnd: row.scheduleEnd,
      scheduleStart: row.scheduleStart,
      scoringRules: row.scoringRules,
      status: row.status,
      timePerQuestionSec: row.timePerQuestionSec
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
        targetType: "learning.battle_config"
      }
    });
  }
}
