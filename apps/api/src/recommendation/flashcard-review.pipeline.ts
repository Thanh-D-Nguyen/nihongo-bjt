import { Injectable, Logger } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

import {
  DeduplicateFilter,
  DiversityScorer,
  TopKSelector,
  WeightedScorer,
  executePipeline,
} from "./pipeline/index.js";
import type {
  Candidate,
  CandidateSource,
  Hydrator,
  PipelineConfig,
  PipelineResult,
  Scorer,
  UserContext,
} from "./pipeline/types.js";

// ─── Candidate Data ───────────────────────────────────────────────────────────

interface FlashcardCandidate {
  cardId: string;
  deckId: string;
  deckName: string;
  state: string; // new, learning, review, leeched
  easeFactor: number;
  interval: number;
  lapses: number;
  dueAt: number; // epoch ms
}

// ─── Sources ──────────────────────────────────────────────────────────────────

/**
 * Cards due for review (overdue first).
 * Real schema path: user_flashcard → flashcard_variant (via card_id) → deck_card (via card_id) → deck
 */
class OverdueCardsSource implements CandidateSource<FlashcardCandidate> {
  name = "OverdueCards";
  private readonly prisma = createPrismaClient();

  async fetch(ctx: UserContext, limit: number): Promise<Candidate<FlashcardCandidate>[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      {
        id: string;
        card_id: string;
        deck_id: string;
        deck_name: string;
        state: string;
        ease_factor: number;
        interval_days: number;
        lapses: number;
        due_at: Date;
      }[]
    >(
      `SELECT uf.id, uf.card_id, dc.deck_id, d.title_vi as deck_name,
              uf.state, uf.ease_factor, uf.interval_days, uf.lapses, uf.due_at
       FROM learning.user_flashcard uf
       JOIN learning.deck_card dc ON dc.card_id = uf.card_id
       JOIN learning.deck d ON d.id = dc.deck_id
       WHERE uf.user_id = $1::uuid
         AND uf.due_at <= NOW()
         AND uf.state != 'suspended'
       ORDER BY uf.due_at ASC
       LIMIT $2`,
      ctx.userId,
      limit,
    );

    return rows.map((r) => this.toCandidate(r));
  }

  private toCandidate(r: {
    id: string;
    card_id: string;
    deck_id: string;
    deck_name: string;
    state: string;
    ease_factor: number;
    interval_days: number;
    lapses: number;
    due_at: Date;
  }): Candidate<FlashcardCandidate> {
    const overdueMs = Math.max(0, Date.now() - r.due_at.getTime());
    const overdueDays = overdueMs / (24 * 60 * 60 * 1000);

    return {
      id: r.id,
      type: "flashcard_review",
      data: {
        cardId: r.card_id,
        deckId: r.deck_id,
        deckName: r.deck_name,
        state: r.state,
        easeFactor: r.ease_factor,
        interval: r.interval_days,
        lapses: r.lapses,
        dueAt: r.due_at.getTime(),
      },
      features: {
        overdue_ratio: Math.min(overdueDays / 7, 1.0),
        p_recall: this.predictRecall(r.ease_factor, r.interval_days, overdueDays),
        p_lapse: Math.min(r.lapses / 5, 1.0),
        learning_value: r.state === "learning" ? 0.9 : r.state === "new" ? 0.8 : 0.5,
        urgency: Math.min(overdueDays / 3, 1.0),
      },
      score: 0,
      source: "OverdueCards",
    };
  }

  private predictRecall(ease: number, interval: number, overdueDays: number): number {
    const stability = interval * (ease / 2.5);
    if (stability <= 0) return 0.3;
    return Math.exp(-overdueDays / stability);
  }
}

/** New cards ready to learn */
class NewCardsSource implements CandidateSource<FlashcardCandidate> {
  name = "NewCards";
  private readonly prisma = createPrismaClient();

  async fetch(ctx: UserContext, limit: number): Promise<Candidate<FlashcardCandidate>[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      {
        id: string;
        card_id: string;
        deck_id: string;
        deck_name: string;
        ease_factor: number;
        created_at: Date;
      }[]
    >(
      `SELECT uf.id, uf.card_id, dc.deck_id, d.title_vi as deck_name,
              uf.ease_factor, uf.created_at
       FROM learning.user_flashcard uf
       JOIN learning.deck_card dc ON dc.card_id = uf.card_id
       JOIN learning.deck d ON d.id = dc.deck_id
       WHERE uf.user_id = $1::uuid
         AND uf.state = 'new'
       ORDER BY uf.created_at ASC
       LIMIT $2`,
      ctx.userId,
      limit,
    );

    return rows.map((r) => ({
      id: r.id,
      type: "flashcard_review" as const,
      data: {
        cardId: r.card_id,
        deckId: r.deck_id,
        deckName: r.deck_name,
        state: "new",
        easeFactor: r.ease_factor,
        interval: 0,
        lapses: 0,
        dueAt: r.created_at.getTime(),
      },
      features: {
        p_recall: 0.0,
        learning_value: 1.0,
        novelty: 1.0,
        urgency: 0.2,
      },
      score: 0,
      source: "NewCards",
    }));
  }
}

/** Leeched cards that need special attention */
class LeechedCardsSource implements CandidateSource<FlashcardCandidate> {
  name = "LeechedCards";
  private readonly prisma = createPrismaClient();

