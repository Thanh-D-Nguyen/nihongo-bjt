import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";

import { SearchService } from "../search/search.service.js";

@Injectable()
export class OperationsService {
  private readonly prisma = createPrismaClient();

  constructor(@Optional() @Inject(SearchService) private readonly searchService?: SearchService) {}

  listFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
  }

  async systemHealthSummary() {
    let dbHealthy = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbHealthy = false;
    }

    const [featureFlagsTotal, killSwitchesEnabled, deadLettersOpen, importErrors24h] = await Promise.all([
      this.prisma.featureFlag.count(),
      this.prisma.featureFlag.count({ where: { enabled: true, killSwitch: true } }),
      this.prisma.deadLetterEntry.count({ where: { status: { in: ["open", "failed"] } } }),
      this.prisma.contentImportError.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    const checks = [
      { name: "database", status: dbHealthy ? "healthy" : "down" },
      { name: "feature_flags", status: featureFlagsTotal > 0 ? "healthy" : "degraded" },
      { name: "dead_letters", status: deadLettersOpen === 0 ? "healthy" : "degraded" },
      { name: "import_pipeline", status: importErrors24h <= 20 ? "healthy" : "degraded" }
    ];

    const status = checks.some((check) => check.status !== "healthy") ? "degraded" : "healthy";
    return {
      checks,
      dbStatus: dbHealthy ? "healthy" : "down",
      deadLettersOpen,
      featureFlagsTotal,
      generatedAt: new Date().toISOString(),
      importErrors24h,
      killSwitchesEnabled,
      status
    };
  }

  async queueHealthSummary() {
    const [deadLetterGroups, importErrorsOpen] = await Promise.all([
      this.prisma.deadLetterEntry.groupBy({
        _count: { _all: true },
        by: ["status"]
      }),
      this.prisma.contentImportError.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          severity: { in: ["critical", "high"] }
        }
      })
    ]);

    const grouped = Object.fromEntries(deadLetterGroups.map((item) => [item.status, item._count._all]));
    const open = Number(grouped.open ?? 0);
    const failed = Number(grouped.failed ?? 0);
    const resolved = Number(grouped.resolved ?? 0);
    const discarded = Number(grouped.discarded ?? 0);
    const stalledJobs = open + failed;

    return {
      discardedDeadLetters: discarded,
      failedDeadLetters: failed,
      generatedAt: new Date().toISOString(),
      importErrorsOpen,
      openDeadLetters: open,
      resolvedDeadLetters: resolved,
      stalledJobs,
      status: stalledJobs > 0 ? "degraded" : "healthy"
    };
  }

  async searchSyncSummary() {
    const [latestRebuild, lexemeCount, kanjiCount, grammarCount, exampleCount] = await Promise.all([
      this.prisma.adminAuditLog.findFirst({
        orderBy: { createdAt: "desc" },
        where: { action: "ops.search.rebuild" }
      }),
      this.prisma.lexeme.count({ where: { status: "active" } }),
      this.prisma.kanji.count({ where: { status: "active" } }),
      this.prisma.grammarPoint.count({ where: { status: "active" } }),
      this.prisma.exampleSentence.count({ where: { status: "active" } })
    ]);

    const contentProjectionTotal = lexemeCount + kanjiCount + grammarCount + exampleCount;
    const hoursSinceLastRebuild = latestRebuild
      ? (Date.now() - latestRebuild.createdAt.getTime()) / (60 * 60 * 1000)
      : Number.POSITIVE_INFINITY;

    const indexedDocuments =
      latestRebuild?.after && typeof latestRebuild.after === "object" && "indexed" in latestRebuild.after
        ? Number((latestRebuild.after as Record<string, unknown>).indexed ?? 0)
        : null;

    return {
      contentProjectionTotal,
      generatedAt: new Date().toISOString(),
      indexedDocuments,
      lastRebuildAt: latestRebuild?.createdAt.toISOString() ?? null,
      lastRebuildBy: latestRebuild?.actorId ?? null,
      status: Number.isFinite(hoursSinceLastRebuild) && hoursSinceLastRebuild <= 24 ? "healthy" : "degraded"
    };
  }

  releaseSummary() {
    const releaseVersion =
      process.env.APP_VERSION ?? process.env.npm_package_version ?? process.env.VERCEL_GIT_COMMIT_TAG ?? "unknown";
    const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "unknown";

    return {
      commitSha,
      environment: process.env.NODE_ENV ?? "development",
      generatedAt: new Date().toISOString(),
      nodeVersion: process.version,
      startedAt: new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString(),
      status: "healthy",
      uptimeSeconds: Math.round(process.uptime()),
      version: releaseVersion
    };
  }

  async notificationsSummary() {
    const [openDeadLetters, failedDeadLetters, importErrorsHighSeverity] = await Promise.all([
      this.prisma.deadLetterEntry.count({ where: { status: "open" } }),
      this.prisma.deadLetterEntry.count({ where: { status: "failed" } }),
      this.prisma.contentImportError.count({ where: { severity: { in: ["critical", "high"] } } })
    ]);

    const degraded = openDeadLetters > 0 || failedDeadLetters > 0 || importErrorsHighSeverity > 0;
    return {
      failedDeadLetters,
      generatedAt: new Date().toISOString(),
      importErrorsHighSeverity,
      openDeadLetters,
      status: degraded ? "degraded" : "healthy"
    };
  }

  async securitySummary() {
    const [inactiveAdminActors, roleCount, permissionCount, recentAuditEvents7d, criticalOpsActions7d] = await Promise.all([
      this.prisma.adminActor.count({ where: { status: { not: "active" } } }),
      this.prisma.adminRole.count(),
      this.prisma.adminPermission.count(),
      this.prisma.adminAuditLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      }),
      this.prisma.adminAuditLog.count({
        where: {
          action: {
            in: [
              "ops.feature_flag.update",
              "ops.dead_letter.discarded",
              "ops.dead_letter.resolved",
              "ops.search.rebuild"
            ]
          },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    return {
      criticalOpsActions7d,
      generatedAt: new Date().toISOString(),
      inactiveAdminActors,
      permissions: permissionCount,
      recentAuditEvents7d,
      roles: roleCount,
      status: inactiveAdminActors > 0 ? "degraded" : "healthy"
    };
  }

  async updateFeatureFlag(input: {
    actorId: string;
    enabled?: boolean;
    key: string;
    killSwitch?: boolean;
    reason: string;
    rules?: Prisma.InputJsonValue;
  }) {
    const existing = await this.prisma.featureFlag.findUniqueOrThrow({ where: { key: input.key } });
    const updated = await this.prisma.$transaction(async (tx) => {
      const flag = await tx.featureFlag.update({
        data: {
          enabled: input.enabled,
          killSwitch: input.killSwitch,
          rules: input.rules
        },
        where: { key: input.key }
      });
      await tx.featureFlagAudit.create({
        data: {
          action: "feature_flag.update",
          actorId: input.actorId,
          after: flag as unknown as Prisma.InputJsonValue,
          before: existing as unknown as Prisma.InputJsonValue,
          flagKey: input.key,
          reason: input.reason
        }
      });
      await tx.adminAuditLog.create({
        data: {
          action: "ops.feature_flag.update",
          actorId: input.actorId,
          after: flag as unknown as Prisma.InputJsonValue,
          before: existing as unknown as Prisma.InputJsonValue,
          reason: input.reason,
          targetId: input.key,
          targetType: "ops.feature_flag"
        }
      });
      return flag;
    });
    return updated;
  }

  listDeadLetters(status?: string) {
    return this.prisma.deadLetterEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      where: status ? { status } : undefined
    });
  }

  async listImportBatches(params: { limit: number; offset: number; status?: string }) {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    const [items, total] = await Promise.all([
      this.prisma.contentImportBatch.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sourceType: true,
          sourceDir: true,
          status: true,
          fileCount: true,
          itemCount: true,
          errorCount: true,
          startedAt: true,
          completedAt: true,
          createdAt: true
        },
        skip: params.offset,
        take: params.limit,
        where
      }),
      this.prisma.contentImportBatch.count({ where })
    ]);
    return { items, total };
  }

  async listImportManifests(params: { limit: number; offset: number; status?: string }) {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    const [items, total] = await Promise.all([
      this.prisma.contentImportMapping.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sourceType: true,
          targetType: true,
          version: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true
        },
        skip: params.offset,
        take: params.limit,
        where
      }),
      this.prisma.contentImportMapping.count({ where })
    ]);
    return { items, total };
  }

  listImportStagingErrors(input: {
    batchId?: string;
    limit?: number;
    phase?: string;
    severity?: string;
  }) {
    const take = Math.min(Math.max(input.limit ?? 50, 1), 100);
    return this.prisma.contentImportError.findMany({
      include: {
        batch: true,
        rawItem: true
      },
      orderBy: { createdAt: "desc" },
      take,
      where: {
        ...(input.batchId ? { importBatchId: input.batchId } : {}),
        ...(input.phase ? { phase: input.phase } : {}),
        ...(input.severity ? { severity: input.severity } : {})
      }
    });
  }

  async escalateImportErrorToDeadLetter(input: { actorId: string; id: string; reason: string }) {
    const importError = await this.prisma.contentImportError.findUniqueOrThrow({
      include: {
        batch: true,
        rawItem: true
      },
      where: { id: input.id }
    });
    const eventType = `content_import_error:${importError.id}`;
    const existing = await this.prisma.deadLetterEntry.findFirst({
      where: {
        eventType,
        source: "content_import_error",
        status: { in: ["open", "failed"] }
      }
    });
    if (existing) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.deadLetterEntry.create({
        data: {
          errorCode: importError.code,
          errorMessage: importError.message,
          eventType,
          payload: {
            batchId: importError.importBatchId,
            importErrorId: importError.id,
            phase: importError.phase,
            rawItemId: importError.rawItemId,
            sample: importError.sample,
            severity: importError.severity,
            sourceDir: importError.batch.sourceDir,
            sourceFile: importError.sourceFile ?? importError.rawItem?.sourceFile ?? null,
            sourceKey: importError.sourceKey ?? importError.rawItem?.sourceKey ?? null,
            sourceType: importError.batch.sourceType
          } as Prisma.InputJsonValue,
          queueName: "content.import",
          source: "content_import_error"
        }
      });
      await tx.adminAuditLog.create({
        data: {
          action: "ops.import_error.dead_letter.create",
          actorId: input.actorId,
          after: created as unknown as Prisma.InputJsonValue,
          before: importError as unknown as Prisma.InputJsonValue,
          reason: input.reason,
          targetId: input.id,
          targetType: "content.import_error"
        }
      });
      return created;
    });
  }

  async rebuildSearchProjection(input: { actorId: string; reason: string }) {
    if (!this.searchService) {
      throw new BadRequestException("Search rebuild service unavailable");
    }
    const summary = await this.searchService.rebuildProjectionIndex();
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ops.search.rebuild",
        actorId: input.actorId,
        after: summary as unknown as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: "content_search",
        targetType: "ops.search_index"
      }
    });
    return summary;
  }

  async resolveDeadLetter(input: { actorId: string; id: string; reason: string; status: "resolved" | "discarded" }) {
    const existing = await this.prisma.deadLetterEntry.findUniqueOrThrow({ where: { id: input.id } });
    if (!["open", "failed"].includes(existing.status)) {
      throw new BadRequestException("Dead-letter entry is not open");
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deadLetterEntry.update({
        data: { resolvedAt: new Date(), status: input.status },
        where: { id: input.id }
      });
      await tx.adminAuditLog.create({
        data: {
          action: `ops.dead_letter.${input.status}`,
          actorId: input.actorId,
          after: updated as unknown as Prisma.InputJsonValue,
          before: existing as unknown as Prisma.InputJsonValue,
          reason: input.reason,
          targetId: input.id,
          targetType: "ops.dead_letter_entry"
        }
      });
      return updated;
    });
  }
}
