import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Inject } from "@nestjs/common";

import { EntitlementService } from "../monetization/entitlement.service.js";
import { EntitlementKey } from "../monetization/monetization.constants.js";

export interface FlashcardStyleConfig {
  cardBg?: string;
  textColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  flipAnimation?: string;
  accentColor?: string;
  backdropBlur?: string;
  shadow?: string;
}

@Injectable()
export class FlashcardStylesService {
  private readonly prisma: PrismaClient = createPrismaClient();
  private readonly logger = new Logger(FlashcardStylesService.name);

  constructor(
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService
  ) {}

  /**
   * List all active styles visible to the user. Free styles always returned;
   * premium/exclusive styles included with `locked: true` unless user has entitlement.
   * Also returns the user's currently active slug.
   */
  async listForLearner(userId: string) {
    const [styles, profile] = await Promise.all([
      this.prisma.flashcardStyle.findMany({
        where: { status: "active" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }),
      this.prisma.userProfile.findUnique({
        where: { id: userId },
        select: { flashcardStyleSlug: true }
      })
    ]);

    const hasPremium = await this.entitlementService.has(
      userId,
      EntitlementKey.flashcard_premium_styles
    );

    return {
      activeSlug: profile?.flashcardStyleSlug ?? null,
      styles: styles.map((s) => ({
        id: s.id,
        slug: s.slug,
        nameKey: s.nameKey,
        descriptionKey: s.descriptionKey,
        thumbnailUrl: s.thumbnailUrl,
        config: s.config as FlashcardStyleConfig,
        tier: s.tier,
        locked: s.tier !== "free" && !hasPremium
      }))
    };
  }

  /**
   * Get the user's currently active style config (resolved from slug).
   */
  async getActiveStyleForUser(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id: userId }
    });
    if (!profile?.flashcardStyleSlug) return null;

    const style = await this.prisma.flashcardStyle.findUnique({
      where: { slug: profile.flashcardStyleSlug, status: "active" }
    });
    if (!style) return null;

    return {
      slug: style.slug,
      nameKey: style.nameKey,
      config: style.config as FlashcardStyleConfig,
      tier: style.tier
    };
  }

  /**
   * Set the active flashcard style for a user. Enforces entitlement for premium/exclusive tiers.
   */
  async setActiveStyle(userId: string, styleSlug: string | null) {
    // Allow null (reset to default)
    if (!styleSlug) {
      await this.prisma.userProfile.update({
        where: { id: userId },
        data: { flashcardStyleSlug: null }
      });
      return { slug: null };
    }

    const style = await this.prisma.flashcardStyle.findUnique({
      where: { slug: styleSlug }
    });
    if (!style || style.status !== "active") {
      throw new NotFoundException("Style not found or inactive");
    }

    // Entitlement check for premium/exclusive
    if (style.tier !== "free") {
      const hasPremium = await this.entitlementService.has(
        userId,
        EntitlementKey.flashcard_premium_styles
      );
      if (!hasPremium) {
        throw new ForbiddenException({
          code: "ENTITLEMENT_DENIED",
          entitlementKey: EntitlementKey.flashcard_premium_styles,
          message: "Upgrade your plan to use premium flashcard styles"
        });
      }
    }

    await this.prisma.userProfile.update({
      where: { id: userId },
      data: { flashcardStyleSlug: styleSlug }
    });

    return {
      slug: style.slug,
      nameKey: style.nameKey,
      config: style.config as FlashcardStyleConfig,
      tier: style.tier
    };
  }

  // ── Admin CRUD ──────────────────────────────────────────────

  async adminList(filters: { status?: string; tier?: string; q?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.tier) where.tier = filters.tier;
    if (filters.q) {
      where.OR = [
        { slug: { contains: filters.q, mode: "insensitive" } },
        { nameKey: { contains: filters.q, mode: "insensitive" } }
      ];
    }

    return this.prisma.flashcardStyle.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  async adminGetById(id: string) {
    const style = await this.prisma.flashcardStyle.findUnique({ where: { id } });
    if (!style) throw new NotFoundException("Style not found");
    return style;
  }

  async adminCreate(data: {
    slug: string;
    nameKey: string;
    descriptionKey?: string;
    thumbnailUrl?: string;
    config: FlashcardStyleConfig;
    tier: string;
    sortOrder?: number;
    status?: string;
  }) {
    return this.prisma.flashcardStyle.create({
      data: {
        slug: data.slug,
        nameKey: data.nameKey,
        descriptionKey: data.descriptionKey ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        config: data.config as object,
        tier: data.tier,
        sortOrder: data.sortOrder ?? 0,
        status: data.status ?? "draft"
      }
    });
  }

  async adminUpdate(
    id: string,
    data: Partial<{
      slug: string;
      nameKey: string;
      descriptionKey: string | null;
      thumbnailUrl: string | null;
      config: FlashcardStyleConfig;
      tier: string;
      sortOrder: number;
      status: string;
    }>
  ) {
    const existing = await this.prisma.flashcardStyle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Style not found");

    return this.prisma.flashcardStyle.update({
      where: { id },
      data: data as object
    });
  }

  async adminTransition(id: string, newStatus: string) {
    const existing = await this.prisma.flashcardStyle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Style not found");

    const valid: Record<string, string[]> = {
      draft: ["active", "archived"],
      active: ["archived", "draft"],
      archived: ["draft"]
    };
    if (!valid[existing.status]?.includes(newStatus)) {
      throw new ForbiddenException(
        `Cannot transition from ${existing.status} to ${newStatus}`
      );
    }

    return this.prisma.flashcardStyle.update({
      where: { id },
      data: { status: newStatus }
    });
  }

  /** Style adoption stats for admin analytics */
  async adminStyleAdoption() {
    const raw = await this.prisma.$queryRaw<
      { slug: string; user_count: bigint }[]
    >`
      SELECT p.flashcard_style_slug AS slug, COUNT(*)::bigint AS user_count
      FROM profile.user_profile p
      WHERE p.flashcard_style_slug IS NOT NULL
      GROUP BY p.flashcard_style_slug
      ORDER BY user_count DESC
    `;
    return raw.map((r) => ({ slug: r.slug, userCount: Number(r.user_count) }));
  }
}
