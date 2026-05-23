import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { QuizController } from "./quiz.controller.js";

describe("QuizController quota enforcement", () => {
  it("blocks quiz start when quiz start quota is exhausted", async () => {
    const quizRepository = { startSession: vi.fn() };
    const quizService = {
      startSessionWithQuota: vi
        .fn()
        .mockRejectedValue(new HttpException({ code: "QUOTA_EXCEEDED" }, 403))
    };
    const controller = new QuizController(quizRepository as any, quizService as any, {} as any);

    await expect(
      controller.start(undefined, {
        testId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222"
      })
    ).rejects.toBeInstanceOf(HttpException);
    expect(quizRepository.startSession).not.toHaveBeenCalled();
    expect(quizService.startSessionWithQuota).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    );
  });
});
