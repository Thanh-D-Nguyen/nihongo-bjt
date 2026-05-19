import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";

import { GamificationService } from "../gamification/gamification.service.js";
import { computeNextReview, type ExerciseRating, type SrsState } from "./exercise-srs.algorithm.js";
import { ExerciseGeneratorService } from "./exercise-generator.service.js";
import { ExerciseRepository } from "./exercise.repository.js";

@Injectable()
export class ExerciseService {
  private readonly logger = new Logger(ExerciseService.name);

  constructor(
    @Inject(ExerciseRepository) private readonly repo: ExerciseRepository,
    @Inject(ExerciseGeneratorService) private readonly generator: ExerciseGeneratorService,
    @Inject(GamificationService) private readonly gamification: GamificationService
  ) {}

  /** Generate a batch of exercises on-the-fly and persist them. */
  async generateExercises(params: {
    type?: string;
    level?: string;
    count: number;
    sourceType?: string;
    placement?: string;
    userId?: string;
  }) {
    const exerciseType = params.type ?? "meaning_match";

    // If placement is specified, check which types are enabled
    if (params.placement) {
      const configs = await this.repo.enabledConfigsForPlacement(params.placement);
      if (configs.length > 0) {
        const enabledTypes = configs.map((c) => c.exerciseType);
        if (!enabledTypes.includes(exerciseType) && params.type) {
          throw new BadRequestException(
            `Exercise type "${exerciseType}" is not enabled for placement "${params.placement}"`
          );
        }
      }
    }

    // Resolve adaptive difficulty based on user performance
    let difficulty: string | undefined;
    if (params.userId) {
      const perf = await this.repo.getUserPerformance(
        params.userId,
        exerciseType,
        params.level ?? null
      );
      if (perf) {
        difficulty = perf.currentDifficulty;
      }
    }

    const generated = await this.generator.generate({
      exerciseType,
      level: params.level,
      count: params.count,
      sourceType: params.sourceType,
      difficulty
    });

    // Persist generated exercises
    const persisted = [];
    for (const ex of generated) {
      const saved = await this.repo.createExercise(ex);
      persisted.push(saved);
    }

    return persisted;
  }

  /** Start a new exercise session. */
  async startSession(data: {
    userId: string;
    sessionType: string;
    exerciseType: string;
    level?: string;
  }) {
    return this.repo.createSession({
      userId: data.userId,
      sessionType: data.sessionType,
      exerciseType: data.exerciseType,
      level: data.level ?? null
    });
  }

  /** Submit an answer for an exercise in a session. */
  async submitAnswer(data: {
    sessionId: string;
    exerciseId: string;
    userAnswer: unknown;
    timeSpentMs?: number;
    userId: string;
  }) {
    const session = await this.repo.findSession(data.sessionId);
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== data.userId) throw new BadRequestException("Session does not belong to user");
    if (session.status !== "in_progress") throw new BadRequestException("Session already completed");

    // Look up exercise directly by ID instead of scanning all exercises
    const exercise = await this.repo.findExerciseById(data.exerciseId);
    if (!exercise) throw new NotFoundException("Exercise not found");

    const correctAnswer = exercise.correctAnswer as Record<string, unknown> | null;
    const userAnswer = data.userAnswer as Record<string, unknown> | null;

    if (!correctAnswer || typeof correctAnswer !== "object") {
      throw new BadRequestException("Exercise has no valid correct answer");
    }
    if (!userAnswer || typeof userAnswer !== "object") {
      throw new BadRequestException("Invalid user answer format");
    }

    let isCorrect: boolean;
    if (exercise.exerciseType === "word_order") {
      const correctTokens = correctAnswer.orderedTokens;
      const userTokens = userAnswer.orderedTokens;
      isCorrect =
        Array.isArray(correctTokens) &&
        Array.isArray(userTokens) &&
        isWordOrderAcceptable(correctTokens as string[], userTokens as string[]);
    } else {
      isCorrect = correctAnswer.key === userAnswer.key;
    }

    const answer = await this.repo.submitAnswer({
      sessionId: data.sessionId,
      exerciseId: data.exerciseId,
      userAnswer: data.userAnswer,
      isCorrect,
      timeSpentMs: data.timeSpentMs ?? 0
    });

