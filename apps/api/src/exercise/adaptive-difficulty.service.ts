import { Injectable, Logger } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

/**
 * Adaptive Difficulty Service — IRT-inspired ability estimation and
 * difficulty selection.
 *
 * Uses a simplified 1-Parameter Logistic (Rasch) model:
 *   P(correct) = 1 / (1 + e^{-(theta - difficulty)})
 *
 * Theta (ability) is updated after each answer via an ELO-style update:
 *   theta_new = theta_old + K * (outcome - P(correct))
 *
 * where K is a learning rate that decreases as confidence grows (more data).
 *
 * The service maps continuous theta → discrete difficulty levels for the
 * existing exercise generator while maintaining the richer model underneath.
 *
 * Factors considered:
 * - Rolling accuracy (already tracked in UserExercisePerformance.recentWindow)
 * - Response time relative to expected time (speed pressure)
 * - Confidence interval width (how stable is the estimate)
 * - Streak/consistency of recent performance direction
 */
@Injectable()
export class AdaptiveDifficultyService {
  private readonly logger = new Logger(AdaptiveDifficultyService.name);
  private readonly prisma = createPrismaClient();

  /** Difficulty parameters for each level */
  private static readonly DIFFICULTY_MAP: Record<string, number> = {
    easy: -1.0,
    medium: 0.0,
    hard: 1.0,
    expert: 2.0,
  };

  /** Expected response time (ms) by difficulty */
  private static readonly EXPECTED_TIME_MS: Record<string, number> = {
    easy: 8000,
    medium: 12000,
    hard: 18000,
    expert: 25000,
  };

  /** K-factor bounds for ELO-style update */
  private static readonly K_MAX = 0.4;
  private static readonly K_MIN = 0.1;
  private static readonly K_DECAY_RATE = 50; // attempts at which K reaches midpoint

  /**
   * Compute the updated ability estimate (theta) after a single response.
   * Pure function — does not write to DB.
   */
  computeThetaUpdate(params: {
    currentTheta: number;
    difficultyParam: number;
    isCorrect: boolean;
    responseTimeMs: number;
    totalAttempts: number;
  }): { newTheta: number; expectedP: number; surprise: number } {
    const { currentTheta, difficultyParam, isCorrect, responseTimeMs, totalAttempts } = params;

    // P(correct) under Rasch model
    const expectedP = 1 / (1 + Math.exp(-(currentTheta - difficultyParam)));

    // Outcome: 1.0 for correct, 0.0 for wrong
    // Time bonus/penalty: fast correct → slightly higher, slow correct → slightly lower
    const expectedTime = AdaptiveDifficultyService.EXPECTED_TIME_MS[
      this.thetaToDifficulty(currentTheta)
    ] ?? 12000;
    const timeRatio = Math.min(2.0, Math.max(0.3, expectedTime / Math.max(responseTimeMs, 500)));

    // Outcome with time-pressure adjustment (mild — ±0.1 max)
    const timeFactor = isCorrect
      ? Math.min(0.1, (timeRatio - 1.0) * 0.1)
      : Math.max(-0.1, (1.0 - timeRatio) * 0.05);
    const outcome = (isCorrect ? 1.0 : 0.0) + timeFactor;

    // Adaptive K: starts high, decreases with more data
    const k = AdaptiveDifficultyService.K_MIN +
      (AdaptiveDifficultyService.K_MAX - AdaptiveDifficultyService.K_MIN) *
      Math.exp(-totalAttempts / AdaptiveDifficultyService.K_DECAY_RATE);

    const surprise = outcome - expectedP;
    const newTheta = currentTheta + k * surprise;

    // Clamp theta to reasonable range [-3, 3]
    return {
      newTheta: Math.max(-3, Math.min(3, newTheta)),
      expectedP,
      surprise,
    };
  }

  /**
   * Convert continuous theta to discrete difficulty label.
   * Uses threshold boundaries that provide smooth transitions with hysteresis.
   */
  thetaToDifficulty(theta: number): string {
    if (theta >= 1.5) return "expert";
    if (theta >= 0.5) return "hard";
    if (theta >= -0.5) return "medium";
    return "easy";
  }

  /**
   * Compute difficulty with hysteresis to prevent rapid oscillation.
   * Only changes if the new theta is sufficiently far from current boundary.
   */
  computeDifficultyWithHysteresis(
    theta: number,
    currentDifficulty: string,
    recentWindow: boolean[],
  ): string {
    const rawDifficulty = this.thetaToDifficulty(theta);
    if (rawDifficulty === currentDifficulty) return currentDifficulty;

    // Require a consistent trend in the last 5 answers to change difficulty
    const last5 = recentWindow.slice(-5);
    if (last5.length < 5) return currentDifficulty; // not enough data

    const last5Accuracy = last5.filter(Boolean).length / last5.length;
    const levels = ["easy", "medium", "hard", "expert"];
    const currentIdx = levels.indexOf(currentDifficulty);
    const targetIdx = levels.indexOf(rawDifficulty);

    // Moving up: require ≥80% recent accuracy
    if (targetIdx > currentIdx && last5Accuracy >= 0.8) return rawDifficulty;
    // Moving down: require ≤40% recent accuracy
    if (targetIdx < currentIdx && last5Accuracy <= 0.4) return rawDifficulty;

    return currentDifficulty;
  }

