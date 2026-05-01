import { Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import {
  CONTENT_VERSION_STATUSES,
  type adminContentVersionListQuerySchema
} from "@nihongo-bjt/shared";

import { diffSnapshots } from "./utils/diff.js";

type ListInput = z.infer<typeof adminContentVersionListQuerySchema>;

@Injectable()
export class ContentVersionsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.ContentVersionWhereInput = {};
    if (input.entityType) where.entityType = input.entityType;
    if (input.entityId) where.entityId = input.entityId;
    if (input.authorUserId) where.authorUserId = input.authorUserId;
    if (input.status) where.status = input.status;
    if (input.q) {
      where.OR = [
        { entityType: { contains: input.q, mode: "insensitive" } },
        { changeSummary: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const createdAt: Prisma.DateTimeFilter = {};
    if (input.from) createdAt.gte = new Date(input.from);
    if (input.to) createdAt.lte = new Date(input.to);
    if (input.from || input.to) where.createdAt = createdAt;

    const [items, total, statusCounts] = await Promise.all([
      this.prisma.contentVersion.findMany({
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.contentVersion.count({ where }),
      this.prisma.contentVersion.groupBy({ _count: { _all: true }, by: ["status"] })
    ]);

    const counts: Record<string, number> = {};
    for (const s of CONTENT_VERSION_STATUSES) counts[s] = 0;
    for (const r of statusCounts) counts[r.status] = r._count._all;

    return {
      items: items.map((it) => this.summarize(it)),
      page: input.page,
      pageSize: input.pageSize,
      statusCounts: counts,
      total
    };
  }

  async detail(id: string) {
    const row = await this.prisma.contentVersion.findUnique({ where: { id } });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { displayName: true, email: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
      where: { targetId: id, targetType: "content.version" }
    });
    const author = row.authorUserId
      ? await this.prisma.adminActor.findUnique({
          select: { displayName: true, email: true, id: true },
          where: { id: row.authorUserId }
        })
      : null;
    const currentPublished = await this.prisma.contentVersion.findFirst({
      orderBy: { versionNumber: "desc" },
      where: { entityId: row.entityId, entityType: row.entityType, status: "published" }
    });
    return {
      ...this.summarize(row),
      audit,
      author,
      currentPublishedVersionId: currentPublished?.id ?? null,
      snapshot: row.snapshot
    };
  }

  async historyForEntity(entityType: string, entityId: string) {
    const items = await this.prisma.contentVersion.findMany({
      orderBy: { versionNumber: "desc" },
      where: { entityId, entityType }
    });
    return { entityId, entityType, items: items.map((it) => this.summarize(it)) };
  }

  async diff(fromId: string, toId: string) {
    const [from, to] = await Promise.all([
      this.prisma.contentVersion.findUnique({ where: { id: fromId } }),
      this.prisma.contentVersion.findUnique({ where: { id: toId } })
    ]);
    if (!from || !to) {
      throw new NotFoundException("Version not found for diff");
    }
    const computed = diffSnapshots(from.snapshot, to.snapshot);
    return {
      diff: { json: computed.json, text: computed.jsonText },
      from: this.summarize(from),
      to: this.summarize(to)
    };
  }

  async revert(actorId: string, id: string, reason: string) {
    const source = await this.prisma.contentVersion.findUnique({ where: { id } });
    if (!source) throw new NotFoundException("Version not found");

    const result = await this.prisma.$transaction(async (tx) => {
      const next = await tx.contentVersion.aggregate({
        _max: { versionNumber: true },
        where: { entityId: source.entityId, entityType: source.entityType }
      });
      const nextNumber = (next._max.versionNumber ?? 0) + 1;

      // Demote current published row (if any) to superseded.
      await tx.contentVersion.updateMany({
        data: { status: "superseded" },
        where: {
          entityId: source.entityId,
          entityType: source.entityType,
          status: "published"
        }
      });

      const created = await tx.contentVersion.create({
        data: {
          authorUserId: actorId,
          changeSummary: `Reverted from version ${source.versionNumber} (${source.id})`,
          entityId: source.entityId,
          entityType: source.entityType,
          publishedAt: new Date(),
          revertedFromVersionId: source.id,
          snapshot: source.snapshot as Prisma.InputJsonValue,
          status: "published",
          versionNumber: nextNumber
        }
      });
      return created;
    });

    await this.writeAudit({
      action: "admin.content.version.reverted",
      actorId,
      after: { id: result.id, status: result.status, versionNumber: result.versionNumber },
      before: { id: source.id, status: source.status, versionNumber: source.versionNumber },
      reason,
      targetId: result.id
    });
    return this.detail(result.id);
  }

  private summarize(row: {
    id: string;
    entityType: string;
    entityId: string;
    versionNumber: number;
    changeSummary: string | null;
    snapshot: unknown;
    authorUserId: string | null;
    status: string;
    publishedAt: Date | null;
    revertedFromVersionId: string | null;
    createdAt: Date;
  }) {
    return {
      authorUserId: row.authorUserId,
      changeSummary: row.changeSummary,
      createdAt: row.createdAt,
      entityId: row.entityId,
      entityType: row.entityType,
      id: row.id,
      publishedAt: row.publishedAt,
      revertedFromVersionId: row.revertedFromVersionId,
      status: row.status,
      title: extractTitle(row.snapshot, row.entityType),
      versionNumber: row.versionNumber
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
        targetType: "content.version"
      }
    });
  }
}

function extractTitle(snapshot: unknown, entityType: string): string {
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const obj = snapshot as Record<string, unknown>;
    for (const key of ["titleVi", "title", "name", "promptVi", "headlineVi", "lemma", "slug"]) {
      const v = obj[key];
      if (typeof v === "string" && v.length > 0) return v;
    }
  }
  return entityType;
}
