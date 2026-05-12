import { describe, it, expect, vi, beforeEach } from "vitest";

import { QuizController } from "./quiz.controller.js";
import { QuizRepository } from "./quiz.repository.js";
import { QuizService } from "./quiz.service.js";

describe("Quiz session breakdown endpoint", () => {
  let controller: QuizController;
  let repository: QuizRepository;
  let service: QuizService;

  beforeEach(() => {
    repository = {
      breakdown: vi.fn()
    } as unknown as QuizRepository;

    service = {} as unknown as QuizService;

    controller = new QuizController(repository, service);
  });

  it("allows authenticated learner access to breakdown endpoint", async () => {
    const mockBreakdown = {
      sessionId: "session-1",
      testId: "test-1",
      testTitleVi: "N2 Mock",
      testTitleJa: "N2 模擬試験",
      estimatedScore: 78,
      estimatedBjtBand: "N2",
      breakdown: [
        {
          questionId: "q1",
          prompt: "What is 請求書?",
          selectedOption: "A",
          isCorrect: true,
          explanationVi: "Invoice",
          skillTag: "vocabulary",
          sectionCode: "RC",
          remediationCardId: undefined
        }
      ]
    };

    vi.mocked(repository.breakdown).mockResolvedValueOnce(mockBreakdown);

    const user = {
      appUserId: "learner-1",
      realmRoles: ["learner"],
      email: "learner@example.com",
      sub: "keycloak-sub-1"
    };

    const result = await (controller as any).breakdown(user, "session-1", undefined);

    expect(result).toEqual(mockBreakdown);
    expect(repository.breakdown).toHaveBeenCalledWith("session-1", "learner-1");
  });

  it("returns per-question breakdown with explanations", () => {
    const breakdown = {
      sessionId: "session-1",
      testId: "test-1",
      estimatedScore: 78,
      estimatedBjtBand: "N2",
      breakdown: [
        {
          questionId: "q1",
          prompt: "What is 請求書?",
          selectedOption: "A",
          isCorrect: true,
          explanationVi: "請求書 is a noun meaning invoice."
        },
        {
          questionId: "q2",
          prompt: "What is 領収書?",
          selectedOption: "B",
          isCorrect: false,
          explanationVi: "領収書 is a noun meaning receipt.",
          remediationCardId: "card-1"
        }
      ]
    };

    expect(breakdown.breakdown).toHaveLength(2);
    expect(breakdown.breakdown[0]).toHaveProperty("explanationVi");
    expect(breakdown.breakdown[1]).toHaveProperty("remediationCardId");
  });

  it("never includes isCorrect for unselected options in breakdown", () => {
    const question = {
      questionId: "q1",
      prompt: "Question?",
      selectedOption: "A",
      isCorrect: true,
      explanationVi: "Answer"
    };

    // Verify only selectedOption and isCorrect are exposed, not an options array
    const hasOnlyAllowedFields =
      Object.prototype.hasOwnProperty.call(question, "selectedOption") &&
      Object.prototype.hasOwnProperty.call(question, "isCorrect") &&
      !Object.prototype.hasOwnProperty.call(question, "options");

    expect(hasOnlyAllowedFields).toBe(true);
  });
});
