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

  async listDeadLettersFiltered(input: {
    status?: string;
    queueName?: string;
    source?: string;
    q?: string;
    limit: number;
    offset: number;
  }) {
    const where: Prisma.DeadLetterEntryWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.queueName ? { queueName: { contains: input.queueName, mode: "insensitive" } } : {}),
      ...(input.source ? { source: { contains: input.source, mode: "insensitive" } } : {}),
      ...(input.q
        ? {
            OR: [
              { eventType: { contains: input.q, mode: "insensitive" } },
              { errorCode: { contains: input.q, mode: "insensitive" } },
              { errorMessage: { contains: input.q, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.deadLetterEntry.findMany({
        orderBy: { createdAt: "desc" },
        skip: input.offset,
        take: input.limit,
        where
      }),
      this.prisma.deadLetterEntry.count({ where })
    ]);
    return { items, total };
  }

  async getDeadLetterDetail(id: string) {
    const entry = await this.prisma.deadLetterEntry.findUniqueOrThrow({ where: { id } });
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { displayName: true, email: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
      where: { targetId: id, targetType: "ops.dead_letter_entry" }
    });
    return { ...entry, audit };
  }

  async retryDeadLetter(input: { actorId: string; id: string; reason: string }) {
    const existing = await this.prisma.deadLetterEntry.findUniqueOrThrow({ where: { id: input.id } });
    if (!["open", "failed", "discarded", "resolved"].includes(existing.status)) {
      throw new BadRequestException("Dead-letter entry has unsupported status for retry");
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deadLetterEntry.update({
        data: {
          resolvedAt: null,
          retryCount: { increment: 1 },
          status: "open"
        },
        where: { id: input.id }
      });
      await tx.adminAuditLog.create({
        data: {
          action: "ops.dead_letter.retry",
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

  async bulkDeadLetter(input: {
    actorId: string;
    action: "retry" | "discard";
    ids: string[];
    reason: string;
  }) {
    const entries = await this.prisma.deadLetterEntry.findMany({ where: { id: { in: input.ids } } });
    if (entries.length === 0) {
      return { processed: 0, action: input.action };
    }
    if (input.action === "retry") {
      await this.prisma.$transaction(async (tx) => {
        await tx.deadLetterEntry.updateMany({
          data: { status: "open" },
          where: { id: { in: input.ids } }
        });
        // increment per-row to keep retryCount accurate
        for (const e of entries) {
          await tx.deadLetterEntry.update({
            data: { retryCount: { increment: 1 }, resolvedAt: null },
            where: { id: e.id }
          });
        }
        await tx.adminAuditLog.createMany({
          data: entries.map((e) => ({
            action: "ops.dead_letter.retry",
            actorId: input.actorId,
            after: { bulk: true } as Prisma.InputJsonValue,
            before: e as unknown as Prisma.InputJsonValue,
            reason: input.reason,
            targetId: e.id,
            targetType: "ops.dead_letter_entry"
          }))
        });
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.deadLetterEntry.updateMany({
          data: { resolvedAt: new Date(), status: "discarded" },
          where: { id: { in: input.ids } }
        });
        await tx.adminAuditLog.createMany({
          data: entries.map((e) => ({
            action: "ops.dead_letter.discarded",
            actorId: input.actorId,
            after: { bulk: true, status: "discarded" } as Prisma.InputJsonValue,
            before: e as unknown as Prisma.InputJsonValue,
            reason: input.reason,
            targetId: e.id,
            targetType: "ops.dead_letter_entry"
          }))
        });
      });
    }
    return { processed: entries.length, action: input.action };
  }

  async featureFlagHistory(input: { key: string; limit: number }) {
    const [flag, audits] = await Promise.all([
      this.prisma.featureFlag.findUnique({ where: { key: input.key } }),
      this.prisma.featureFlagAudit.findMany({
        orderBy: { createdAt: "desc" },
        take: input.limit,
        where: { flagKey: input.key }
      })
    ]);
    if (!flag) throw new BadRequestException("Feature flag not found");
    return { flag, audits };
  }

  // ── Security events ───────────────────────────────────────────────────────
  // Event taxonomy maps action prefixes/keywords from admin_audit_log into stable types.
  private static readonly SECURITY_EVENT_TYPES = [
    "failed_login",
    "permission_denied",
    "suspicious_request",
    "rate_limit_exceeded",
    "privilege_escalation_attempt"
  ] as const;

  // Map a security event type to action substrings we recognise in admin_audit_log.
  private securityActionFilters(type: string): Prisma.AdminAuditLogWhereInput {
    switch (type) {
      case "failed_login":
        return { OR: [{ action: { contains: "login.failed" } }, { action: { contains: "auth.failed" } }] };
      case "permission_denied":
        return { OR: [{ action: { contains: "permission_denied" } }, { action: { contains: "rbac.deny" } }] };
      case "suspicious_request":
        return { action: { contains: "suspicious" } };
      case "rate_limit_exceeded":
        return { action: { contains: "rate_limit" } };
      case "privilege_escalation_attempt":
        return { OR: [{ action: { contains: "privilege_escalation" } }, { action: { contains: "rbac.escalate" } }] };
      default:
        return {};
    }
  }

  private static securityEventBaseWhere(): Prisma.AdminAuditLogWhereInput {
    return {
      OR: [
        { targetType: "ops.security_event" },
        { action: { contains: "login.failed" } },
        { action: { contains: "auth.failed" } },
        { action: { contains: "permission_denied" } },
        { action: { contains: "rbac.deny" } },
        { action: { contains: "suspicious" } },
        { action: { contains: "rate_limit" } },
        { action: { contains: "privilege_escalation" } },
        { action: { contains: "rbac.escalate" } },
        { action: { contains: "security." } }
      ]
    };
  }

  async listSecurityEvents(input: {
    type?: string;
    severity?: string;
    actorId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit: number;
    offset: number;
  }) {
    const where: Prisma.AdminAuditLogWhereInput = {
      ...OperationsService.securityEventBaseWhere(),
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.dateFrom || input.dateTo
        ? {
            createdAt: {
              ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
              ...(input.dateTo ? { lte: new Date(input.dateTo) } : {})
            }
          }
        : {})
    };
    if (input.type) {
      Object.assign(where, this.securityActionFilters(input.type));
    }
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        include: { actor: { select: { displayName: true, email: true, id: true } } },
        orderBy: { createdAt: "desc" },
        skip: input.offset,
        take: input.limit,
        where
      }),
      this.prisma.adminAuditLog.count({ where })
    ]);
    // attach inferred type/severity (severity comes from `after` JSON if present)
    const annotated = items.map((it) => {
      const after = (it.after ?? {}) as Record<string, unknown>;
      const severity =
        typeof after.severity === "string"
          ? (after.severity as string)
          : it.action.includes("privilege_escalation")
            ? "critical"
            : it.action.includes("rate_limit") || it.action.includes("permission_denied")
              ? "high"
              : it.action.includes("suspicious")
                ? "medium"
                : "low";
      const inferredType =
        OperationsService.SECURITY_EVENT_TYPES.find((t) => it.action.toLowerCase().includes(t.replace("_", "."))) ??
        OperationsService.SECURITY_EVENT_TYPES.find((t) => it.action.toLowerCase().includes(t)) ??
        "other";
      const resolution = typeof after.resolution === "string" ? (after.resolution as string) : null;
      return { ...it, eventType: inferredType, severity, resolution };
    });
    if (input.severity) {
      const filtered = annotated.filter((it) => it.severity === input.severity);
      return { items: filtered, total: filtered.length };
    }
    return { items: annotated, total };
  }

  async getSecurityEventDetail(id: string) {
    const event = await this.prisma.adminAuditLog.findUniqueOrThrow({
      include: { actor: { select: { displayName: true, email: true, id: true } } },
      where: { id }
    });
    const resolutionAudits = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { displayName: true, email: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
      where: { targetId: id, targetType: "ops.security_event" }
    });
    return { ...event, resolutionAudits };
  }

  async resolveSecurityEvent(input: {
    actorId: string;
    id: string;
    reason: string;
    resolution: "resolved" | "false_positive";
  }) {
    const existing = await this.prisma.adminAuditLog.findUniqueOrThrow({ where: { id: input.id } });
    const created = await this.prisma.adminAuditLog.create({
      data: {
        action: `ops.security.${input.resolution}`,
        actorId: input.actorId,
        after: { resolution: input.resolution } as Prisma.InputJsonValue,
        before: { originalAction: existing.action } as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.id,
        targetType: "ops.security_event"
      }
    });
    return created;
  }

  // ── Broadcast notifications (partial_schema_pending) ─────────────────────
  // Persisted as admin_audit_log entries with targetType=ops.broadcast until a dedicated
  // BroadcastNotification model is added. State machine: draft → scheduled | cancelled, scheduled → sent | cancelled.
  private async broadcastSnapshot(targetId: string) {
    const events = await this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "asc" },
      where: { targetId, targetType: "ops.broadcast" }
    });
    if (events.length === 0) return null;
    const latestState = events[events.length - 1];
    const status = latestState.action.endsWith(".scheduled")
      ? "scheduled"
      : latestState.action.endsWith(".sent")
        ? "sent"
        : latestState.action.endsWith(".cancelled")
          ? "cancelled"
          : "draft";
    // Aggregate latest payload (most recent .updated/.created wins)
    let payload: Record<string, unknown> = {};
    for (const e of events) {
      if (
        e.action === "ops.broadcast.created" ||
        e.action === "ops.broadcast.updated"
      ) {
        const p = (e.after ?? {}) as Record<string, unknown>;
        payload = { ...payload, ...p };
      }
    }
    return {
      id: targetId,
      status,
      createdAt: events[0].createdAt,
      updatedAt: latestState.createdAt,
      ...payload,
      events
    };
  }

  async listBroadcasts(input: {
    status?: "draft" | "scheduled" | "sent" | "cancelled";
    channel?: "push" | "email" | "in_app";
    limit: number;
    offset: number;
  }) {
    // Find unique broadcast IDs from audit log
    const allEvents = await this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      where: { targetType: "ops.broadcast" }
    });
    const idsSeen = new Set<string>();
    const orderedIds: string[] = [];
    for (const e of allEvents) {
      if (!idsSeen.has(e.targetId)) {
        idsSeen.add(e.targetId);
        orderedIds.push(e.targetId);
      }
    }
    const snapshots: Array<NonNullable<Awaited<ReturnType<typeof this.broadcastSnapshot>>>> = [];
    for (const id of orderedIds) {
      const snap = await this.broadcastSnapshot(id);
      if (snap) snapshots.push(snap);
    }
    let filtered = snapshots;
    if (input.status) filtered = filtered.filter((s) => s.status === input.status);
    if (input.channel) filtered = filtered.filter((s) => (s as { channel?: string }).channel === input.channel);
    const total = filtered.length;
    const items = filtered.slice(input.offset, input.offset + input.limit);
    return { items, total };
  }

  async getBroadcastDetail(id: string) {
    const snap = await this.broadcastSnapshot(id);
    if (!snap) throw new BadRequestException("Broadcast not found");
    return snap;
  }

  async estimateBroadcastAudience(audience: {
    locale?: string[];
    plan?: string[];
    level?: string[];
    country?: string[];
    userIds?: string[];
  }) {
    if (audience.userIds && audience.userIds.length > 0) {
      return { estimatedRecipients: audience.userIds.length, exact: true, source: "explicit_user_ids" };
    }
    const where: Prisma.UserProfileWhereInput = {
      ...(audience.locale?.length ? { uiLocale: { in: audience.locale } } : {})
    };
    const total = await this.prisma.userProfile.count({ where });
    const filteredOutNote =
      audience.plan?.length || audience.level?.length || audience.country?.length
        ? "plan/level/country filters not yet enforced server-side (partial_schema_pending)"
        : null;
    return { estimatedRecipients: total, exact: false, source: "userProfile_locale_filter", note: filteredOutNote };
  }

  async createBroadcast(input: {
    actorId: string;
    title: string;
    body: string;
    channel: "push" | "email" | "in_app";
    audience: Record<string, unknown>;
    scheduledAt?: string;
    reason: string;
  }) {
    const targetId = (await this.prisma.$queryRaw<Array<{ id: string }>>`SELECT gen_random_uuid()::text as id`)[0].id;
    const after = {
      audience: input.audience,
      body: input.body,
      channel: input.channel,
      scheduledAt: input.scheduledAt ?? null,
      title: input.title
    } as Prisma.InputJsonValue;
    const created = await this.prisma.adminAuditLog.create({
      data: {
        action: "ops.broadcast.created",
        actorId: input.actorId,
        after,
        reason: input.reason,
        targetId,
        targetType: "ops.broadcast"
      }
    });
    return { id: targetId, status: "draft" as const, createdAuditId: created.id };
  }

  async updateBroadcast(input: {
    actorId: string;
    id: string;
    title?: string;
    body?: string;
    channel?: "push" | "email" | "in_app";
    audience?: Record<string, unknown>;
    scheduledAt?: string;
    reason: string;
  }) {
    const existing = await this.broadcastSnapshot(input.id);
    if (!existing) throw new BadRequestException("Broadcast not found");
    if (existing.status === "sent" || existing.status === "cancelled") {
      throw new BadRequestException("Broadcast is no longer editable");
    }
    const after = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.channel !== undefined ? { channel: input.channel } : {}),
      ...(input.audience !== undefined ? { audience: input.audience } : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {})
    } as Prisma.InputJsonValue;
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ops.broadcast.updated",
        actorId: input.actorId,
        after,
        before: { snapshot: existing as unknown } as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.id,
        targetType: "ops.broadcast"
      }
    });
    return { id: input.id, ok: true as const };
  }

  async transitionBroadcast(input: {
    actorId: string;
    id: string;
    reason: string;
    to: "scheduled" | "cancelled";
  }) {
    const existing = await this.broadcastSnapshot(input.id);
    if (!existing) throw new BadRequestException("Broadcast not found");
    if (input.to === "scheduled" && existing.status !== "draft") {
      throw new BadRequestException("Only draft broadcasts can be scheduled");
    }
    if (input.to === "cancelled" && existing.status !== "draft" && existing.status !== "scheduled") {
      throw new BadRequestException("Broadcast is no longer cancellable");
    }
    await this.prisma.adminAuditLog.create({
      data: {
        action: `ops.broadcast.${input.to}`,
        actorId: input.actorId,
        after: { status: input.to } as Prisma.InputJsonValue,
        before: { status: existing.status } as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.id,
        targetType: "ops.broadcast"
      }
    });
    return { id: input.id, status: input.to };
  }

  // ── Sweep C: system queue actions (partial_schema_pending) ───────────────
  // Pause/resume/drain operate on a feature-flag marker `queue.<name>.paused` and
  // record an audit row. Actual BullMQ pause/resume/drain integration will land in
  // a follow-up phase (workers + dedicated queue audit table).
  async transitionQueue(input: {
    actorId: string;
    queueName: string;
    reason: string;
    action: "pause" | "resume" | "drain";
    confirmation?: string;
  }) {
    if (input.action === "drain" && input.confirmation !== input.queueName) {
      throw new BadRequestException({
        code: "typed_confirmation_required",
        message: "Drain queue requires confirmation field === queueName."
      });
    }
    if (!/^[a-z0-9._:-]{1,120}$/i.test(input.queueName)) {
      throw new BadRequestException("Invalid queueName");
    }
    const flagKey = `queue.${input.queueName}.paused`;
    const before = await this.prisma.featureFlag.findUnique({ where: { key: flagKey } });
    if (input.action !== "drain") {
      const enabled = input.action === "pause";
      const upserted = await this.prisma.featureFlag.upsert({
        create: {
          description: `Queue ${input.queueName} pause state (auto-managed by ops queue-health)`,
          enabled,
          key: flagKey,
          killSwitch: false,
          rules: {} as Prisma.InputJsonValue,
          scope: "ops"
        },
        update: { enabled },
        where: { key: flagKey }
      });
      await this.prisma.adminAuditLog.create({
        data: {
          action: `ops.queue.${input.action}`,
          actorId: input.actorId,
          after: upserted as unknown as Prisma.InputJsonValue,
          before: before ? (before as unknown as Prisma.InputJsonValue) : undefined,
          reason: input.reason,
          targetId: input.queueName,
          targetType: "ops.queue"
        }
      });
      return { queueName: input.queueName, paused: enabled, action: input.action };
    }
    // drain: audit only (workers must observe the audit + paused flag)
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ops.queue.drain",
        actorId: input.actorId,
        after: { status: "drain_requested" } as Prisma.InputJsonValue,
        before: before ? (before as unknown as Prisma.InputJsonValue) : undefined,
        reason: input.reason,
        targetId: input.queueName,
        targetType: "ops.queue"
      }
    });
    return { queueName: input.queueName, action: input.action, status: "drain_requested" };
  }

  async listQueueActions(input: { queueName?: string; limit: number }) {
    return this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      where: {
        targetType: "ops.queue",
        ...(input.queueName ? { targetId: input.queueName } : {})
      }
    });
  }

  // ── Sweep C: release management (audit-only) ──────────────────────────────
  async listReleaseEvents(input: { limit: number }) {
    return this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      where: { targetType: "ops.release" }
    });
  }

  async markReleaseKnownGood(input: { actorId: string; version: string; reason: string; confirmation: string }) {
    if (input.confirmation !== input.version) {
      throw new BadRequestException({
        code: "typed_confirmation_required",
        message: "mark-known-good requires confirmation field === version."
      });
    }
    const summary = this.releaseSummary();
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ops.release.mark_known_good",
        actorId: input.actorId,
        after: { ...summary, version: input.version, knownGood: true } as unknown as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.version,
        targetType: "ops.release"
      }
    });
    return { version: input.version, status: "known_good" };
  }

  async prepareRollback(input: { actorId: string; targetVersion: string; reason: string; confirmation: string }) {
    if (input.confirmation !== input.targetVersion) {
      throw new BadRequestException({
        code: "typed_confirmation_required",
        message: "prepare-rollback requires confirmation field === targetVersion."
      });
    }
    const summary = this.releaseSummary();
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ops.release.prepare_rollback",
        actorId: input.actorId,
        after: {
          currentVersion: summary.version,
          requestedAt: new Date().toISOString(),
          targetVersion: input.targetVersion
        } as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.targetVersion,
        targetType: "ops.release"
      }
    });
    return { targetVersion: input.targetVersion, status: "rollback_prepared" };
  }

  // ── Sweep C: partial reindex ──────────────────────────────────────────────
  async partialReindex(input: { actorId: string; reason: string; contentType: string; confirmation?: string }) {
    if (!["lexeme", "kanji", "grammar", "example"].includes(input.contentType)) {
      throw new BadRequestException("Unsupported contentType for partial reindex");
    }
    if (!this.searchService) {
      throw new BadRequestException("Search rebuild service unavailable");
    }
    // Reuse full rebuild but record a partial audit context so dashboards can attribute
    // reindex actions to a specific contentType. Search service does not currently support
    // type-only reindex; partial_schema_pending until incremental indexer lands.
    const summary = await this.searchService.rebuildProjectionIndex();
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ops.search.rebuild.partial",
        actorId: input.actorId,
        after: { ...summary, contentType: input.contentType } as unknown as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: `content_search:${input.contentType}`,
        targetType: "ops.search_index"
      }
    });
    return { ...summary, contentType: input.contentType, partial_schema_pending: true };
  }

  // ── Sweep C: import error retry / discard / bulk-retry ───────────────────
  async retryImportError(input: { actorId: string; id: string; reason: string }) {
    const existing = await this.prisma.contentImportError.findUniqueOrThrow({ where: { id: input.id } });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ops.import_error.retry",
        actorId: input.actorId,
        after: { id: existing.id, status: "retry_requested" } as Prisma.InputJsonValue,
        before: existing as unknown as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.id,
        targetType: "content.import_error"
      }
    });
    return { id: input.id, status: "retry_requested" };
  }

  async discardImportError(input: { actorId: string; id: string; reason: string }) {
    const existing = await this.prisma.contentImportError.findUniqueOrThrow({ where: { id: input.id } });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ops.import_error.discard",
        actorId: input.actorId,
        after: { id: existing.id, status: "discarded" } as Prisma.InputJsonValue,
        before: existing as unknown as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.id,
        targetType: "content.import_error"
      }
    });
    return { id: input.id, status: "discarded" };
  }

  async bulkImportErrorAction(input: {
    actorId: string;
    ids: string[];
    action: "retry" | "discard";
    reason: string;
  }) {
    const items = await this.prisma.contentImportError.findMany({ where: { id: { in: input.ids } } });
    if (items.length === 0) return { processed: 0, action: input.action };
    await this.prisma.adminAuditLog.createMany({
      data: items.map((it) => ({
        action: `ops.import_error.${input.action}`,
        actorId: input.actorId,
        after: { id: it.id, status: input.action === "retry" ? "retry_requested" : "discarded" } as Prisma.InputJsonValue,
        before: it as unknown as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: it.id,
        targetType: "content.import_error"
      }))
    });
    return { processed: items.length, action: input.action };
  }

  // ── Sweep C: import manifest CRUD + run + history ────────────────────────
  async getImportManifestDetail(id: string) {
    const item = await this.prisma.contentImportMapping.findUniqueOrThrow({ where: { id } });
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
      where: { targetId: id, targetType: "content.import_mapping" }
    });
    return { ...item, audit };
  }

  async createImportManifest(input: {
    actorId: string;
    sourceType: string;
    targetType: string;
    version?: number;
    mapping: Prisma.InputJsonValue;
    notes?: string;
    reason: string;
  }) {
    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.contentImportMapping.create({
        data: {
          mapping: input.mapping,
          notes: input.notes,
          sourceType: input.sourceType,
          status: "draft",
          targetType: input.targetType,
          version: input.version ?? 1
        }
      });
      await tx.adminAuditLog.create({
        data: {
          action: "ops.import_manifest.create",
          actorId: input.actorId,
          after: item as unknown as Prisma.InputJsonValue,
          reason: input.reason,
          targetId: item.id,
          targetType: "content.import_mapping"
        }
      });
      return item;
    });
    return created;
  }

  async updateImportManifest(input: {
    actorId: string;
    id: string;
    mapping?: Prisma.InputJsonValue;
    notes?: string | null;
    status?: "draft" | "active" | "archived";
    reason: string;
  }) {
    const existing = await this.prisma.contentImportMapping.findUniqueOrThrow({ where: { id: input.id } });
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.contentImportMapping.update({
        data: {
          ...(input.mapping !== undefined ? { mapping: input.mapping } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.status !== undefined ? { status: input.status } : {})
        },
        where: { id: input.id }
      });
      await tx.adminAuditLog.create({
        data: {
          action: "ops.import_manifest.update",
          actorId: input.actorId,
          after: next as unknown as Prisma.InputJsonValue,
          before: existing as unknown as Prisma.InputJsonValue,
          reason: input.reason,
          targetId: input.id,
          targetType: "content.import_mapping"
        }
      });
      return next;
    });
    return updated;
  }

  async runImportManifest(input: { actorId: string; id: string; reason: string }) {
    const manifest = await this.prisma.contentImportMapping.findUniqueOrThrow({ where: { id: input.id } });
    if (manifest.status !== "active") {
      throw new BadRequestException("Only active manifests can be run");
    }
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ops.import_manifest.run",
        actorId: input.actorId,
        after: { manifestId: manifest.id, status: "run_requested" } as Prisma.InputJsonValue,
        before: manifest as unknown as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.id,
        targetType: "content.import_mapping"
      }
    });
    return { manifestId: manifest.id, status: "run_requested", partial_schema_pending: true };
  }

  async manifestRunHistory(input: { id: string; limit: number }) {
    return this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      where: {
        targetId: input.id,
        targetType: "content.import_mapping",
        action: "ops.import_manifest.run"
      }
    });
  }

  // ── Sweep C: import overview dashboard ───────────────────────────────────
  async importOverview() {
    const cutoff24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [batchPending, batchInProgress, batchSucceeded24, batchFailed24, errors24, manifestsActive] = await Promise.all([
      this.prisma.contentImportBatch.count({ where: { status: "pending" } }),
      this.prisma.contentImportBatch.count({ where: { status: "running" } }),
      this.prisma.contentImportBatch.count({
        where: { status: "succeeded", completedAt: { gte: cutoff24 } }
      }),
      this.prisma.contentImportBatch.count({
        where: { status: "failed", completedAt: { gte: cutoff24 } }
      }),
      this.prisma.contentImportError.count({ where: { createdAt: { gte: cutoff24 } } }),
      this.prisma.contentImportMapping.count({ where: { status: "active" } })
    ]);
    return {
      generatedAt: new Date().toISOString(),
      pending: batchPending,
      inProgress: batchInProgress,
      succeeded24h: batchSucceeded24,
      failed24h: batchFailed24,
      errors24h: errors24,
      manifestsActive
    };
  }

  // ── Sweep C: BJT dashboard summary (read-only aggregates) ────────────────
  async bjtDashboard() {
    const [tests, sessions, activeTests, recentAttempts, completedAttempts] = await Promise.all([
      this.prisma.bjtMockTest.count(),
      this.prisma.quizSession.count(),
      this.prisma.bjtMockTest.count({ where: { status: "active" } }),
      this.prisma.quizSession.count({
        where: { startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }),
      this.prisma.quizSession.count({ where: { status: "submitted" } })
    ]);
    const passRate = recentAttempts > 0 ? completedAttempts / recentAttempts : null;
    const byLevel = await this.prisma.bjtMockTest.groupBy({
      _count: { _all: true },
      by: ["level"]
    });
    return {
      generatedAt: new Date().toISOString(),
      partial_schema_pending: ["per_skill_pass_rate", "upcoming_exam_dates"],
      bjtTestsTotal: tests,
      bjtTestsActive: activeTests,
      bjtSessionsTotal: sessions,
      bjtAttempts30d: recentAttempts,
      bjtPassRate30d: passRate,
      byLevel: byLevel.map((row) => ({ level: row.level ?? "unknown", count: row._count._all }))
    };
  }
}

