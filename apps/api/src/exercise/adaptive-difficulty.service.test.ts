import { describe, expect, it } from "vitest";

import { AdaptiveDifficultyService } from "./adaptive-difficulty.service.js";

describe("AdaptiveDifficultyService", () => {
  const svc = new AdaptiveDifficultyService();

  describe("computeThetaUpdate", () => {
    it("increases theta on correct answer", () => {
      const result = svc.computeThetaUpdate({
        currentTheta: 0,
        difficultyParam: 0,
        isCorrect: true,
        responseTimeMs: 10000,
        totalAttempts: 5,
      });
      expect(result.newTheta).toBeGreaterThan(0);
      expect(result.expectedP).toBeCloseTo(0.5, 1);
    });

    it("decreases theta on incorrect answer", () => {
      const result = svc.computeThetaUpdate({
        currentTheta: 0,
        difficultyParam: 0,
        isCorrect: false,
        responseTimeMs: 10000,
        totalAttempts: 5,
      });
      expect(result.newTheta).toBeLessThan(0);
    });

    it("K factor decreases with more attempts (smaller updates)", () => {
      const early = svc.computeThetaUpdate({
        currentTheta: 0,
        difficultyParam: 0,
        isCorrect: true,
        responseTimeMs: 10000,
        totalAttempts: 2,
      });
      const late = svc.computeThetaUpdate({
        currentTheta: 0,
        difficultyParam: 0,
        isCorrect: true,
        responseTimeMs: 10000,
        totalAttempts: 200,
      });
      expect(Math.abs(early.newTheta)).toBeGreaterThan(Math.abs(late.newTheta));
    });

    it("clamps theta to [-3, 3]", () => {
      const result = svc.computeThetaUpdate({
        currentTheta: 2.95,
        difficultyParam: -2,
        isCorrect: true,
        responseTimeMs: 5000,
        totalAttempts: 2,
      });
      expect(result.newTheta).toBeLessThanOrEqual(3);
    });

    it("gives time bonus for fast correct answers", () => {
      const fast = svc.computeThetaUpdate({
        currentTheta: 0,
        difficultyParam: 0,
        isCorrect: true,
        responseTimeMs: 3000,
        totalAttempts: 20,
      });
      const slow = svc.computeThetaUpdate({
        currentTheta: 0,
        difficultyParam: 0,
        isCorrect: true,
        responseTimeMs: 20000,
        totalAttempts: 20,
      });
      expect(fast.newTheta).toBeGreaterThan(slow.newTheta);
    });
  });

  describe("thetaToDifficulty", () => {
    it("maps theta ranges to difficulty labels", () => {
      expect(svc.thetaToDifficulty(-1.5)).toBe("easy");
      expect(svc.thetaToDifficulty(0)).toBe("medium");
      expect(svc.thetaToDifficulty(1.0)).toBe("hard");
      expect(svc.thetaToDifficulty(2.5)).toBe("expert");
    });
  });

  describe("computeDifficultyWithHysteresis", () => {
    it("requires consistent recent performance to increase difficulty", () => {
      const window = [true, true, true, true, true]; // 100% last 5
      const result = svc.computeDifficultyWithHysteresis(0.7, "medium", window);
      expect(result).toBe("hard");
    });

    it("blocks difficulty increase when recent performance is mixed", () => {
      const window = [true, false, true, true, false]; // 60% last 5
      const result = svc.computeDifficultyWithHysteresis(0.7, "medium", window);
      expect(result).toBe("medium");
    });

    it("decreases difficulty when recent performance is poor", () => {
      const window = [false, false, true, false, false]; // 20% last 5
      const result = svc.computeDifficultyWithHysteresis(-0.7, "medium", window);
      expect(result).toBe("easy");
    });

    it("requires at least 5 data points before changing", () => {
      const window = [true, true, true]; // only 3
      const result = svc.computeDifficultyWithHysteresis(0.7, "medium", window);
      expect(result).toBe("medium");
    });
  });
});
