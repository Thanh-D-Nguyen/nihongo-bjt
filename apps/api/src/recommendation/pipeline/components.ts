import type { Candidate, Filter, Scorer, Selector, UserContext } from "./types.js";

// ─── Common Filters ───────────────────────────────────────────────────────────

/** Remove candidates already served to user recently */
export class AlreadyServedFilter<T = unknown> implements Filter<T> {
  name = "AlreadyServedFilter";

  filter(candidates: Candidate<T>[], ctx: UserContext): Candidate<T>[] {
    return candidates.filter((c) => !ctx.recentlyServed.has(c.id));
  }
}

/** Remove duplicates by candidate ID */
export class DeduplicateFilter<T = unknown> implements Filter<T> {
  name = "DeduplicateFilter";

  filter(candidates: Candidate<T>[]): Candidate<T>[] {
    const seen = new Set<string>();
    return candidates.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }
}

/** Remove candidates completed today */
export class CompletedTodayFilter<T = unknown> implements Filter<T> {
  name = "CompletedTodayFilter";

  filter(candidates: Candidate<T>[], ctx: UserContext): Candidate<T>[] {
    return candidates.filter((c) => !ctx.completedToday.has(c.id));
  }
}

// ─── Common Scorers ───────────────────────────────────────────────────────────

/**
 * Multi-action weighted scorer (core X algorithm concept).
 * Each candidate has predicted probabilities in features map;
 * final score = Σ(weight_i × feature_i).
 */
export class WeightedScorer<T = unknown> implements Scorer<T> {
  name = "WeightedScorer";

  constructor(private readonly weights: Record<string, number>) {}

  score(candidates: Candidate<T>[]): Candidate<T>[] {
    return candidates.map((c) => {
      let score = 0;
      for (const [key, weight] of Object.entries(this.weights)) {
        score += weight * (c.features[key] ?? 0);
      }
      c.score = score;
      return c;
    });
  }
}

/**
 * Diversity scorer: attenuate repeated types/sources.
 * Mirrors X's AuthorDiversityScorer — prevents feed dominated by one category.
 */
export class DiversityScorer<T = unknown> implements Scorer<T> {
  name = "DiversityScorer";

  constructor(
    private readonly groupBy: (c: Candidate<T>) => string,
    private readonly decay = 0.7,
  ) {}

  score(candidates: Candidate<T>[]): Candidate<T>[] {
    // Sort by current score first
    candidates.sort((a, b) => b.score - a.score);

    const groupCounts = new Map<string, number>();
    return candidates.map((c) => {
      const group = this.groupBy(c);
      const count = groupCounts.get(group) ?? 0;
      // Apply exponential decay for repeated groups
      c.score *= Math.pow(this.decay, count);
      groupCounts.set(group, count + 1);
      return c;
    });
  }
}

/**
 * Recency scorer: boost newer content.
 */
export class RecencyScorer<T = unknown> implements Scorer<T> {
  name = "RecencyScorer";

  constructor(
    private readonly getTimestamp: (c: Candidate<T>) => number,
    private readonly halfLifeMs = 7 * 24 * 60 * 60 * 1000, // 7 days
  ) {}

  score(candidates: Candidate<T>[]): Candidate<T>[] {
    const now = Date.now();
    return candidates.map((c) => {
      const age = now - this.getTimestamp(c);
      const recencyBoost = Math.exp(-0.693 * (age / this.halfLifeMs)); // ln(2) ≈ 0.693
      c.features["recency"] = recencyBoost;
      c.score += 0.2 * recencyBoost; // additive boost
      return c;
    });
  }
}

// ─── Default Selector ─────────────────────────────────────────────────────────

/** Sort by score descending, take top K */
export class TopKSelector<T = unknown> implements Selector<T> {
  select(candidates: Candidate<T>[], limit: number): Candidate<T>[] {
    return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
