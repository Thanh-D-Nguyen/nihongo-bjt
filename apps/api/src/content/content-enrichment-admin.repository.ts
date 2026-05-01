import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import {
  CONTENT_ENRICHMENT_STATUSES,
  type adminContentEnrichmentListQuerySchema
} from "@nihongo-bjt/shared";

type ListInput = z.infer<typeof adminContentEnrichmentListQuerySchema>;

const TERMINAL_STATUSES = new Set<string>(["succeeded", "failed", "cancelled"]);
const ACTIVE_STATUSES = new Set<string>(["queued", "running"]);

type RetryHistoryEntry = {
  attempt: number;
  at: string;
  by: string;
  reason: string;
  fromStatus: string;
};

@Injectable()
export class ContentEnrichmentAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const where: Prisma.ContentEnrichmentWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.type) where.enrichmentType = input.type;
    if (input.entityType) where.entityType = input.entityType;
    if (input.entityId) where.entityId = input.entityId;
    if (input.provider) where.provider = input.provider;
    if (input.q) {
      where.OR = [
        { entityType: { contains: input.q, mode: "insensitive" } },
        { enrichmentType: { contains: input.q, mode: "insensitive" } },
        { provider: { contains: input.q, mode: "insensitive" } },
        { errorMessage: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const createdAt: Prisma.DateTimeFilter = {};
    if (input.from) createdAt.gte = new Date(input.from);
    if (input.to) createdAt.lte = new Date(input.to);
    if (input.from || input.to) where.createdAt = createdAt;

    const [items, total, statusCounts] = await Promise.all([
      this.prisma.contentEnrichment.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.contentEnrichment.count({ where }),
      this.prisma.contentEnrichment.groupBy({
        _count: { _all: true },
        by: ["status"]
      })
    ]);

    const counts: Record<string, number> = {};
    for (const s of CONTENT_ENRICHMENT_STATUSES) counts[s] = 0;
    for (const row of statusCounts) {
      counts[row.status] = row._count._all;
    }

    return {
      items: items.map((it) => this.summarize(it)),
      page: input.page,
      pageSize: input.pageSize,
      statusCounts: counts,
      total
    };
  }

  async detail(id: string) {
    const row = await this.prisma.contentEnrichment.findUnique({ where: { id } });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { displayName: true, email: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
      where: { targetId: id, targetType: "content.enrichment" }
    });
    return { ...this.summarize(row), audit, raw: row };
  }

  async retry(actorId: string, id: string, reason: string) {
    const before = await this.prisma.contentEnrichment.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Enrichment job not found");
    if (!TERMINAL_STATUSES.has(before.status)) {
      throw new BadRequestException({
        code: "enrichment_not_retryable",
        message: `Job status '${before.status}' is not retryable.`
      });
    }
    const history = readHistory(before.retryHistory);
    history.push({
      at: new Date().toISOString(),
      attempt: before.attempts + 1,
      by: actorId,
      fromStatus: before.status,
      reason
    });
    const updated = await this.prisma.contentEnrichment.update({
      data: {
        attempts: before.attempts + 1,
        cancelReason: null,
        errorMessage: null,
        lastAttemptedAt: new Date(),
        retryHistory: history as unknown as Prisma.InputJsonValue,
        status: "queued"
      },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.content.enrichment.retried",
      actorId,
      after: { attempts: updated.attempts, status: updated.status },
      before: { attempts: before.attempts, status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async cancel(actorId: string, id: string, reason: string) {
    const before = await this.prisma.contentEnrichment.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Enrichment job not found");
    if (!ACTIVE_STATUSES.has(before.status)) {
      throw new BadRequestException({
        code: "enrichment_not_cancellable",
        message: `Job status '${before.status}' cannot be cancelled.`
      });
    }
    const updated = await this.prisma.contentEnrichment.update({
      data: { cancelReason: reason, processedAt: new Date(), status: "cancelled" },
      where: { id }
    });
    await this.writeAudit({
      action: "admin.content.enrichment.cancelled",
      actorId,
      after: { status: updated.status },
      before: { status: before.status },
      reason,
      targetId: id
    });
    return this.detail(id);
  }

  async bulkRetry(actorId: string, jobIds: string[], reason: string) {
    const rows = await this.prisma.contentEnrichment.findMany({
      where: { id: { in: jobIds } }
    });
    const found = new Map(rows.map((r) => [r.id, r] as const));
    const result: Array<{ id: string; ok: boolean; code?: string }> = [];
    const now = new Date();
    for (const id of jobIds) {
      const before = found.get(id);
      if (!before) {
        result.push({ code: "not_found", id, ok: false });
        continue;
      }
      if (!TERMINAL_STATUSES.has(before.status)) {
        result.push({ code: "not_retryable", id, ok: false });
        continue;
      }
      const history = readHistory(before.retryHistory);
      history.push({
        at: now.toISOString(),
        attempt: before.attempts + 1,
        by: actorId,
        fromStatus: before.status,
        reason
      });
      await this.prisma.contentEnrichment.update({
        data: {
          attempts: before.attempts + 1,
          cancelReason: null,
          errorMessage: null,
          lastAttemptedAt: now,
          retryHistory: history as unknown as Prisma.InputJsonValue,
          status: "queued"
        },
        where: { id }
      });
      await this.writeAudit({
        action: "admin.content.enrichment.bulk_retried",
        actorId,
        after: { attempts: before.attempts + 1, status: "queued" },
        before: { attempts: before.attempts, status: before.status },
        reason,
        targetId: id
      });
      result.push({ id, ok: true });
    }
    return { results: result, retried: result.filter((r) => r.ok).length, total: jobIds.length };
  }

  private summarize(row: {
    id: string;
    entityType: string;
    entityId: string;
    enrichmentType: string;
    priority: number;
    status: string;
    result: unknown;
    errorMessage: string | null;
    inputSnapshot: unknown;
    provider: string | null;
    providerLicense: string | null;
    providerSource: string | null;
    attempts: number;
    lastAttemptedAt: Date | null;
    cancelReason: string | null;
    retryHistory: unknown;
    processedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      attempts: row.attempts,
      cancelReason: row.cancelReason,
      createdAt: row.createdAt,
      enrichmentType: row.enrichmentType,
      entityId: row.entityId,
      entityType: row.entityType,
      errorMessage: row.errorMessage,
      id: row.id,
      inputSnapshot: row.inputSnapshot,
      lastAttemptedAt: row.lastAttemptedAt,
      priority: row.priority,
      processedAt: row.processedAt,
      provenance: {
        license: row.providerLicense,
        provider: row.provider,
        source: row.providerSource
      },
      result: row.result,
      retryHistory: readHistory(row.retryHistory),
      status: row.status,
      updatedAt: row.updatedAt
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
        targetType: "content.enrichment"
      }
    });
  }
}

function readHistory(value: unknown): RetryHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is RetryHistoryEntry => {
    return (
      typeof v === "object" &&
      v !== null &&
      typeof (v as RetryHistoryEntry).attempt === "number" &&
      typeof (v as RetryHistoryEntry).at === "string"
    );
  });
}
