import { beforeEach, describe, expect, it, vi } from "vitest";

const deckId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const lexemeId = "33333333-3333-4333-8333-333333333333";
const grammarId = "44444444-4444-4444-8444-444444444444";
const kanjiId = "55555555-5555-4555-8555-555555555555";

const prismaMock = {
  deck: {
    findFirstOrThrow: vi.fn()
  },
  exampleSentence: {
    findMany: vi.fn()
  },
  flashcardVariant: {
    findMany: vi.fn()
  },
  grammarPoint: {
    findFirst: vi.fn()
  },
  kanjiExample: {
    findMany: vi.fn()
  },
  kanji: {
    findFirst: vi.fn()
  },
  lexeme: {
    findFirst: vi.fn()
  }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { FlashcardsRepository } from "./flashcards.repository.js";

describe("FlashcardsRepository deckDetail examples", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.flashcardVariant.findMany.mockResolvedValue([]);
    prismaMock.lexeme.findFirst.mockResolvedValue(null);
    prismaMock.grammarPoint.findFirst.mockResolvedValue(null);
    prismaMock.kanji.findFirst.mockResolvedValue(null);
    prismaMock.kanjiExample.findMany.mockResolvedValue([]);
  });

  it("attaches examples from source-specific content tables", async () => {
    prismaMock.deck.findFirstOrThrow.mockResolvedValue({
      cards: [
        {
          cardId: "card-lexeme",
          card: {
            backText: "meeting",
            frontText: "会議",
            id: "card-lexeme",
            mediaLinks: [],
            reading: "かいぎ",
            sourceId: lexemeId,
            sourceType: "lexeme"
          },
          deckId,
          id: "deck-card-1",
          position: 0
        },
        {
          cardId: "card-grammar",
          card: {
            backText: "while doing",
            frontText: "ながら",
            id: "card-grammar",
            mediaLinks: [],
            reading: null,
            sourceId: grammarId,
            sourceType: "grammar"
          },
          deckId,
          id: "deck-card-2",
          position: 1
        },
        {
          cardId: "card-kanji",
          card: {
            backText: "meeting",
            frontText: "会",
            id: "card-kanji",
            mediaLinks: [],
            reading: null,
            sourceId: kanjiId,
            sourceType: "kanji"
          },
          deckId,
          id: "deck-card-3",
          position: 2
        }
      ],
      id: deckId,
      ownerUserId: userId,
      status: "active",
      titleVi: "Deck",
      visibility: "private"
    });
    prismaMock.exampleSentence.findMany
      .mockResolvedValueOnce([
        {
          grammarDetailExamples: [],
          id: "ex-lexeme",
          japaneseText: "会議は三時です。",
          lexemeSenseExamples: [{ sense: { lexemeId } }],
          reading: "かいぎはさんじです。",
          translationVi: "Cuộc họp lúc 3 giờ."
        }
      ])
      .mockResolvedValueOnce([
        {
          grammarDetailExamples: [{ detail: { grammarPointId: grammarId } }],
          id: "ex-grammar",
          japaneseText: "音楽を聞きながら勉強します。",
          lexemeSenseExamples: [],
          reading: "おんがくをききながらべんきょうします。",
          translationVi: "Tôi vừa nghe nhạc vừa học."
        }
      ]);
    prismaMock.kanjiExample.findMany.mockResolvedValue([
      {
        id: "ex-kanji",
        kanjiId,
        meaningVi: "hội nghị",
        reading: "かいぎ",
        word: "会議"
      }
    ]);

    const repo = new FlashcardsRepository();
    const detail = await repo.deckDetail(userId, deckId);

    expect(detail.cards[0]?.card.examples).toEqual([
      {
        id: "ex-lexeme",
        japaneseText: "会議は三時です。",
        reading: "かいぎはさんじです。",
        sourceKind: "lexeme",
        translationVi: "Cuộc họp lúc 3 giờ."
      }
    ]);
    expect(detail.cards[1]?.card.examples?.[0]).toMatchObject({ id: "ex-grammar", sourceKind: "grammar" });
    expect(detail.cards[2]?.card.examples?.[0]).toMatchObject({ id: "ex-kanji", sourceKind: "kanji" });
  });

  it("resolves non-canonical NHK flashcard variants by front text before loading examples", async () => {
    prismaMock.deck.findFirstOrThrow.mockResolvedValue({
      cards: [
        {
          cardId: "card-nhk",
          card: {
            backText: "prime minister",
            frontText: "総理大臣",
            id: "card-nhk",
            mediaLinks: [],
            reading: "そうりだいじん",
            sourceId: deckId,
            sourceType: "nhk_vocabulary"
          },
          deckId,
          id: "deck-card-nhk",
          position: 0
        }
      ],
      id: deckId,
      ownerUserId: userId,
      status: "active",
      titleVi: "NHK Deck",
      visibility: "private"
    });
    prismaMock.flashcardVariant.findMany.mockResolvedValue([{ frontText: "総理大臣", id: "card-nhk" }]);
    prismaMock.lexeme.findFirst.mockResolvedValue({ id: lexemeId });
    prismaMock.exampleSentence.findMany.mockResolvedValueOnce([
      {
        grammarDetailExamples: [],
        id: "ex-nhk-lexeme",
        japaneseText: "総理大臣が会見しました。",
        lexemeSenseExamples: [{ sense: { lexemeId } }],
        reading: "そうりだいじんがかいけんしました。",
        translationVi: "Thủ tướng đã họp báo."
      }
    ]);

    const repo = new FlashcardsRepository();
    const detail = await repo.deckDetail(userId, deckId);

    expect(prismaMock.lexeme.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ headword: "総理大臣" }, { reading: "総理大臣" }]
        })
      })
    );
    expect(detail.cards[0]?.card.examples).toEqual([
      {
        id: "ex-nhk-lexeme",
        japaneseText: "総理大臣が会見しました。",
        reading: "そうりだいじんがかいけんしました。",
        sourceKind: "lexeme",
        translationVi: "Thủ tướng đã họp báo."
      }
    ]);
  });
});
