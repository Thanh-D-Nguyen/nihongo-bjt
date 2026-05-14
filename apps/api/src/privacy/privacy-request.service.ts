import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";

import { PrivacyRequestProcessor } from "./privacy-request.processor.js";

/**
 * Privacy request service — manages GDPR/privacy export and account deletion requests.
 *
 * Security contract:
 * - Users can only access/create requests for their own userId.
 * - Callers MUST verify userId before calling these methods (controller enforces this).
 * - Export download is access-gated: only the owning user can download their own export.
 * - Account deletion anonymizes PII but preserves audit/legal records (see deletionPayload).
 * - This service schedules async work but does NOT process it inline.
 *   TODO: wire up a BullMQ job processor for real async export/deletion.
 *
 * Stop condition: any endpoint that allows one user to access another user's
 * PrivacyRequest data is a hard security violation.
 */
@Injectable()
export class PrivacyRequestService {
  private readonly logger = new Logger(PrivacyRequestService.name);
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(
    @Inject(PrivacyRequestProcessor) private readonly processor: PrivacyRequestProcessor
  ) {}

  /**
   * Create a privacy request (export or delete).
   * Prevents duplicate pending/processing requests of the same kind.
   */
  async create(userId: string, kind: "export" | "delete") {
    if (kind !== "export" && kind !== "delete") {
      throw new BadRequestException({
        code: "PRIVACY_INVALID_KIND",
        message: 'kind must be "export" or "delete"'
      });
    }

    // Prevent duplicate active requests
    const existing = await this.prisma.privacyRequest.findFirst({
      select: { id: true, status: true },
      where: {
        kind,
        status: { in: ["pending", "processing"] },
        userId
      }
    });

    if (existing) {
      throw new ConflictException({
        code: "PRIVACY_REQUEST_ALREADY_PENDING",
        message: `A ${kind} request is already pending or processing`,
        existingRequestId: existing.id
      });
    }

    const request = await this.prisma.privacyRequest.create({
      data: { kind, userId }
    });

    this.logger.log(
      `[Privacy] Created ${kind} request id=${request.id} userId=${userId}`
    );

    // Dispatch async processing (fire-and-forget; errors handled by processor)
    this.processor.process(request.id).catch((err) => {
      this.logger.error(
        `[Privacy] Processor failed for request ${request.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    });

    return {
      id: request.id,
      kind: request.kind,
      status: request.status,
      createdAt: request.createdAt,
      message: kind === "export"
        ? "Your export will be prepared. You will receive a notification when it is ready."
        : "Your account deletion request has been queued. Processing may take up to 30 days."
    };
  }

  /**
   * List privacy requests for a specific user (own data only).
   */
  async listOwn(userId: string) {
    return this.prisma.privacyRequest.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        completedAt: true,
        createdAt: true,
        id: true,
        kind: true,
        lastError: true,
        // resultPayload excluded: may contain download URL, returned only on explicit download
        status: true
      },
      where: { userId }
    });
  }

  /**
   * Get a specific privacy request (user must own it).
   */
  async getOwn(userId: string, requestId: string) {
    const req = await this.prisma.privacyRequest.findUnique({
      where: { id: requestId }
    });

    if (!req) {
      throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND" });
    }

    // Security: strict userId check prevents cross-user access
    if (req.userId !== userId) {
      throw new ForbiddenException({ code: "PRIVACY_REQUEST_ACCESS_DENIED" });
    }

    return {
      completedAt: req.completedAt,
      createdAt: req.createdAt,
      id: req.id,
      kind: req.kind,
      status: req.status
      // resultPayload (download URL) intentionally omitted — use getDownloadUrl
    };
  }

  /**
   * Get download URL for a completed export request.
   * Only the owning user can download their export.
   * TODO: in production, generate a pre-signed S3/object storage URL here.
   */
  async getDownloadUrl(userId: string, requestId: string) {
    const req = await this.prisma.privacyRequest.findUnique({
      where: { id: requestId }
    });

    if (!req) {
      throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND" });
    }

    // Strict cross-user check
    if (req.userId !== userId) {
      throw new ForbiddenException({ code: "PRIVACY_REQUEST_ACCESS_DENIED" });
    }

    if (req.kind !== "export") {
      throw new BadRequestException({
        code: "PRIVACY_REQUEST_NOT_EXPORT",
        message: "Download is only available for export requests"
      });
    }

    if (req.status !== "completed") {
      return {
        status: req.status,
        downloadUrl: null,
        message: req.status === "pending" || req.status === "processing"
          ? "Your export is being prepared. Check back later."
          : "Export processing failed. Please submit a new request."
      };
    }

    // TODO: resultPayload.downloadUrl should contain a pre-signed URL generated by the processor
    // For now, return the stored URL if present
    const payload = req.resultPayload as Record<string, unknown> | null;
    const downloadUrl = payload?.downloadUrl as string | undefined ?? null;

    return {
      status: "completed",
      downloadUrl,
      expiresAt: payload?.expiresAt ?? null
    };
  }

  /* ── Admin listing & lifecycle ── */

  async adminListRequests(params: {
    kind?: string;
    limit: number;
    offset: number;
    status?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (params.kind) where.kind = params.kind;
    if (params.status) where.status = params.status;

    const [items, total] = await Promise.all([
      this.prisma.privacyRequest.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          kind: true,
          status: true,
          lastError: true,
          createdAt: true,
          completedAt: true
        },
        skip: params.offset,
        take: params.limit,
        where
      }),
      this.prisma.privacyRequest.count({ where })
    ]);

    return { items, total };
  }

  async adminGetRequest(id: string) {
    const req = await this.prisma.privacyRequest.findUnique({
      select: {
        completedAt: true,
        createdAt: true,
        id: true,
        kind: true,
        lastError: true,
        resultPayload: true,
        status: true,
        userId: true
      },
      where: { id }
    });
    if (!req) return null;
    const audit = await this.prisma.adminAuditEvent.findMany({
      include: { actor: { select: { displayName: true, email: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
      where: { resourceId: id, resourceType: "admin.privacy_request" }
    });
    return { ...req, audit };
  }

  async adminTransition(input: {
    actorId: string;
    from: string[];
    id: string;
    reason: string;
    to: "processing" | "completed" | "failed";
  }) {
    const before = await this.prisma.privacyRequest.findUnique({ where: { id: input.id } });
    if (!before) {
      throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND" });
    }
    if (!input.from.includes(before.status)) {
      throw new ConflictException({
        code: "PRIVACY_REQUEST_INVALID_TRANSITION",
        currentStatus: before.status,
        message: `Cannot transition request in status ${before.status} → ${input.to}`
      });
    }
    return this.prisma.privacyRequest.update({
      data: { status: input.to },
      where: { id: input.id }
    });
  }

  async adminFulfill(input: {
    actorId: string;
    downloadUrl: string | null;
    id: string;
    notes: string | null;
    reason: string;
  }) {
    const before = await this.prisma.privacyRequest.findUnique({ where: { id: input.id } });
    if (!before) {
      throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND" });
    }
    if (before.status === "completed" || before.status === "failed") {
      throw new ConflictException({
        code: "PRIVACY_REQUEST_ALREADY_TERMINAL",
        currentStatus: before.status
      });
    }
    if (before.kind !== "export") {
      throw new BadRequestException({
        code: "PRIVACY_REQUEST_NOT_EXPORT",
        message: "fulfill is only valid for export requests; use erasure-confirm for delete"
      });
    }
    const payload: Record<string, unknown> = { fulfilledBy: input.actorId };
    if (input.downloadUrl) payload.downloadUrl = input.downloadUrl;
    if (input.notes) payload.notes = input.notes;
    return this.prisma.privacyRequest.update({
      data: {
        completedAt: new Date(),
        lastError: null,
        resultPayload: payload as never,
        status: "completed"
      },
      where: { id: input.id }
    });
  }

  async adminReject(input: { actorId: string; id: string; reason: string }) {
    const before = await this.prisma.privacyRequest.findUnique({ where: { id: input.id } });
    if (!before) {
      throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND" });
    }
    if (before.status === "completed" || before.status === "failed") {
      throw new ConflictException({
        code: "PRIVACY_REQUEST_ALREADY_TERMINAL",
        currentStatus: before.status
      });
    }
    return this.prisma.privacyRequest.update({
      data: {
        completedAt: new Date(),
        lastError: input.reason,
        status: "failed"
      },
      where: { id: input.id }
    });
  }

  async adminEraseConfirm(input: { actorId: string; id: string; reason: string }) {
    const before = await this.prisma.privacyRequest.findUnique({ where: { id: input.id } });
    if (!before) {
      throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND" });
    }
    if (before.kind !== "delete") {
      throw new BadRequestException({
        code: "PRIVACY_REQUEST_NOT_ERASURE",
        message: "erasure-confirm only valid for delete requests"
      });
    }
    if (before.status === "completed" || before.status === "failed") {
      throw new ConflictException({
        code: "PRIVACY_REQUEST_ALREADY_TERMINAL",
        currentStatus: before.status
      });
    }
    // Note: actual user record anonymization is handled by the async erasure processor.
    // This endpoint marks the request irreversibly fulfilled and audits the operator decision.
    this.logger.warn(
      `[Privacy] Erasure confirmed by admin actorId=${input.actorId} requestId=${input.id}`
    );
    return this.prisma.privacyRequest.update({
      data: {
        completedAt: new Date(),
        resultPayload: { erasureConfirmedBy: input.actorId } as never,
        status: "completed"
      },
      where: { id: input.id }
    });
  }
}
