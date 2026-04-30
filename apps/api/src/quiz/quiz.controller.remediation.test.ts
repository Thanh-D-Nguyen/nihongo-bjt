import { describe, expect, it, vi } from "vitest";

import { QuizController } from "./quiz.controller.js";

describe("QuizController remediation endpoint", () => {
  it("forwards remediation lookup to repository with resolved learner user id", async () => {
    const quizRepository = {
      remediation: vi.fn().mockResolvedValue([])
    };
    const quizService = {
      startSessionWithQuota: vi.fn()
    };
    const controller = new QuizController(quizRepository as any, quizService as any);

    await controller.remediation(
      undefined,
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    );

    expect(quizRepository.remediation).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    );
  });
});
