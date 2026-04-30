import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  exampleSentence: {
    findMany: vi.fn()
  },
  grammarPoint: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  kanji: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  lexeme: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  lexemeReverseProjection: {
    findMany: vi.fn()
  }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { ContentRepository } from "./content.repository.js";

describe("ContentRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries dictionary browse/search with bilingual filters and bounded senses", async () => {
    prismaMock.lexeme.findMany.mockResolvedValue([{ id: "lex-1" }]);
    const repository = new ContentRepository();

    await expect(repository.lexemes("họp", 5)).resolves.toEqual([{ id: "lex-1" }]);
    expect(prismaMock.lexeme.findMany).toHaveBeenCalledWith({
      include: {
        senses: {
          orderBy: { position: "asc" },
          take: 3
        }
      },
      orderBy: [{ jlptLevel: "asc" }, { headword: "asc" }],
      take: 5,
      where: {
        OR: [
          { headword: { contains: "họp", mode: "insensitive" } },
          { reading: { contains: "họp", mode: "insensitive" } },
          { shortMeaningVi: { contains: "họp", mode: "insensitive" } },
          { senses: { some: { meaningVi: { contains: "họp", mode: "insensitive" } } } }
        ],
        status: "active"
      }
    });
  });

  it("hydrates dictionary detail with nested example sentences and throws on missing rows", async () => {
    prismaMock.lexeme.findFirst.mockResolvedValueOnce({
      headword: "会議",
      id: "lex-1",
      senses: [
        {
          exampleLinks: [
            {
              exampleSentence: {
                id: "ex-1",
                japaneseText: "会議を始めます。",
                translationVi: "Bắt đầu cuộc họp."
              }
            }
          ],
          meaningVi: "họp",
          position: 1
        }
      ]
    });
    prismaMock.lexeme.findFirst.mockResolvedValueOnce(null);
    const repository = new ContentRepository();

    await expect(repository.lexemeDetail("lex-1")).resolves.toMatchObject({
      headword: "会議",
      senses: [
        {
          exampleLinks: [
            {
              exampleSentence: {
                japaneseText: "会議を始めます。",
                translationVi: "Bắt đầu cuộc họp."
              }
            }
          ],
          meaningVi: "họp"
        }
      ]
    });
    expect(prismaMock.lexeme.findFirst).toHaveBeenNthCalledWith(1, {
      include: {
        senses: {
          include: {
            exampleLinks: { include: { exampleSentence: true }, take: 8 }
          },
          orderBy: { position: "asc" }
        }
      },
      where: { id: "lex-1", status: "active" }
    });

    await expect(repository.lexemeDetail("missing")).rejects.toThrow(NotFoundException);
  });

  it("queries kanji and grammar with nested learning detail includes", async () => {
    prismaMock.kanji.findMany.mockResolvedValue([{ id: "kanji-1" }]);
    prismaMock.grammarPoint.findMany.mockResolvedValue([{ id: "grammar-1" }]);
    const repository = new ContentRepository();

    await expect(repository.kanji("会", 2)).resolves.toEqual([{ id: "kanji-1" }]);
    expect(prismaMock.kanji.findMany).toHaveBeenCalledWith({
      include: {
        components: { orderBy: { position: "asc" }, take: 8 },
        examples: { orderBy: { position: "asc" }, take: 6 }
      },
      orderBy: [{ level: "asc" }, { frequency: "asc" }],
      take: 2,
      where: {
        OR: [
          { character: { contains: "会", mode: "insensitive" } },
          { meaningVi: { contains: "会", mode: "insensitive" } },
          { onyomi: { contains: "会", mode: "insensitive" } },
          { kunyomi: { contains: "会", mode: "insensitive" } },
          { examples: { some: { word: { contains: "会", mode: "insensitive" } } } }
        ],
        status: "active"
      }
    });

    await expect(repository.grammar("N3", 4)).resolves.toEqual([{ id: "grammar-1" }]);
    expect(prismaMock.grammarPoint.findMany).toHaveBeenCalledWith({
      include: {
        details: {
          orderBy: { position: "asc" },
          take: 2
        }
      },
      orderBy: [{ jlptLevel: "asc" }, { pattern: "asc" }],
      take: 4,
      where: {
        OR: [
          { pattern: { contains: "N3", mode: "insensitive" } },
          { meaningVi: { contains: "N3", mode: "insensitive" } },
          { jlptLevel: { contains: "N3", mode: "insensitive" } },
          { details: { some: { explanation: { contains: "N3", mode: "insensitive" } } } }
        ],
        status: "active"
      }
    });
  });

  it("hydrates kanji and grammar detail queries and preserves not-found behavior", async () => {
    prismaMock.kanji.findFirst.mockResolvedValueOnce({
      character: "会",
      components: [{ component: "人", position: 1 }],
      examples: [{ position: 1, word: "会話" }],
      id: "kanji-1"
    });
    prismaMock.kanji.findFirst.mockResolvedValueOnce(null);
    prismaMock.grammarPoint.findFirst.mockResolvedValueOnce({
      details: [{ explanation: "Diễn tả trải nghiệm", position: 1 }],
      id: "grammar-1",
      pattern: "〜たことがある"
    });
    prismaMock.grammarPoint.findFirst.mockResolvedValueOnce(null);
    const repository = new ContentRepository();

    await expect(repository.kanjiDetail("kanji-1")).resolves.toMatchObject({
      character: "会",
      components: [{ component: "人" }],
      examples: [{ word: "会話" }]
    });
    expect(prismaMock.kanji.findFirst).toHaveBeenNthCalledWith(1, {
      include: {
        components: { orderBy: { position: "asc" } },
        examples: { orderBy: { position: "asc" } }
      },
      where: { id: "kanji-1", status: "active" }
    });
    await expect(repository.kanjiDetail("missing-kanji")).rejects.toThrow(NotFoundException);

    await expect(repository.grammarDetail("grammar-1")).resolves.toMatchObject({
      details: [{ explanation: "Diễn tả trải nghiệm" }],
      pattern: "〜たことがある"
    });
    expect(prismaMock.grammarPoint.findFirst).toHaveBeenNthCalledWith(1, {
      include: { details: { orderBy: { position: "asc" } } },
      where: { id: "grammar-1", status: "active" }
    });
    await expect(repository.grammarDetail("missing-grammar")).rejects.toThrow(NotFoundException);
  });

  it("queries examples and examples-by-word with active filters and bounded limits", async () => {
    prismaMock.exampleSentence.findMany.mockResolvedValueOnce([{ id: "ex-1" }]);
    prismaMock.exampleSentence.findMany.mockResolvedValueOnce([{ id: "ex-2" }]);
    const repository = new ContentRepository();

    await expect(repository.examples("会議", 3)).resolves.toEqual([{ id: "ex-1" }]);
    expect(prismaMock.exampleSentence.findMany).toHaveBeenNthCalledWith(1, {
      orderBy: { japaneseText: "asc" },
      take: 3,
      where: {
        OR: [
          { japaneseText: { contains: "会議", mode: "insensitive" } },
          { reading: { contains: "会議", mode: "insensitive" } },
          { translationVi: { contains: "会議", mode: "insensitive" } }
        ],
        status: "active"
      }
    });

    await expect(repository.examplesByWord("lex-1", 6)).resolves.toEqual([{ id: "ex-2" }]);
    expect(prismaMock.exampleSentence.findMany).toHaveBeenNthCalledWith(2, {
      orderBy: { japaneseText: "asc" },
      take: 6,
      where: {
        lexemeSenseExamples: { some: { sense: { lexemeId: "lex-1" } } },
        status: "active"
      }
    });
  });

  it("queries reverse projection with Vietnamese headword and nested candidate examples", async () => {
    prismaMock.lexemeReverseProjection.findMany.mockResolvedValue([{ id: "rev-1" }]);
    const repository = new ContentRepository();

    await expect(repository.reverseSearch("họp", 6)).resolves.toEqual([{ id: "rev-1" }]);
    expect(prismaMock.lexemeReverseProjection.findMany).toHaveBeenCalledWith({
      include: {
        candidates: {
          include: {
            exampleLinks: { include: { exampleSentence: true } }
          },
          take: 8
        }
      },
      orderBy: { vietnameseHeadword: "asc" },
      take: 6,
      where: {
        OR: [
          { vietnameseHeadword: { contains: "họp", mode: "insensitive" } },
          { candidates: { some: { japaneseText: { contains: "họp", mode: "insensitive" } } } }
        ],
        status: "active"
      }
    });
  });
});