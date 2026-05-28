import { parseServerEnv } from "@nihongo-bjt/config";
import { createPrismaClient, type Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { HttpException, Inject, Injectable, Logger } from "@nestjs/common";

import { FeatureFlagKey, Quota } from "../monetization/monetization.constants.js";
import { utcDateKey } from "../monetization/quota-window.util.js";
import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";

export interface ImageSearchResult {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  photographer: string;
  source: "unsplash" | "pixabay" | "google";
  license: string;
}

@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);
  private readonly env = parseServerEnv(process.env);
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(
    @Inject(RuntimeFeatureGateService) private readonly featureGate: RuntimeFeatureGateService
  ) {}

  /**
   * Search images across configured providers, with daily quota enforcement.
   * Free users: 5/day. Premium: resolved from plan.
   */
  async search(userId: string, query: string, limit: number): Promise<ImageSearchResult[]> {
    await this.consumeImageSearchQuota(userId);

    const providers: Promise<ImageSearchResult[]>[] = [];

    if (this.env.UNSPLASH_ACCESS_KEY) {
      providers.push(this.searchUnsplash(query, limit));
    }
    if (this.env.PIXABAY_API_KEY) {
      providers.push(this.searchPixabay(query, limit));
    }
    if (this.env.GOOGLE_CSE_KEY && this.env.GOOGLE_CSE_CX) {
      providers.push(this.searchGoogle(query, limit));
    }

    if (providers.length === 0) {
      this.logger.warn("No image search providers configured");
      return [];
    }

    const results = await Promise.allSettled(providers);
    const merged: ImageSearchResult[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") merged.push(...r.value);
    }

    // Dedupe by fullUrl, limit total
    const seen = new Set<string>();
    const deduped: ImageSearchResult[] = [];
    for (const img of merged) {
      if (!seen.has(img.fullUrl)) {
        seen.add(img.fullUrl);
        deduped.push(img);
      }
      if (deduped.length >= limit) break;
    }
    return deduped;
  }

  // ── Quota ──

  private async consumeImageSearchQuota(userId: string): Promise<void> {
    if (!(await this.isEnforcementEnabled())) return;

    const quotaKey = Quota.image_search_daily;
    const windowKey = utcDateKey();

    await this.prisma.$transaction(async (tx) => {
      // Resolve limit from user plan (fallback: 5 for free)
      const plan = await tx.userSubscription.findFirst({
        where: { userId, status: "active" },
        select: {
          plan: {
            select: {
              planQuotas: {
                where: { quotaPolicy: { key: quotaKey } },
                select: { limitValue: true }
              }
            }
          }
        }
      });
      const limit = plan?.plan?.planQuotas?.[0]?.limitValue ?? 5;
      if (limit <= 0) {
        throw new HttpException({ code: "QUOTA_EXCEEDED", limit, quotaKey, used: 0 }, 403);
      }

      const consumed = await this.incrementUsageCounter(tx, { limit, quotaKey, userId, windowKey });
      if (!consumed) {
        const current = await tx.usageCounter.findUnique({
          where: { userId_quotaKey_windowKey: { userId, quotaKey, windowKey } }
        });
        throw new HttpException(
          { code: "QUOTA_EXCEEDED", limit, quotaKey, used: current?.value ?? limit },
          403
        );
      }
    });
  }

  private async incrementUsageCounter(
    tx: Prisma.TransactionClient,
    input: { limit: number; quotaKey: string; userId: string; windowKey: string }
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ value: number }>>`
      INSERT INTO "monetization"."usage_counter" ("user_id", "quota_key", "window_key", "value", "updated_at")
      VALUES (${input.userId}::uuid, ${input.quotaKey}, ${input.windowKey}, 1, now())
      ON CONFLICT ("user_id", "quota_key", "window_key")
      DO UPDATE SET "value" = "usage_counter"."value" + 1, "updated_at" = now()
      WHERE "usage_counter"."value" < ${input.limit}
      RETURNING "value"
    `;
    return rows.length > 0;
  }

  private async isEnforcementEnabled(): Promise<boolean> {
    const { enabled } = await this.featureGate.status(FeatureFlagKey.monetization_enforcement, {
      missingBehavior: "allow"
    });
    return enabled;
  }

  // ── Unsplash ──

  private async searchUnsplash(query: string, perPage: number): Promise<ImageSearchResult[]> {
    try {
      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", query);
      url.searchParams.set("per_page", String(Math.min(perPage, 30)));
      url.searchParams.set("orientation", "squarish");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Client-ID ${this.env.UNSPLASH_ACCESS_KEY}` },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        results: Array<{
          id: string;
          urls: { thumb: string; regular: string };
          width: number;
          height: number;
          user: { name: string };
        }>;
      };
      return data.results.map((r) => ({
        id: `unsplash-${r.id}`,
        thumbUrl: r.urls.thumb,
        fullUrl: r.urls.regular,
        width: r.width,
        height: r.height,
        photographer: r.user.name,
        source: "unsplash" as const,
        license: "Unsplash License"
      }));
    } catch (err) {
      this.logger.warn(`Unsplash search failed: ${err}`);
      return [];
    }
  }

  // ── Pixabay ──

  private async searchPixabay(query: string, perPage: number): Promise<ImageSearchResult[]> {
    try {
      const url = new URL("https://pixabay.com/api/");
      url.searchParams.set("key", this.env.PIXABAY_API_KEY!);
      url.searchParams.set("q", query);
      url.searchParams.set("per_page", String(Math.min(perPage, 200)));
      url.searchParams.set("image_type", "photo");
      url.searchParams.set("safesearch", "true");

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        hits: Array<{
          id: number;
          previewURL: string;
          webformatURL: string;
          imageWidth: number;
          imageHeight: number;
          user: string;
        }>;
      };
      return data.hits.map((h) => ({
        id: `pixabay-${h.id}`,
        thumbUrl: h.previewURL,
        fullUrl: h.webformatURL,
        width: h.imageWidth,
        height: h.imageHeight,
        photographer: h.user,
        source: "pixabay" as const,
        license: "Pixabay License"
      }));
    } catch (err) {
      this.logger.warn(`Pixabay search failed: ${err}`);
      return [];
    }
  }

  // ── Google Custom Search ──

  private async searchGoogle(query: string, num: number): Promise<ImageSearchResult[]> {
    try {
      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.set("key", this.env.GOOGLE_CSE_KEY!);
      url.searchParams.set("cx", this.env.GOOGLE_CSE_CX!);
      url.searchParams.set("q", query);
      url.searchParams.set("searchType", "image");
      url.searchParams.set("num", String(Math.min(num, 10)));
      url.searchParams.set("safe", "active");

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        items?: Array<{
          title: string;
          link: string;
          image: { thumbnailLink: string; width: number; height: number };
        }>;
      };
      return (data.items ?? []).map((item, i) => ({
        id: `google-${i}-${Date.now()}`,
        thumbUrl: item.image.thumbnailLink,
        fullUrl: item.link,
        width: item.image.width,
        height: item.image.height,
        photographer: "",
        source: "google" as const,
        license: "Web search result"
      }));
    } catch (err) {
      this.logger.warn(`Google CSE search failed: ${err}`);
      return [];
    }
  }
}
