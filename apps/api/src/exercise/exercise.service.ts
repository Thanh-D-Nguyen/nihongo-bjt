import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";

import { GamificationService } from "../gamification/gamification.service.js";
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

    const generated = await this.generator.generate({
      exerciseType,
      level: params.level,
      count: params.count,
      sourceType: params.sourceType
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
        correctTokens.length === userTokens.length &&
        correctTokens.every((t, i) => t === userTokens[i]);
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

    return {
      ...answer,
      isCorrect,
      correctAnswer: exercise.correctAnswer,
      explanation: exercise.explanation
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
}
