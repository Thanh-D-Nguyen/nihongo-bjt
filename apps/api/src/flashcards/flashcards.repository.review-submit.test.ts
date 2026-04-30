import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

const prismaMock = {
  reviewEvent: {
    create: vi.fn()
  },
  userFlashcard: {
    findFirst: vi.fn(),
    update: vi.fn()
  }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { FlashcardsRepository } from "./flashcards.repository.js";

describe("FlashcardsRepository applySubmitReview", () => {
  it("returns persisted review outcome with remediation linkage", async () => {
    const repo = new FlashcardsRepository();
    const tx = {
      reviewEvent: {
        create: vi.fn().mockResolvedValue({
          id: "77777777-7777-4777-8777-777777777777",
          nextDueAt: new Date("2026-04-30T00:00:00.000Z"),
          previousDueAt: new Date("2026-04-29T00:00:00.000Z"),
          rating: "good",
          reviewedAt: new Date("2026-04-29T01:00:00.000Z")
        })
      },
      userFlashcard: {
        findFirst: vi.fn().mockResolvedValue({
          card: {
            sourceId: "44444444-4444-4444-8444-444444444444",
            sourceType: "lexeme"
          },
          dueAt: new Date("2026-04-29T00:00:00.000Z"),
          easeFactor: 2.5,
          id: "66666666-6666-4666-8666-666666666666",
          intervalDays: 0,
          lapses: 0,
          repetitions: 0,
          state: "new",
          userId: "11111111-1111-4111-8111-111111111111"
        }),
        update: vi.fn().mockResolvedValue({
          cardId: "22222222-2222-4222-8222-222222222222",
          comebackMode: false,
          dueAt: new Date("2026-04-30T00:00:00.000Z"),
          easeFactor: 2.5,
          id: "66666666-6666-4666-8666-666666666666",
          intervalDays: 1,
          lapses: 0,
          repetitions: 1,
          state: "review"
        })
      }
    };

    const result = await repo.applySubmitReview(tx as any, {
      rating: "good",
      reviewedAt: new Date("2026-04-29T01:00:00.000Z"),
      userFlashcardId: "66666666-6666-4666-8666-666666666666",
      userId: "11111111-1111-4111-8111-111111111111"
    });

    expect(result).toMatchObject({
      cardId: "22222222-2222-4222-8222-222222222222",
      remediation: {
        sourceId: "44444444-4444-4444-8444-444444444444",
        sourceIdKind: "canonical_id",
        sourceType: "lexeme"
      },
      comebackMode: false,
      remediationPolicy: {
        availability: "after_answer"
      },
      reviewEventId: "77777777-7777-4777-8777-777777777777",
      state: "review",
      userFlashcardId: "66666666-6666-4666-8666-666666666666"
    });
    expect(tx.reviewEvent.create).toHaveBeenCalledTimes(1);
  });

  it("throws not found when user flashcard does not belong to learner", async () => {
    const repo = new FlashcardsRepository();
    const tx = {
      userFlashcard: {
        findFirst: vi.fn().mockResolvedValue(null)
      }
    };

    await expect(
      repo.applySubmitReview(tx as any, {
        rating: "good",
        reviewedAt: new Date("2026-04-29T01:00:00.000Z"),
        userFlashcardId: "66666666-6666-4666-8666-666666666666",
        userId: "11111111-1111-4111-8111-111111111111"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
