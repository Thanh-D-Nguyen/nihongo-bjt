import { describe, expect, it, vi } from "vitest";

const prismaMock = {
  reviewEvent: {
    findMany: vi.fn()
  },
  userFlashcard: {
    count: vi.fn()
  }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { FlashcardsRepository } from "./flashcards.repository.js";

describe("FlashcardsRepository comebackSummary", () => {
  it("returns persisted comeback evidence and recent events", async () => {
    prismaMock.userFlashcard.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prismaMock.reviewEvent.findMany.mockResolvedValue([
      {
        nextDueAt: new Date("2026-04-30T00:00:00.000Z"),
        rating: "good",
        reviewedAt: new Date("2026-04-29T00:00:00.000Z"),
        userFlashcard: {
          card: {
            frontText: "会議の資料",
            id: "33333333-3333-4333-8333-333333333333",
            sourceType: "lexeme"
          },
          cardId: "33333333-3333-4333-8333-333333333333"
        },
        userFlashcardId: "11111111-1111-4111-8111-111111111111"
      }
    ]);

    const repo = new FlashcardsRepository();
    const result = await repo.comebackSummary("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", 14);

    expect(result).toMatchObject({
      activeComebackCards: 4,
      dueComebackCards: 2,
      leechedCards: 1,
      range: {
        days: 14
      },
      recentComebackReviews: [
        {
          cardId: "33333333-3333-4333-8333-333333333333",
          cardPreview: "会議の資料",
          rating: "good",
          sourceType: "lexeme",
          userFlashcardId: "11111111-1111-4111-8111-111111111111"
        }
      ]
    });

    expect(prismaMock.userFlashcard.count).toHaveBeenCalledTimes(3);
    expect(prismaMock.reviewEvent.findMany).toHaveBeenCalledTimes(1);
  });
});
