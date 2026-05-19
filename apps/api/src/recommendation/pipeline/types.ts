/**
 * Core Recommendation Pipeline Framework
 * Inspired by X's open-source candidate-pipeline architecture.
 *
 * Pipeline stages: Source → Hydrate → Filter → Score → Select
 * Each stage is composable and independently testable.
 */

/** A candidate flowing through the pipeline */
export interface Candidate<T = unknown> {
  id: string;
  type: CandidateType;
  data: T;
  features: Record<string, number>;
  score: number;
  source: string;
}

export type CandidateType =
  | "flashcard_review"
  | "exercise"
  | "lesson"
  | "news_article"
  | "quiz"
  | "vocabulary"
  | "grammar_point";

/** User context hydrated at query time */
export interface UserContext {
  userId: string;
  /** Recent engagement actions: { actionType → count in last N days } */
  recentEngagement: Record<string, number>;
  /** Weak skill areas identified from low accuracy */
  weakSkills: string[];
  /** Topics the user follows or studies */
  enrolledTopics: string[];
  /** JLPT/BJT level estimate */
  estimatedLevel: number;
  /** Recent item IDs already seen/served */
  recentlyServed: Set<string>;
  /** Items completed today */
  completedToday: Set<string>;
  /** Streak days */
  currentStreak: number;
}

/** Fetches candidates from a data source */
export interface CandidateSource<T = unknown> {
  name: string;
  fetch(ctx: UserContext, limit: number): Promise<Candidate<T>[]>;
}

/** Enriches candidates with additional features */
export interface Hydrator<T = unknown> {
  name: string;
  hydrate(candidates: Candidate<T>[], ctx: UserContext): Promise<Candidate<T>[]>;
}

/** Removes ineligible candidates */
export interface Filter<T = unknown> {
  name: string;
  filter(candidates: Candidate<T>[], ctx: UserContext): Candidate<T>[];
}

/** Computes/adjusts scores */
export interface Scorer<T = unknown> {
  name: string;
  score(candidates: Candidate<T>[], ctx: UserContext): Candidate<T>[];
}

/** Selects top-K candidates from scored list */
export interface Selector<T = unknown> {
  select(candidates: Candidate<T>[], limit: number): Candidate<T>[];
}

/** Pipeline configuration */
export interface PipelineConfig<T = unknown> {
  name: string;
  sources: CandidateSource<T>[];
  hydrators: Hydrator<T>[];
  preFilters: Filter<T>[];
  scorers: Scorer<T>[];
  postFilters: Filter<T>[];
  selector: Selector<T>;
}

/** Pipeline execution result with metadata */
export interface PipelineResult<T = unknown> {
  candidates: Candidate<T>[];
  meta: {
    pipeline: string;
    totalSourced: number;
    totalAfterFilter: number;
    totalScored: number;
    totalReturned: number;
    executionMs: number;
  };
}
