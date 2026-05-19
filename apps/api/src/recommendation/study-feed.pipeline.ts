import { Injectable, Logger } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

import {
  AlreadyServedFilter,
  CompletedTodayFilter,
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
  UserContext,
} from "./pipeline/types.js";
import { UserContextHydrator } from "./user-context.hydrator.js";

// ─── Candidate Data Types ─────────────────────────────────────────────────────

interface StudyCandidate {
  title: string;
  skillTag?: string;
  difficulty: number; // 0-1 normalized
  createdAt: number; // epoch ms
}

// ─── Sources ──────────────────────────────────────────────────────────────────

/**
 * In-Network source: due flashcards (equivalent to X's Thunder).
 * Queries learning.user_flashcard directly — schema matches.
 */
class DueFlashcardsSource implements CandidateSource<StudyCandidate> {
  name = "DueFlashcards";
  private readonly prisma = createPrismaClient();

  async fetch(ctx: UserContext, limit: number): Promise<Candidate<StudyCandidate>[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      { id: string; card_id: string; ease_factor: number; due_at: Date; state: string; front_text: string }[]
    >(
      `SELECT uf.id, uf.card_id, uf.ease_factor, uf.due_at, uf.state, fv.front_text
       FROM learning.user_flashcard uf
       JOIN learning.flashcard_variant fv ON fv.id = uf.card_id
       WHERE uf.user_id = $1::uuid AND uf.due_at <= NOW() AND uf.state != 'suspended'
       ORDER BY uf.due_at ASC
       LIMIT $2`,
      ctx.userId,
      limit,
    );

    return rows.map((r) => ({
      id: r.id,
      type: "flashcard_review" as const,
      data: {
        title: r.front_text.slice(0, 60),
        difficulty: 1.0 - (r.ease_factor / 3.0),
        createdAt: r.due_at.getTime(),
      },
      features: {
        p_remember: r.ease_factor / 3.0,
        p_struggle: r.state === "learning" ? 0.6 : 0.3,
        urgency: r.due_at < new Date() ? 1.0 : 0.5,
        is_overdue: r.due_at < new Date() ? 1.0 : 0.0,
      },
      score: 0,
      source: this.name,
    }));
  }
}

/**
 * In-Network source: exercises matching user's interest tags.
 * exercise.exercise has: tags[] (text[]), level (varchar J5-J1), difficulty (easy/medium/hard)
 */
class TagMatchExercisesSource implements CandidateSource<StudyCandidate> {
  name = "EnrolledExercises";
  private readonly prisma = createPrismaClient();

  async fetch(ctx: UserContext, limit: number): Promise<Candidate<StudyCandidate>[]> {
    if (ctx.enrolledTopics.length === 0) return [];

    // Map enrolled topics to tags for array overlap (&&)
    const rows = await this.prisma.$queryRawUnsafe<
      { id: string; exercise_type: string; level: string | null; difficulty: string; tags: string[]; prompt: unknown }[]
    >(
      `SELECT e.id, e.exercise_type, e.level, e.difficulty, e.tags, e.prompt
       FROM exercise.exercise e
       WHERE e.tags && $1::text[]
       ORDER BY RANDOM()
       LIMIT $2`,
      ctx.enrolledTopics,
      limit,
    );

    return rows.map((r) => ({
      id: r.id,
      type: "exercise" as const,
      data: {
        title: this.extractTitle(r.prompt, r.exercise_type),
        skillTag: r.tags[0],
        difficulty: this.normalizeDifficulty(r.difficulty),
        createdAt: Date.now(),
      },
      features: {
        topic_match: 1.0,
        difficulty_match: this.levelMatch(r.level, ctx.estimatedLevel),
        p_complete: 0.7,
        p_learn: 0.5,
      },
      score: 0,
      source: this.name,
    }));
  }

  private extractTitle(prompt: unknown, exerciseType: string): string {
    if (prompt && typeof prompt === "object" && "question" in (prompt as Record<string, unknown>)) {
      const q = (prompt as { question: string }).question;
      return q.length > 60 ? q.slice(0, 57) + "..." : q;
    }
    return `${exerciseType} exercise`;
  }

  private normalizeDifficulty(d: string): number {
    const map: Record<string, number> = { easy: 0.3, medium: 0.5, hard: 0.8 };
    return map[d] ?? 0.5;
  }

  private levelMatch(exerciseLevel: string | null, userLevel: number): number {
    if (!exerciseLevel) return 0.5;
    const exNum = UserContextHydrator.bjtBandToLevel(exerciseLevel);
    return 1.0 - Math.abs(exNum - userLevel) / 5.0;
  }
}

/**
 * Out-of-Network source: exercises from weak areas (X's Phoenix Retrieval).
 */
class WeakAreaDiscoverySource implements CandidateSource<StudyCandidate> {
  name = "WeakAreaDiscovery";
  private readonly prisma = createPrismaClient();

  async fetch(ctx: UserContext, limit: number): Promise<Candidate<StudyCandidate>[]> {
    if (ctx.weakSkills.length === 0) return [];

    const rows = await this.prisma.$queryRawUnsafe<
      { id: string; exercise_type: string; level: string | null; difficulty: string; tags: string[]; prompt: unknown }[]
    >(
      `SELECT e.id, e.exercise_type, e.level, e.difficulty, e.tags, e.prompt
       FROM exercise.exercise e
       WHERE e.tags && $1::text[]
       ORDER BY RANDOM()
       LIMIT $2`,
      ctx.weakSkills,
      limit,
    );

    return rows.map((r) => ({
      id: r.id,
      type: "exercise" as const,
      data: {
        title: this.extractTitle(r.prompt, r.exercise_type),
        skillTag: r.tags[0],
        difficulty: this.normalizeDifficulty(r.difficulty),
        createdAt: Date.now(),
      },
      features: {
        weak_area_match: 1.0,
        difficulty_match: this.levelMatch(r.level, ctx.estimatedLevel),
        p_complete: 0.5,
        p_learn: 0.8,
        p_struggle: 0.5,
      },
      score: 0,
      source: this.name,
    }));
  }