  async fetch(ctx: UserContext, limit: number): Promise<Candidate<FlashcardCandidate>[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      {
        id: string;
        card_id: string;
        deck_id: string;
        deck_name: string;
        ease_factor: number;
        interval_days: number;
        lapses: number;
        due_at: Date;
      }[]
    >(
      `SELECT uf.id, uf.card_id, dc.deck_id, d.title_vi as deck_name,
              uf.ease_factor, uf.interval_days, uf.lapses, uf.due_at
       FROM learning.user_flashcard uf
       JOIN learning.deck_card dc ON dc.card_id = uf.card_id
       JOIN learning.deck d ON d.id = dc.deck_id
       WHERE uf.user_id = $1::uuid
         AND uf.leeched = true
         AND uf.state != 'suspended'
       ORDER BY uf.lapses DESC
       LIMIT $2`,
      ctx.userId,
      limit,
    );

    return rows.map((r) => ({
      id: r.id,
      type: "flashcard_review" as const,
      data: {
        cardId: r.card_id,
        deckId: r.deck_id,
        deckName: r.deck_name,
        state: "leeched",
        easeFactor: r.ease_factor,
        interval: r.interval_days,
        lapses: r.lapses,
        dueAt: r.due_at.getTime(),
      },
      features: {
        p_recall: 0.2,
        p_lapse: 0.9,
        learning_value: 0.6,
        needs_attention: 1.0,
        urgency: 0.5,
      },
      score: 0,
      source: "LeechedCards",
    }));
  }
}

// ─── Flashcard-Specific Scorers ───────────────────────────────────────────────

/**
 * Interleaving scorer: mix review/new/leeched for optimal learning.
 */
class InterleavingScorer implements Scorer<FlashcardCandidate> {
  name = "InterleavingScorer";

  score(candidates: Candidate<FlashcardCandidate>[]): Candidate<FlashcardCandidate>[] {
    candidates.sort((a, b) => b.score - a.score);

    const result: Candidate<FlashcardCandidate>[] = [];
    const bySource = new Map<string, Candidate<FlashcardCandidate>[]>();

    for (const c of candidates) {
      const arr = bySource.get(c.source) ?? [];
      arr.push(c);
      bySource.set(c.source, arr);
    }

    const sources = [...bySource.entries()].sort(
      (a, b) => (b[1][0]?.score ?? 0) - (a[1][0]?.score ?? 0),
    );

    let idx = 0;
    while (result.length < candidates.length) {
      const [, cards] = sources[idx % sources.length];
      if (cards.length > 0) {
        result.push(cards.shift()!);
      }
      idx++;
      if (sources.every(([, c]) => c.length === 0)) break;
    }

    return result.map((c, i) => {
      c.score = candidates.length - i;
      return c;
    });
  }
}

// ─── Hydrator ─────────────────────────────────────────────────────────────────

/** Enrich with recent review performance on same deck */
class DeckPerformanceHydrator implements Hydrator<FlashcardCandidate> {
  name = "DeckPerformanceHydrator";
  private readonly prisma = createPrismaClient();

  async hydrate(
    candidates: Candidate<FlashcardCandidate>[],
    ctx: UserContext,
  ): Promise<Candidate<FlashcardCandidate>[]> {
    if (candidates.length === 0) return candidates;

    const deckIds = [...new Set(candidates.map((c) => c.data.deckId))];
    if (deckIds.length === 0) return candidates;

    try {
      // review_event.rating is VARCHAR (again/hard/good/easy)
      // Convert to numeric for averaging
      const rows = await this.prisma.$queryRawUnsafe<
        { deck_id: string; avg_score: number }[]
      >(
        `SELECT dc.deck_id,
                AVG(CASE re.rating
                  WHEN 'again' THEN 1
                  WHEN 'hard' THEN 2
                  WHEN 'good' THEN 3
                  WHEN 'easy' THEN 4
                  ELSE 2.5
                END)::float as avg_score
         FROM learning.review_event re
         JOIN learning.user_flashcard uf ON uf.id = re.user_flashcard_id
         JOIN learning.deck_card dc ON dc.card_id = uf.card_id
         WHERE re.user_id = $1::uuid
           AND re.reviewed_at >= NOW() - INTERVAL '7 days'
           AND dc.deck_id = ANY($2::uuid[])
         GROUP BY dc.deck_id`,
        ctx.userId,
        deckIds,
      );

      const deckAccuracy = new Map(rows.map((r) => [r.deck_id, r.avg_score / 4.0]));

      return candidates.map((c) => {
        const accuracy = deckAccuracy.get(c.data.deckId);
        if (accuracy !== undefined) {
          c.features["deck_momentum"] = accuracy;
          if (accuracy > 0.8) c.features["urgency"] *= 0.8;
        }
        return c;
      });
    } catch {
      return candidates;
    }
  }
}

// ─── Pipeline Assembly ────────────────────────────────────────────────────────

@Injectable()
export class FlashcardReviewPipeline {
  private readonly logger = new Logger(FlashcardReviewPipeline.name);

  private readonly config: PipelineConfig<FlashcardCandidate> = {
    name: "FlashcardReview",
    sources: [
      new OverdueCardsSource(),
      new NewCardsSource(),
      new LeechedCardsSource(),
    ],
    hydrators: [new DeckPerformanceHydrator()],
    preFilters: [new DeduplicateFilter()],
    scorers: [
      new WeightedScorer<FlashcardCandidate>({
        urgency: 0.30,
        learning_value: 0.25,
        p_lapse: 0.15,
        needs_attention: 0.15,
        novelty: 0.10,
        deck_momentum: 0.05,
        p_recall: -0.10,
      }),
      new DiversityScorer<FlashcardCandidate>((c) => c.data.deckId, 0.75),
      new InterleavingScorer(),
    ],
    postFilters: [],
    selector: new TopKSelector(),
  };

  async execute(ctx: UserContext, limit = 20): Promise<PipelineResult<FlashcardCandidate>> {
    return executePipeline(this.config, ctx, limit);
  }
}
