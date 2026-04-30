import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";

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

    // TODO: emit a BullMQ job event here once job processor is wired up
    // await this.jobQueue.add('privacy.process', { requestId: request.id, kind, userId });

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

  /* ── Admin listing ── */

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
}