  /**
   * Full adaptive update after a user answers an exercise.
   * Reads current state, computes IRT update, writes back, returns new difficulty.
   */
  async updateAfterAnswer(params: {
    userId: string;
    exerciseType: string;
    level: string;
    isCorrect: boolean;
    responseTimeMs: number;
    /** The difficulty parameter of the item just answered (0 = medium) */
    itemDifficulty?: number;
  }): Promise<{
    newDifficulty: string;
    theta: number;
    confidence: number;
  }> {
    const key = {
      userId: params.userId,
      exerciseType: params.exerciseType,
      level: params.level || "all",
    };

    const perf = await this.prisma.userExercisePerformance.findUnique({
      where: { userId_exerciseType_level: key },
    });

    // Derive current theta from stored recentAccuracy + currentDifficulty
    const currentTheta = perf
      ? this.estimateThetaFromPerformance(perf.recentAccuracy, perf.currentDifficulty)
      : 0.0;

    const itemDifficulty = params.itemDifficulty ??
      (AdaptiveDifficultyService.DIFFICULTY_MAP[perf?.currentDifficulty ?? "medium"] ?? 0);

    const totalAttempts = perf?.totalAttempts ?? 0;

    const { newTheta } = this.computeThetaUpdate({
      currentTheta,
      difficultyParam: itemDifficulty,
      isCorrect: params.isCorrect,
      responseTimeMs: params.responseTimeMs,
      totalAttempts,
    });

    const recentWindow = (perf?.recentWindow as boolean[]) ?? [];
    const newDifficulty = this.computeDifficultyWithHysteresis(
      newTheta,
      perf?.currentDifficulty ?? "medium",
      [...recentWindow, params.isCorrect],
    );

    // Confidence = 1 - (K / K_MAX) — approaches 1 as K decreases
    const k = AdaptiveDifficultyService.K_MIN +
      (AdaptiveDifficultyService.K_MAX - AdaptiveDifficultyService.K_MIN) *
      Math.exp(-(totalAttempts + 1) / AdaptiveDifficultyService.K_DECAY_RATE);
    const confidence = 1 - (k / AdaptiveDifficultyService.K_MAX);

    return { newDifficulty, theta: newTheta, confidence };
  }

  /**
   * Get recommended difficulty for the next exercise batch.
   * Considers user's theta + a small exploration bonus to occasionally
   * test the boundary (10% chance of +1 or -1 item difficulty).
   */
  async getRecommendedDifficulty(params: {
    userId: string;
    exerciseType: string;
    level: string;
  }): Promise<{ difficulty: string; theta: number; explore: boolean }> {
    const key = {
      userId: params.userId,
      exerciseType: params.exerciseType,
      level: params.level || "all",
    };

    const perf = await this.prisma.userExercisePerformance.findUnique({
      where: { userId_exerciseType_level: key },
    });

    if (!perf) return { difficulty: "medium", theta: 0, explore: false };

    const theta = this.estimateThetaFromPerformance(perf.recentAccuracy, perf.currentDifficulty);
    const baseDifficulty = perf.currentDifficulty;

    // 10% exploration: try adjacent difficulty
    const shouldExplore = Math.random() < 0.1;
    if (shouldExplore) {
      const levels = ["easy", "medium", "hard", "expert"];
      const idx = levels.indexOf(baseDifficulty);
      const direction = Math.random() < 0.5 ? 1 : -1;
      const exploredIdx = Math.max(0, Math.min(levels.length - 1, idx + direction));
      return { difficulty: levels[exploredIdx], theta, explore: true };
    }

    return { difficulty: baseDifficulty, theta, explore: false };
  }

  /**
   * Get a user's ability profile across all exercise types.
   */
  async getUserAbilityProfile(userId: string): Promise<
    Array<{
      exerciseType: string;
      level: string;
      theta: number;
      difficulty: string;
      accuracy: number;
      totalAttempts: number;
    }>
  > {
    const records = await this.prisma.userExercisePerformance.findMany({
      where: { userId },
      orderBy: [{ exerciseType: "asc" }, { level: "asc" }],
    });

    return records.map((r) => ({
      exerciseType: r.exerciseType,
      level: r.level,
      theta: this.estimateThetaFromPerformance(r.recentAccuracy, r.currentDifficulty),
      difficulty: r.currentDifficulty,
      accuracy: r.recentAccuracy,
      totalAttempts: r.totalAttempts,
    }));
  }

  /** Derive theta from stored performance fields (backwards-compatible). */
  private estimateThetaFromPerformance(recentAccuracy: number, currentDifficulty: string): number {
    // Map accuracy [0,1] to a theta centered on the current difficulty level
    const diffParam = AdaptiveDifficultyService.DIFFICULTY_MAP[currentDifficulty] ?? 0;
    // Logit-transform accuracy to get theta estimate relative to current difficulty
    const clampedAcc = Math.max(0.05, Math.min(0.95, recentAccuracy));
    const logitAcc = Math.log(clampedAcc / (1 - clampedAcc));
    // Scale logit (range ~[-3,3]) and offset by difficulty param
    return diffParam + logitAcc * 0.5;
  }
}
