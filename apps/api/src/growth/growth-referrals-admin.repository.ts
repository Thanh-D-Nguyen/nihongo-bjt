import { Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import type { adminGrowthReferralListQuerySchema } from "@nihongo-bjt/shared";

type ListInput = z.infer<typeof adminGrowthReferralListQuerySchema>;

const ABUSE_WINDOW_MS = 60 * 60 * 1000;
const ABUSE_THRESHOLD_EVENTS = 10;

@Injectable()
export class GrowthReferralsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.ReferralCodeWhereInput = {};
    if (input.q) where.code = { contains: input.q, mode: "insensitive" };

    const [items, total] = await Promise.all([
      this.prisma.referralCode.findMany({
        include: { user: { select: { displayName: true, email: true, id: true } } },
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.referralCode.count({ where })
    ]);

    const since = new Date(Date.now() - ABUSE_WINDOW_MS);
    const codes = items.map((it) => it.code);
    const counts = codes.length
      ? await this.prisma.referralEvent.groupBy({
          _count: { _all: true },
          by: ["code"],
          where: { code: { in: codes }, createdAt: { gte: since } }
        })
      : [];
    const countMap = new Map<string, number>();
    for (const c of counts) {
      countMap.set(c.code, c._count._all);
    }
    const enriched = items.map((it) => {
      const recent = countMap.get(it.code) ?? 0;
      const flagged = recent >= ABUSE_THRESHOLD_EVENTS;
      return { ...it, abuseFlag: flagged, eventsLastHour: recent };
    });
    const filtered = input.flagged === true ? enriched.filter((e) => e.abuseFlag) : enriched;
    return { items: filtered, page: input.page, pageSize: input.pageSize, total: input.flagged ? filtered.length : total };
  }

  async detail(id: string) {
    const row = await this.prisma.referralCode.findUnique({
      include: { user: { select: { displayName: true, email: true, id: true } } },
      where: { id }
    });
    if (!row) return null;
    const events = await this.prisma.referralEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      where: { code: row.code }
    });
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { displayName: true, email: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      where: { targetId: id, targetType: "growth.referral_code" }
    });
    const since = new Date(Date.now() - ABUSE_WINDOW_MS);
    const eventsLastHour = events.filter((e) => e.createdAt >= since).length;
    return {
      ...row,
      abuseFlag: eventsLastHour >= ABUSE_THRESHOLD_EVENTS,
      audit,
      events,
      eventsLastHour
    };
  }

  async revoke(actorId: string, id: string, reason: string) {
    const before = await this.prisma.referralCode.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Referral code not found");
    await this.prisma.referralCode.delete({ where: { id } });
    await this.writeAudit({
      action: "admin.growth.referral_code.revoked",
      actorId,
      after: null,
      before: { code: before.code, userId: before.userId },
      reason,
      targetId: id
    });
    return { id, revoked: true };
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
        targetType: "growth.referral_code"
      }
    });
  }
}
