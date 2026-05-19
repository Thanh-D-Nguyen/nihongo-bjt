import { Injectable, Logger } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

import {
  AlreadyServedFilter,
  DeduplicateFilter,
  DiversityScorer,
  RecencyScorer,
  TopKSelector,
  WeightedScorer,
  executePipeline,
} from "./pipeline/index.js";
import type {
  Candidate,
  CandidateSource,
  Filter,
  Hydrator,
  PipelineConfig,
  PipelineResult,
  UserContext,
} from "./pipeline/types.js";

// ─── Candidate Data ───────────────────────────────────────────────────────────

interface NewsCandidate {
  title: string;
  summary: string;
  category: string; // source_type: easy/normal
  jlptLevel: number; // derived from source_type
  publishedAt: number;
  wordCount: number;
  source: string;
}

// ─── Sources ──────────────────────────────────────────────────────────────────

/**
 * NHK articles filtered by difficulty matching user level.
 * Real schema: content.nhk_article has source_type (easy/normal), difficulty, published_at
 * We derive jlptLevel from source_type: easy=4-5, normal=1-3
 */
class NhkNewsSource implements CandidateSource<NewsCandidate> {
  name = "NhkNews";
  private readonly prisma = createPrismaClient();

  async fetch(ctx: UserContext, limit: number): Promise<Candidate<NewsCandidate>[]> {
    // Determine which source_type to prioritize based on user level
    const sourceTypes = ctx.estimatedLevel >= 4 ? ["easy"] : ctx.estimatedLevel <= 2 ? ["normal"] : ["easy", "normal"];

    const rows = await this.prisma.$queryRawUnsafe<
      {
        id: string;
        title: string;
        source_type: string;
        difficulty: string | null;
        published_at: Date;
        body_plain: string | null;
      }[]
    >(
      `SELECT n.id, n.title, n.source_type, n.difficulty, n.published_at, n.body_plain
       FROM content.nhk_article n
       WHERE n.source_type = ANY($1::text[])
         AND n.published_at >= NOW() - INTERVAL '14 days'
       ORDER BY n.published_at DESC
       LIMIT $2`,
      sourceTypes,
      limit,
    );

    return rows.map((r) => {
      const jlptLevel = r.source_type === "easy" ? 4 : 2;
      const wordCount = r.body_plain ? r.body_plain.length : 200; // approximate from char count

      return {
        id: r.id,
        type: "news_article" as const,
        data: {
          title: r.title,
          summary: r.body_plain?.slice(0, 100) ?? "",
          category: r.source_type,
          jlptLevel,
          publishedAt: r.published_at.getTime(),
          wordCount,
          source: "nhk",
        },
        features: {
          level_match: 1.0 - Math.abs(jlptLevel - ctx.estimatedLevel) / 5.0,
          recency: 0, // set by RecencyScorer
        },
        score: 0,
        source: this.name,
      };
    });
  }
}

/**
 * Trending/recently read articles (out-of-network discovery).
 * Uses reading progress count as trending signal.
 */
class TrendingNewsSource implements CandidateSource<NewsCandidate> {
  name = "TrendingNews";
  private readonly prisma = createPrismaClient();

  async fetch(ctx: UserContext, limit: number): Promise<Candidate<NewsCandidate>[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      {
        id: string;
        title: string;
        source_type: string;
        published_at: Date;
        body_plain: string | null;
        read_count: bigint;
      }[]
    >(
      `SELECT n.id, n.title, n.source_type, n.published_at, n.body_plain,
              COUNT(rp.id)::bigint as read_count
       FROM content.nhk_article n
       LEFT JOIN learning.nhk_reading_progress rp ON rp.article_id = n.id
       WHERE n.published_at >= NOW() - INTERVAL '7 days'
       GROUP BY n.id
       ORDER BY read_count DESC
       LIMIT $1`,
      limit,
    );

    return rows.map((r) => {
      const jlptLevel = r.source_type === "easy" ? 4 : 2;
      const wordCount = r.body_plain ? r.body_plain.length : 200;

      return {
        id: r.id,
        type: "news_article" as const,
        data: {
          title: r.title,
          summary: r.body_plain?.slice(0, 100) ?? "",
          category: r.source_type,
          jlptLevel,
          publishedAt: r.published_at.getTime(),
          wordCount,
          source: "nhk",
        },
        features: {
          level_match: 1.0 - Math.abs(jlptLevel - ctx.estimatedLevel) / 5.0,
          trending: Math.min(Number(r.read_count) / 50, 1.0),
          discovery: 1.0,
        },
        score: 0,
        source: this.name,
      };
    });
  }
}

// ─── News Filters ─────────────────────────────────────────────────────────────

/** Filter articles too hard for user (2+ levels above) */
class DifficultyFilter implements Filter<NewsCandidate> {
  name = "DifficultyFilter";

  filter(candidates: Candidate<NewsCandidate>[], ctx: UserContext): Candidate<NewsCandidate>[] {
    return candidates.filter((c) => c.data.jlptLevel <= ctx.estimatedLevel + 2);
  }
}

// ─── News Hydrator ────────────────────────────────────────────────────────────

/** Boost articles matching user's interests */
class TopicInterestHydrator implements Hydrator<NewsCandidate> {
  name = "TopicInterestHydrator";

  async hydrate(
    candidates: Candidate<NewsCandidate>[],
    ctx: UserContext,
  ): Promise<Candidate<NewsCandidate>[]> {
    return candidates.map((c) => {
      // Reading length preference: shorter articles for lower levels
      const idealWordCount = 150 + ctx.estimatedLevel * 100;
      const lengthDiff = Math.abs(c.data.wordCount - idealWordCount) / idealWordCount;
      c.features["length_match"] = Math.max(0, 1.0 - lengthDiff);

      // If user has bookmarked nhk articles, boost similar source_type
      if (ctx.enrolledTopics.includes("nhk_article")) {
        c.features["topic_interest"] = 0.5;
      }

      return c;
    });
  }
}

// ─── Pipeline Assembly ────────────────────────────────────────────────────────

@Injectable()
export class NewsFeedPipeline {
  private readonly logger = new Logger(NewsFeedPipeline.name);

  private readonly config: PipelineConfig<NewsCandidate> = {
    name: "NewsFeed",
    sources: [new NhkNewsSource(), new TrendingNewsSource()],
    hydrators: [new TopicInterestHydrator()],
    preFilters: [
      new DeduplicateFilter(),
      new AlreadyServedFilter(),
      new DifficultyFilter(),
    ],
    scorers: [
      new RecencyScorer<NewsCandidate>(
        (c) => c.data.publishedAt,
        3 * 24 * 60 * 60 * 1000, // 3-day half-life for news
      ),
      new WeightedScorer<NewsCandidate>({
        level_match: 0.30,
        recency: 0.25,
        topic_interest: 0.20,
        length_match: 0.10,
        trending: 0.10,
        discovery: 0.05,
      }),
      new DiversityScorer<NewsCandidate>((c) => c.data.category, 0.8),
    ],
    postFilters: [],
    selector: new TopKSelector(),
  };

  async execute(ctx: UserContext, limit = 10): Promise<PipelineResult<NewsCandidate>> {
    return executePipeline(this.config, ctx, limit);
  }
}
