import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable, Logger } from "@nestjs/common";

/**
 * Privacy request processor — handles async export and deletion/anonymization.
 *
 * Currently invoked synchronously from PrivacyRequestService.
 * TODO: when BullMQ is wired, this becomes a job processor.
 *
 * Security:
 *   - Export: collects all user PII, packages as JSON, stores result in DB.
 *   - Deletion: anonymizes PII in all tables, preserves audit/legal records.
 *   - Never deletes audit logs or legal consent records.
 */
@Injectable()
export class PrivacyRequestProcessor {
  private readonly logger = new Logger(PrivacyRequestProcessor.name);
  private readonly prisma: PrismaClient = createPrismaClient();

  /**
   * Process a privacy request by ID. Determines kind and dispatches.
   */
  async process(requestId: string): Promise<void> {
    const request = await this.prisma.privacyRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      this.logger.error(`[Privacy] Request not found: ${requestId}`);
      return;
    }

    if (request.status !== "pending") {
      this.logger.warn(`[Privacy] Request ${requestId} status=${request.status}, skipping`);
      return;
    }

    // Mark as processing
    await this.prisma.privacyRequest.update({
      data: { status: "processing" },
      where: { id: requestId }
    });

    try {
      if (request.kind === "export") {
        await this.processExport(request.userId, requestId);
      } else if (request.kind === "delete") {
        await this.processDeletion(request.userId, requestId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Privacy] Processing failed for ${requestId}: ${errorMessage}`);
      await this.prisma.privacyRequest.update({
        data: { lastError: errorMessage, status: "failed" },
        where: { id: requestId }
      });
    }
  }

  /**
   * Export all user data as JSON. Stores the result in the request's resultPayload.
   * In production, this should upload to MinIO/S3 and store a pre-signed URL.
   */
  private async processExport(userId: string, requestId: string): Promise<void> {
    this.logger.log(`[Privacy] Starting export for userId=${userId}`);

    const [
      profile,
      flashcards,
      quizSessions,
      subscriptions,
      analyticsEvents,
      careerState,
      careerSkillStats,
      chapterAttempts
    ] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { id: userId } }),
      this.prisma.userFlashcard.findMany({
        select: {
          createdAt: true,
          dueAt: true,
          easeFactor: true,
          flashcardId: true,
          id: true,
          interval: true,
          lapses: true,
          lastReviewedAt: true,
          repetitions: true,
          status: true
        },
        where: { userId }
      }),
      this.prisma.quizSession.findMany({
        select: {
          completedAt: true,
          createdAt: true,
          id: true,
          quizId: true,
          score: true,
          status: true,
          totalQuestions: true
        },
        where: { userId }
      }),
      this.prisma.userSubscription.findMany({
        select: {
          cancelAtPeriodEnd: true,
          createdAt: true,
          currentPeriodEnd: true,
          currentPeriodStart: true,
          id: true,
          planId: true,
          provider: true,
          status: true
        },
        where: { userId }
      }),
      this.prisma.analyticsEvent.findMany({
        select: {
          createdAt: true,
          eventName: true,
          id: true,
          payload: true,
          source: true
        },
        where: { userId }
      }),
      this.prisma.userCareerState.findUnique({ where: { userId } }).catch(() => null),
      this.prisma.careerSkillStat.findMany({ where: { userId } }).catch(() => []),
      this.prisma.chapterAttempt.findMany({ where: { userId } }).catch(() => [])
    ]);

    const exportData = {
      analyticsEvents,
      careerSkillStats,
      careerState,
      chapterAttempts,
      exportedAt: new Date().toISOString(),
      flashcards,
      profile,
      quizSessions,
      subscriptions,
      userId
    };

    // Store export as JSON in resultPayload
    // In production: upload to MinIO, store pre-signed URL with expiry
    await this.prisma.privacyRequest.update({
      data: {
        completedAt: new Date(),
        resultPayload: {
          downloadUrl: null, // TODO: pre-signed MinIO URL
          exportData,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          format: "json",
          recordCount: flashcards.length + quizSessions.length + analyticsEvents.length
        },
        status: "completed"
      },
      where: { id: requestId }
    });

    this.logger.log(`[Privacy] Export completed for userId=${userId} requestId=${requestId}`);
  }

  /**
   * Anonymize user PII across all tables.
   * Preserves: audit logs, legal consent records, subscription events (for legal compliance).
   * Anonymizes: profile, flashcards, quiz sessions, analytics, career data.
   */
  private async processDeletion(userId: string, requestId: string): Promise<void> {
    this.logger.log(`[Privacy] Starting deletion/anonymization for userId=${userId}`);

    const anonymizedLabel = `[deleted-${requestId.substring(0, 8)}]`;

    await this.prisma.$transaction(async (tx) => {
      // Anonymize profile
      await tx.userProfile.updateMany({
        data: {
          displayName: anonymizedLabel,
          email: `${anonymizedLabel}@deleted.nihongo-bjt.local`,
          learningPersonality: null,
          learningPurpose: null,
          targetBjtBand: null
        },
        where: { id: userId }
      });

      // Delete flashcards (learning data, not audit)
      await tx.userFlashcard.deleteMany({ where: { userId } });

      // Delete quiz sessions and answers
      await tx.quizSession.deleteMany({ where: { userId } });

      // Delete analytics events (user-level, not system)
      await tx.analyticsEvent.deleteMany({ where: { userId } });

      // Delete career game state
      await tx.chapterAttempt.deleteMany({ where: { userId } }).catch(() => {});
      await tx.careerSkillStat.deleteMany({ where: { userId } }).catch(() => {});
      await tx.userCareerState.deleteMany({ where: { userId } }).catch(() => {});

      // Cancel subscriptions (keep records for billing audit)
      await tx.userSubscription.updateMany({
        data: { status: "canceled" },
        where: { status: { in: ["active", "trialing"] }, userId }
      });

      // Preserve: adminAuditEvent (legal/audit requirement)
      // Preserve: subscriptionEvent (billing audit trail)
    });

    await this.prisma.privacyRequest.update({
      data: {
        completedAt: new Date(),
        resultPayload: {
          anonymizedLabel,
          deletedAt: new Date().toISOString(),
          preservedRecords: ["admin_audit", "subscription_events"]
        },
        status: "completed"
      },
      where: { id: requestId }
    });

    this.logger.log(
      `[Privacy] Deletion/anonymization completed for userId=${userId} requestId=${requestId}`
    );
  }
}
