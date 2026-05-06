import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

const prismaMock = {
  deck: {
    findFirst: vi.fn(),
    update: vi.fn()
  },
  deckCard: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn()
  },
  userFlashcard: {
    deleteMany: vi.fn()
  },
  analyticsEvent: {
    create: vi.fn()
  },
  $transaction: vi.fn()
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { FlashcardsRepository } from "./flashcards.repository.js";

describe("FlashcardsRepository archiveOwnedDeckForLearner", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const deckId = "22222222-2222-4222-8222-222222222222";
  const cardId = "33333333-3333-4333-8333-333333333333";

  it("throws NotFound when deck is missing or not owned", async () => {
    prismaMock.deck.findFirst.mockResolvedValue(null);
    const repo = new FlashcardsRepository();
    await expect(repo.archiveOwnedDeckForLearner(userId, deckId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("archives deck, removes links, prunes orphan user flashcards, emits analytics", async () => {
    prismaMock.deck.findFirst.mockResolvedValue({
      id: deckId,
      ownerUserId: userId,
      status: "active"
    });

    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );

    prismaMock.deckCard.findMany.mockResolvedValue([{ cardId }, { cardId }]);
    prismaMock.deckCard.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.deck.update.mockResolvedValue({ id: deckId, status: "archived" });
    prismaMock.deckCard.count.mockResolvedValue(0);
    prismaMock.userFlashcard.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.analyticsEvent.create.mockResolvedValue({ id: "ev" });

    const repo = new FlashcardsRepository();
    const result = await repo.archiveOwnedDeckForLearner(userId, deckId);

    expect(result).toEqual({
      deckId,
      deletedUserFlashcardCount: 1,
      policy: "archive_owned_deck_prune_srs",
      removedDeckCardCount: 2,
      status: "archived"
    });
    expect(prismaMock.deck.update).toHaveBeenCalledWith({
      data: { status: "archived" },
      where: { id: deckId }
    });
    expect(prismaMock.analyticsEvent.create).toHaveBeenCalled();
  });
});