    // Update adaptive performance tracking
    try {
      await this.repo.upsertPerformance({
        userId: data.userId,
        exerciseType: exercise.exerciseType,
        level: exercise.level,
        isCorrect,
        timeSpentMs: data.timeSpentMs ?? 0
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Performance tracking failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Auto-create remediation flashcard on incorrect answer
    let remediationCardId: string | null = null;
    if (!isCorrect) {
      try {
        remediationCardId = await this.createRemediationCard(data.userId, exercise);
        // Also enqueue for SRS review
        await this.enqueueForReview(data.userId, data.exerciseId);
      } catch (error: unknown) {
        this.logger.warn(
          `Remediation card creation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return {
      ...answer,
      isCorrect,
      correctAnswer: exercise.correctAnswer,
      explanation: exercise.explanation,
      remediationCardId
    };
  }

  /** Complete a session, calculating scores. */
  async completeSession(sessionId: string, userId: string) {
    const session = await this.repo.findSession(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== userId) throw new BadRequestException("Session does not belong to user");
    if (session.status !== "in_progress") throw new BadRequestException("Session already completed");

    const completed = await this.repo.completeSession(sessionId);

    // Trigger gamification hooks
    try {
      await this.gamification.recordActivity(userId, "exercise");
      await this.gamification.incrementMetric(userId, "exercises_completed", 1);
    } catch (error: unknown) {
      this.logger.warn(
        `Gamification hook failed for session=${sessionId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return completed;
  }

  /**
   * Create a remediation flashcard from a failed exercise.
   * Extracts front/back text from the exercise prompt and correct answer.
   * Returns the card ID if created, null if already exists.
   */
  private async createRemediationCard(
    userId: string,
    exercise: { id: string; exerciseType: string; sourceType: string; sourceId: string; prompt: unknown; correctAnswer: unknown; explanation: string | null }
  ): Promise<string | null> {
    // Check if remediation already exists for this user+exercise
    const existing = await this.repo.findRemediation(userId, exercise.id);
    if (existing) return existing.cardId;

    const prompt = exercise.prompt as Record<string, unknown>;
    const correct = exercise.correctAnswer as Record<string, unknown>;

    // Build front/back text based on exercise type
    let frontText: string;
    let backText: string;
    let reading: string | undefined;

    switch (exercise.exerciseType) {
      case "meaning_match":
        frontText = (prompt.text as string) ?? "?";
        reading = prompt.reading as string | undefined;
        backText = (correct.key as string)
          ? exercise.explanation ?? (correct.text as string) ?? "?"
          : "?";
        break;
      case "cloze":
        frontText = (prompt.maskedSentence as string) ?? "?";
        backText = (correct.text as string) ?? exercise.explanation ?? "?";
        break;
      case "word_order":
        frontText = (prompt.hint as string) ?? "?";
        backText = Array.isArray(correct.orderedTokens)
          ? (correct.orderedTokens as string[]).join("")
          : "?";
        break;
      case "translation":
      case "listening":
        frontText = (prompt.japaneseSentence as string) ?? "?";
        reading = prompt.reading as string | undefined;
        backText = exercise.explanation ?? "?";
        break;
      default:
        frontText = String(prompt.text ?? "?");
        backText = exercise.explanation ?? "?";
    }

    // Create the flashcard variant
    const card = await this.repo.createRemediationFlashcard({
      sourceType: `exercise_${exercise.sourceType}`,
      sourceId: exercise.sourceId,
      frontText,
      backText,
      reading
    });

    // Link it to the user's SRS queue
    await this.repo.createUserFlashcard(userId, card.id);

    // Record remediation link
    await this.repo.createRemediation({
      userId,
      exerciseId: exercise.id,
      cardId: card.id,
      sourceType: exercise.sourceType,
      sourceId: exercise.sourceId
    });

    return card.id;
  }

  /** Manually create a remediation flashcard from any exercise. */
  async manualRemediate(userId: string, exerciseId: string) {
    const exercise = await this.repo.findExerciseById(exerciseId);
    if (!exercise) throw new NotFoundException("Exercise not found");

    const cardId = await this.createRemediationCard(userId, exercise);
    if (!cardId) {
      // Already exists
      const existing = await this.repo.findRemediation(userId, exerciseId);
      return { cardId: existing?.cardId, alreadyExists: true };
    }
    return { cardId, alreadyExists: false };
  }

  /* ── SRS Review ──────────────────────────────────────────────────────── */

  /** Get exercises due for SRS review. */
  async getDueReviews(userId: string, limit: number = 20) {
    return this.repo.getDueExercisesWithDetails(userId, limit);
  }

  /** Record an SRS review response (updates scheduling). */
  async reviewExercise(userId: string, exerciseId: string, rating: ExerciseRating) {
    const existing = await this.repo.findReviewState(userId, exerciseId);

    const currentState: SrsState = existing
      ? {
          state: existing.state as SrsState["state"],
          easeFactor: existing.easeFactor,
          intervalDays: existing.intervalDays,
          repetitions: existing.repetitions,
          lapses: existing.lapses,
          dueAt: existing.dueAt
        }
      : {
          state: "new",
          easeFactor: 2.5,
          intervalDays: 0,
          repetitions: 0,
          lapses: 0,
          dueAt: new Date()
        };

    const next = computeNextReview(currentState, rating);

    await this.repo.upsertReviewState({
      userId,
      exerciseId,
      ...next
    });

    return next;
  }

  /** Enqueue an exercise for SRS review (called on incorrect answers). */
  async enqueueForReview(userId: string, exerciseId: string) {
    const existing = await this.repo.findReviewState(userId, exerciseId);
    if (existing) return; // Already in queue

    await this.repo.upsertReviewState({
      userId,
      exerciseId,
      state: "new",
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      lapses: 0,
      dueAt: new Date()
    });
  }
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

/**
 * Check if word order answer is acceptable.
 * Exact match OR concatenated form matches (handles minor token boundary differences).
 */
function isWordOrderAcceptable(correct: string[], user: string[]): boolean {
  // Exact token-by-token match
  if (correct.length === user.length && correct.every((t, i) => t === user[i])) {
    return true;
  }

  // Concatenated form match — handles cases where kuromoji splits differently
  // than how the user reassembled (e.g. "食べ" + "ました" vs "食べました")
  const correctJoined = correct.join("");
  const userJoined = user.join("");
  return correctJoined === userJoined;
}
