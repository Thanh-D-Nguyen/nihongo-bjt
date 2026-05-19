import { Logger } from "@nestjs/common";

import type {
  Candidate,
  PipelineConfig,
  PipelineResult,
  UserContext,
} from "./types.js";

/**
 * Executes a recommendation pipeline: source → hydrate → filter → score → select.
 * Mirrors X's Home Mixer orchestration pattern.
 */
export async function executePipeline<T = unknown>(
  config: PipelineConfig<T>,
  ctx: UserContext,
  limit: number,
): Promise<PipelineResult<T>> {
  const logger = new Logger(`Pipeline:${config.name}`);
  const start = Date.now();

  // 1. Source candidates (parallel)
  const sourced = await Promise.all(
    config.sources.map(async (src) => {
      try {
        return await src.fetch(ctx, limit * 3); // over-fetch for filtering headroom
      } catch (err) {
        logger.error(`Source ${src.name} failed`, err instanceof Error ? err.stack : err);
        return [] as Candidate<T>[];
      }
    }),
  );
  let candidates = sourced.flat();
  const totalSourced = candidates.length;

  // 2. Hydrate (sequential — each hydrator may depend on prior enrichment)
  for (const hydrator of config.hydrators) {
    try {
      candidates = await hydrator.hydrate(candidates, ctx);
    } catch (err) {
      logger.warn(`Hydrator ${hydrator.name} failed, skipping`, err instanceof Error ? err.message : err);
    }
  }

  // 3. Pre-scoring filters
  for (const filter of config.preFilters) {
    candidates = filter.filter(candidates, ctx);
  }
  const totalAfterFilter = candidates.length;

  // 4. Scoring (sequential — later scorers adjust earlier scores)
  for (const scorer of config.scorers) {
    candidates = scorer.score(candidates, ctx);
  }
  const totalScored = candidates.length;

  // 5. Selection (top-K)
  candidates = config.selector.select(candidates, limit);

  // 6. Post-selection filters
  for (const filter of config.postFilters) {
    candidates = filter.filter(candidates, ctx);
  }

  const executionMs = Date.now() - start;
  logger.debug(`Executed in ${executionMs}ms: ${totalSourced}→${totalAfterFilter}→${candidates.length}`);

  return {
    candidates,
    meta: {
      pipeline: config.name,
      totalSourced,
      totalAfterFilter,
      totalScored,
      totalReturned: candidates.length,
      executionMs,
    },
  };
}
