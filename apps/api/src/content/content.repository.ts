import { createPrismaClient } from "@nihongo-bjt/database";
import type { ContentSummary } from "@nihongo-bjt/shared";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class ContentRepository {
  private readonly prisma = createPrismaClient();

  async summary(): Promise<ContentSummary> {
    const [lexemes, kanji, grammarPoints, examples] = await this.prisma.$transaction([
      this.prisma.lexeme.count({ where: { status: "active" } }),
      this.prisma.kanji.count({ where: { status: "active" } }),
      this.prisma.grammarPoint.count({ where: { status: "active" } }),
      this.prisma.exampleSentence.count({ where: { status: "active" } })
    ]);

    return { examples, grammarPoints, kanji, lexemes };
  }

  /**
   * Dictionary browse/search: `lexeme` headword/reading/short sense plus **up to 3** `sense` rows ordered by
   * `position` (Meilisearch / admin CMS may hold richer data; this path is a DB slice for the learner API).
   */
  async lexemes(q: string | undefined, limit: number) {
    return this.prisma.lexeme.findMany({
      include: {
        senses: {
          orderBy: { position: "asc" },
          take: 3
        }
      },
      orderBy: [{ jlptLevel: "asc" }, { headword: "asc" }],
      take: limit,
      where: {
        status: "active",
        ...(q
          ? {
              OR: [
                { headword: { contains: q, mode: "insensitive" as const } },
                { reading: { contains: q, mode: "insensitive" as const } },
                { shortMeaningVi: { contains: q, mode: "insensitive" as const } },
                { senses: { some: { meaningVi: { contains: q, mode: "insensitive" as const } } } }
              ]
            }
          : {})
      }
    });
  }

  async kanji(q: string | undefined, limit: number) {
    return this.prisma.kanji.findMany({
      include: {
        components: { orderBy: { position: "asc" }, take: 8 },
        examples: { orderBy: { position: "asc" }, take: 6 }
      },
      orderBy: [{ level: "asc" }, { frequency: "asc" }],
      take: limit,
      where: {
        status: "active",
        ...(q
          ? {
              OR: [
                { character: { contains: q, mode: "insensitive" as const } },
                { meaningVi: { contains: q, mode: "insensitive" as const } },
                { onyomi: { contains: q, mode: "insensitive" as const } },
                { kunyomi: { contains: q, mode: "insensitive" as const } },
                { examples: { some: { word: { contains: q, mode: "insensitive" as const } } } }
              ]
            }
          : {})
      }
    });
  }

  async grammar(q: string | undefined, limit: number) {
    return this.prisma.grammarPoint.findMany({
      include: {
        details: {
          orderBy: { position: "asc" },
          take: 2
        }
      },
      orderBy: [{ jlptLevel: "asc" }, { pattern: "asc" }],
      take: limit,
      where: {
        status: "active",
        ...(q
          ? {
              OR: [
                { pattern: { contains: q, mode: "insensitive" as const } },
                { meaningVi: { contains: q, mode: "insensitive" as const } },
                { jlptLevel: { contains: q, mode: "insensitive" as const } },
                {
                  details: { some: { explanation: { contains: q, mode: "insensitive" as const } } }
                }
              ]
            }
          : {})
      }
    });
  }

  async examples(q: string | undefined, limit: number) {
    return this.prisma.exampleSentence.findMany({
      orderBy: { japaneseText: "asc" },
      take: limit,
      where: {
        status: "active",
        ...(q
          ? {
              OR: [
                { japaneseText: { contains: q, mode: "insensitive" as const } },
                { reading: { contains: q, mode: "insensitive" as const } },
                { translationVi: { contains: q, mode: "insensitive" as const } }
              ]
            }
          : {})
      }
    });
  }

  async lexemeDetail(id: string) {
    const row = await this.prisma.lexeme.findFirst({
      include: {
        senses: {
          include: {
            exampleLinks: { include: { exampleSentence: true }, take: 8 }
          },
          orderBy: { position: "asc" }
        }
      },
      where: { id, status: "active" }
    });
    if (!row) {
      throw new NotFoundException("Dictionary word not found");
    }
    return row;
  }

  async kanjiDetail(id: string) {
    const row = await this.prisma.kanji.findFirst({
      include: {
        components: { orderBy: { position: "asc" } },
        examples: { orderBy: { position: "asc" } }
      },
      where: { id, status: "active" }
    });
    if (!row) {
      throw new NotFoundException("Kanji not found");
    }
    return row;
  }

  async grammarDetail(id: string) {
    const row = await this.prisma.grammarPoint.findFirst({
      include: { details: { orderBy: { position: "asc" } } },
      where: { id, status: "active" }
    });
    if (!row) {
      throw new NotFoundException("Grammar point not found");
    }
    return row;
  }

  examplesByWord(wordId: string, limit: number) {
    return this.prisma.exampleSentence.findMany({
      orderBy: { japaneseText: "asc" },
      take: limit,
      where: {
        status: "active",
        lexemeSenseExamples: { some: { sense: { lexemeId: wordId } } }
      }
    });
  }

  reverseSearch(q: string, limit: number) {
    return this.prisma.lexemeReverseProjection.findMany({
      include: { candidates: { include: { exampleLinks: { include: { exampleSentence: true } } }, take: 8 } },
      orderBy: { vietnameseHeadword: "asc" },
      take: limit,
      where: {
        status: "active",
        OR: [
          { vietnameseHeadword: { contains: q, mode: "insensitive" } },
          { candidates: { some: { japaneseText: { contains: q, mode: "insensitive" } } } }
        ]
      }
    });
  }
}
