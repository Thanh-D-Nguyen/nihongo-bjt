import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

const userId = "22222222-2222-4222-8222-222222222222";
const deckId = "33333333-3333-4333-8333-333333333333";
const cardId = "44444444-4444-4444-8444-444444444444";
const lexemeId = "55555555-5555-4555-8555-555555555555";

const txMock = {
  deck: {
    create: vi.fn()
  },
  deckCard: {
    create: vi.fn()
  },
  flashcardVariant: {
    create: vi.fn()
  },
  userFlashcard: {
    create: vi.fn()
  }
};

const prismaMock = {
  $transaction: vi.fn(),
  flashcardGenJob: {
    create: vi.fn()
  },
  lexeme: {
    findMany: vi.fn()
  },
  userFlashcard: {
    findMany: vi.fn()
  }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { FlashcardGenService } from "./flashcard-gen.service.js";
import { EntitlementService } from "../monetization/entitlement.service.js";
import { QuotaService } from "../monetization/quota.service.js";

describe("FlashcardGenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.userFlashcard.findMany.mockResolvedValue([]);
    prismaMock.lexeme.findMany.mockResolvedValue([
      {
        headword: "kaigi",
        id: lexemeId,
        reading: "kaigi",
        senses: [{ meaningVi: "meeting" }],
        shortMeaningVi: null
      }
    ]);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) =>
      cb(txMock)
    );
    txMock.deck.create.mockResolvedValue({ id: deckId });
    txMock.flashcardVariant.create.mockResolvedValue({ id: cardId });
  });

  it("records learner generation params without undefined JSON fields", async () => {
    const quota = { consumeFlashcardGen: vi.fn().mockResolvedValue(undefined) };
    const entitlement = { has: vi.fn() };
    const service = new FlashcardGenService(quota as any, entitlement as any);

    await expect(
      service.generateForLearner({
        adaptive: false,
        cardCount: 5,
        direction: "jp_to_vn",
        level: "J5",
        sourceTypes: ["lexeme"],
        userId
      })
    ).resolves.toMatchObject({
      cardCount: 1,
      id: deckId
    });

    expect(prismaMock.flashcardGenJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardsGenerated: 1,
        deckId,
        mode: "by_level",
        params: {
          adaptive: false,
          direction: "jp_to_vn",
          level: "J5",
          sourceTypes: ["lexeme"]
        },
        status: "completed",
        userId
      })
    });
  });

  it("declares Nest injection tokens for monetization dependencies", () => {
    const deps = Reflect.getMetadata("self:paramtypes", FlashcardGenService) as
      | Array<{ index: number; param: unknown }>
      | undefined;

    expect(deps).toEqual(
      expect.arrayContaining([
        { index: 0, param: QuotaService },
        { index: 1, param: EntitlementService }
      ])
    );
  });
});
