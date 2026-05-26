import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

/**
 * Polymorphic content QA service.
 *
 * Tracks human review of any content entity (DailyRadarCard, MagazineArticle,
 * Lexeme, etc.) through a state machine:
 *
 *   pending → in_review → approved → published
 *                     ↘ changes_requested → in_review …
 *                     ↘ rejected (terminal)
 *
 * Each transition writes a new `ContentQaReview` row with an incremented
 * `version` — the latest row per (entityType, entityId) is the current state.
 * Callers are responsible for syncing their entity's own `status` column with
 * the QA state when reaching "published" (e.g. flipping `daily_radar_card.status`
 * from "draft" to "published" — outside this service's scope).
 */
@Injectable()
export class ContentQaService {
  private readonly logger = new Logger(ContentQaService.name);
  private readonly prisma = createPrismaClient();

  /** All recognised QA states. */
  static readonly STATES = [
    "pending",
    "in_review",
    "changes_requested",
    "approved",
    "published",
    "rejected",
  ] as const;

  /**
   * Adjacency map of legal transitions. `null` source means "initial state
   * allowed when no prior row exists".
   */
  private static readonly TRANSITIONS: Record<string, readonly string[]> = {
    pending: ["in_review", "rejected"],
    in_review: ["approved", "changes_requested", "rejected"],
    changes_requested: ["in_review", "rejected"],
    approved: ["published", "changes_requested", "rejected"],
    published: ["changes_requested"], // un-publish for fixes
    rejected: [], // terminal
  };

  /** Initial state for a brand-new entity. */
  async initialize(input: {
    entityType: string;
    entityId: string;
    reviewerId?: string;
    comment?: string;
  }) {
    const existing = await this.getLatest(input.entityType, input.entityId);
    if (existing) {
      throw new BadRequestException(
        `QA already initialized for ${input.entityType}/${input.entityId} ` +
          `(current state: ${existing.state})`,
      );
    }
    return this.prisma.contentQaReview.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        state: "pending",
        reviewerId: input.reviewerId,
        comment: input.comment,
        version: 1,
      },
    });
  }

  /** Apply a state transition. Returns the new ContentQaReview row. */
  async transition(input: {
    entityType: string;
    entityId: string;
    toState: string;
    reviewerId: string;
    comment?: string;
  }) {
    if (!ContentQaService.STATES.includes(input.toState as never)) {
      throw new BadRequestException(`Unknown QA state "${input.toState}"`);
    }

    const latest = await this.getLatest(input.entityType, input.entityId);
    if (!latest) {
      throw new NotFoundException(
        `No QA row for ${input.entityType}/${input.entityId} — call initialize() first`,
      );
    }

    const allowed = ContentQaService.TRANSITIONS[latest.state] ?? [];
    if (!allowed.includes(input.toState)) {
      throw new BadRequestException(
        `Illegal transition: ${latest.state} → ${input.toState}. ` +
          `Allowed: [${allowed.join(", ") || "(terminal)"}]`,
      );
    }

    return this.prisma.contentQaReview.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        state: input.toState,
        reviewerId: input.reviewerId,
        comment: input.comment,
        version: latest.version + 1,
      },
    });
  }

  /** Return latest review row (current state) for an entity, or null. */
  async getLatest(entityType: string, entityId: string) {
    return this.prisma.contentQaReview.findFirst({
      where: { entityType, entityId },
      orderBy: { version: "desc" },
    });
  }

  /** Return full review history for an entity, oldest → newest. */
  async getHistory(entityType: string, entityId: string) {
    return this.prisma.contentQaReview.findMany({
      where: { entityType, entityId },
      orderBy: { version: "asc" },
    });
  }

  /**
   * Reviewer queue: latest row per entity, filtered by state. Sorted oldest
   * first so reviewers tackle aging items first.
   *
   * Uses a window over (entityType, entityId) to pick the latest version,
   * then filters by requested state. PostgreSQL-specific.
   */
  async queue(input: {
    entityType: string;
    state: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);
    return this.prisma.$queryRawUnsafe<
      {
        id: string;
        entity_type: string;
        entity_id: string;
        state: string;
        reviewer_id: string | null;
        comment: string | null;
        version: number;
        created_at: Date;
      }[]
    >(
      `WITH latest AS (
         SELECT *,
                ROW_NUMBER() OVER (PARTITION BY entity_type, entity_id ORDER BY version DESC) AS rn
         FROM content.content_qa_review
         WHERE entity_type = $1
       )
       SELECT id, entity_type, entity_id, state, reviewer_id, comment, version, created_at
       FROM latest
       WHERE rn = 1 AND state = $2
       ORDER BY created_at ASC
       LIMIT $3 OFFSET $4`,
      input.entityType,
      input.state,
      limit,
      offset,
    );
  }
}