  private extractTitle(prompt: unknown, exerciseType: string): string {
    if (prompt && typeof prompt === "object" && "question" in (prompt as Record<string, unknown>)) {
      const q = (prompt as { question: string }).question;
      return q.length > 60 ? q.slice(0, 57) + "..." : q;
    }
    return `${exerciseType} exercise`;
  }

  private normalizeDifficulty(d: string): number {
    const map: Record<string, number> = { easy: 0.3, medium: 0.5, hard: 0.8 };
    return map[d] ?? 0.5;
  }

  private levelMatch(exerciseLevel: string | null, userLevel: number): number {
    if (!exerciseLevel) return 0.5;
    const exNum = UserContextHydrator.bjtBandToLevel(exerciseLevel);
    return 1.0 - Math.abs(exNum - userLevel) / 5.0;
  }
}

/**
 * Out-of-Network: BJT lessons user hasn't started yet.
 * curriculum.bjt_lesson has: level_code (J5/J4/..), status (active/inactive), title_vi, title_ja
 */
class UndiscoveredLessonsSource implements CandidateSource<StudyCandidate> {
  name = "UndiscoveredLessons";
  private readonly prisma = createPrismaClient();

  async fetch(ctx: UserContext, limit: number): Promise<Candidate<StudyCandidate>[]> {
    // Build level codes in range [user-1, user+1]
    const codes = this.getLevelCodesInRange(ctx.estimatedLevel);

    const rows = await this.prisma.$queryRawUnsafe<
      { id: string; title_vi: string; title_ja: string; level_code: string; created_at: Date }[]
    >(
      `SELECT l.id, l.title_vi, l.title_ja, l.level_code, l.created_at
       FROM curriculum.bjt_lesson l
       WHERE l.status = 'active'
         AND l.level_code = ANY($1::text[])
       ORDER BY RANDOM()
       LIMIT $2`,
      codes,
      limit,
    );

    return rows.map((r) => ({
      id: r.id,
      type: "lesson" as const,
      data: {
        title: r.title_ja || r.title_vi,
        difficulty: UserContextHydrator.bjtBandToLevel(r.level_code) / 5.0,
        createdAt: r.created_at.getTime(),
      },
      features: {
        level_match: 1.0 - Math.abs(
          UserContextHydrator.bjtBandToLevel(r.level_code) - ctx.estimatedLevel,
        ) / 5.0,
        novelty: 1.0,
        p_complete: 0.6,
        p_learn: 0.7,
      },
      score: 0,
      source: this.name,
    }));
  }

  /** Get level codes within ±1 of user's level */
  private getLevelCodesInRange(level: number): string[] {
    const all = ["J5", "J4", "J3", "J2", "J1"];
    const idx = 5 - level; // J5=level5 → idx 0, J1=level1 → idx 4
    const lo = Math.max(0, idx - 1);
    const hi = Math.min(4, idx + 1);
    return all.slice(lo, hi + 1);
  }
}

// ─── Study-Specific Hydrator ──────────────────────────────────────────────────

/** Enriches candidates with learner's historical performance on similar content */
class PerformanceHydrator implements Hydrator<StudyCandidate> {
  name = "PerformanceHydrator";

  async hydrate(
    candidates: Candidate<StudyCandidate>[],
    ctx: UserContext,
  ): Promise<Candidate<StudyCandidate>[]> {
    return candidates.map((c) => {
      const skillTag = c.data.skillTag;
      if (skillTag && ctx.weakSkills.includes(skillTag)) {
        c.features["weak_area_bonus"] = 0.3;
      }
      // Streak bonus: users with long streaks get slightly harder content
      if (ctx.currentStreak > 7) {
        c.features["streak_challenge_boost"] = 0.1;
      }
      return c;
    });
  }
}

// ─── Pipeline Assembly ────────────────────────────────────────────────────────

@Injectable()
export class StudyFeedPipeline {
  private readonly logger = new Logger(StudyFeedPipeline.name);

  private readonly config: PipelineConfig<StudyCandidate> = {
    name: "StudyFeed",
    sources: [
      new DueFlashcardsSource(),
      new TagMatchExercisesSource(),
      new WeakAreaDiscoverySource(),
      new UndiscoveredLessonsSource(),
    ],
    hydrators: [new PerformanceHydrator()],
    preFilters: [
      new DeduplicateFilter(),
      new AlreadyServedFilter(),
      new CompletedTodayFilter(),
    ],
    scorers: [
      // Multi-action weighted scorer (core X concept)
      new WeightedScorer<StudyCandidate>({
        p_learn: 0.35,
        p_complete: 0.20,
        urgency: 0.20,
        weak_area_match: 0.15,
        weak_area_bonus: 0.10,
        topic_match: 0.10,
        level_match: 0.10,
        novelty: 0.05,
        difficulty_match: 0.05,
        streak_challenge_boost: 0.05,
        p_struggle: -0.10,
        is_overdue: 0.15,
      }),
      // Topic diversity: avoid 5 grammar exercises in a row
      new DiversityScorer<StudyCandidate>((c) => c.data.skillTag ?? c.type, 0.65),
    ],
    postFilters: [],
    selector: new TopKSelector(),
  };

  async execute(ctx: UserContext, limit = 15): Promise<PipelineResult<StudyCandidate>> {
    return executePipeline(this.config, ctx, limit);
  }
}
