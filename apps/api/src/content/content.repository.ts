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
   *
   * For search: uses SQL-level relevance ranking (exact match → starts-with → contains → reading match)
   * to ensure the most relevant results appear first, then fetches senses in a second query.
   */
  async lexemes(q: string | undefined, limit: number) {
    if (!q) {
      return this.prisma.lexeme.findMany({
        include: { senses: { orderBy: { position: "asc" }, take: 3 } },
        orderBy: [{ jlptLevel: "asc" }, { headword: "asc" }],
        take: limit,
        where: { status: "active" }
      });
    }

    // Use raw SQL for relevance-ranked ordering
    const pattern = `%${q}%`;
    const ids: { id: string }[] = await this.prisma.$queryRaw`
      SELECT id FROM content.lexeme
      WHERE status = 'active'
        AND (
          headword ILIKE ${pattern}
          OR reading ILIKE ${pattern}
          OR short_meaning_vi ILIKE ${pattern}
        )
      ORDER BY
        CASE
          WHEN headword = ${q} THEN 0
          WHEN reading = ${q} THEN 1
          WHEN headword LIKE ${q + '%'} THEN 2
          WHEN reading LIKE ${q + '%'} THEN 3
          WHEN headword LIKE ${'%' + q} THEN 4
          ELSE 5
        END,
        length(headword),
        jlpt_level NULLS LAST,
        headword
      LIMIT ${limit}
    `;

    if (ids.length === 0) return [];

    const idList = ids.map((r) => r.id);
    const rows = await this.prisma.lexeme.findMany({
      include: { senses: { orderBy: { position: "asc" }, take: 3 } },
      where: { id: { in: idList } }
    });

    // Preserve the SQL ordering
    const byId = new Map(rows.map((r) => [r.id, r]));
    return idList.map((id) => byId.get(id)!).filter(Boolean);
  }

  async kanji(q: string | undefined, limit: number) {
    if (!q) {
      return this.prisma.kanji.findMany({
        include: {
          components: { orderBy: { position: "asc" }, take: 8 },
          examples: { orderBy: { position: "asc" }, take: 6 }
        },
        orderBy: [{ level: "asc" }, { frequency: "asc" }],
        take: limit,
        where: { status: "active" }
      });
    }

    // Use raw SQL for relevance ordering (exact character match first)
    const pattern = `%${q}%`;
    const ids: { id: string }[] = await this.prisma.$queryRaw`
      SELECT id FROM content.kanji
      WHERE status = 'active'
        AND (
          character = ${q}
          OR meaning_vi ILIKE ${pattern}
          OR onyomi ILIKE ${pattern}
          OR kunyomi ILIKE ${pattern}
        )
      ORDER BY
        CASE
          WHEN character = ${q} THEN 0
          WHEN onyomi = ${q} OR kunyomi = ${q} THEN 1
          WHEN meaning_vi ILIKE ${pattern} THEN 2
          ELSE 3
        END,
        level NULLS LAST,
        frequency NULLS LAST
      LIMIT ${limit}
    `;

    if (ids.length === 0) return [];

    const idList = ids.map((r) => r.id);
    const rows = await this.prisma.kanji.findMany({
      include: {
        components: { orderBy: { position: "asc" }, take: 8 },
        examples: { orderBy: { position: "asc" }, take: 6 }
      },
      where: { id: { in: idList } }
    });

    const byId = new Map(rows.map((r) => [r.id, r]));
    return idList.map((id) => byId.get(id)!).filter(Boolean);
  }

  async grammar(q: string | undefined, limit: number) {
    if (!q) {
      return this.prisma.grammarPoint.findMany({
        include: { details: { orderBy: { position: "asc" }, take: 2 } },
        orderBy: [{ jlptLevel: "asc" }, { pattern: "asc" }],
        take: limit,
        where: { status: "active" }
      });
    }

    const pattern = `%${q}%`;
    const ids: { id: string }[] = await this.prisma.$queryRaw`
      SELECT id FROM content.grammar_point
      WHERE status = 'active'
        AND (
          pattern ILIKE ${pattern}
          OR meaning_vi ILIKE ${pattern}
          OR jlpt_level ILIKE ${pattern}
        )
      ORDER BY
        CASE
          WHEN pattern = ${q} THEN 0
          WHEN pattern LIKE ${q + '%'} THEN 1
          WHEN pattern ILIKE ${pattern} THEN 2
          ELSE 3
        END,
        jlpt_level NULLS LAST,
        pattern
      LIMIT ${limit}
    `;

    if (ids.length === 0) return [];

    const idList = ids.map((r) => r.id);
    const rows = await this.prisma.grammarPoint.findMany({
      include: { details: { orderBy: { position: "asc" }, take: 2 } },
      where: { id: { in: idList } }
    });

    const byId = new Map(rows.map((r) => [r.id, r]));
    return idList.map((id) => byId.get(id)!).filter(Boolean);
  }

  async examples(q: string | undefined, limit: number) {
    if (!q) {
      return this.prisma.exampleSentence.findMany({
        orderBy: { japaneseText: "asc" },
        take: limit,
        where: { status: "active" }
      });
    }

    const pattern = `%${q}%`;
    const ids: { id: string }[] = await this.prisma.$queryRaw`
      SELECT id FROM content.example_sentence
      WHERE status = 'active'
        AND (
          japanese_text ILIKE ${pattern}
          OR reading ILIKE ${pattern}
          OR translation_vi ILIKE ${pattern}
        )
      ORDER BY
        CASE
          WHEN japanese_text LIKE ${q + '%'} THEN 0
          WHEN japanese_text ILIKE ${pattern} THEN 1
          WHEN reading ILIKE ${pattern} THEN 2
          ELSE 3
        END,
        length(japanese_text),
        japanese_text
      LIMIT ${limit}
    `;

    if (ids.length === 0) return [];

    const idList = ids.map((r) => r.id);
    const rows = await this.prisma.exampleSentence.findMany({
      where: { id: { in: idList } }
    });

    const byId = new Map(rows.map((r) => [r.id, r]));
    return idList.map((id) => byId.get(id)!).filter(Boolean);
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

  /** Trimmed stroke SVG path/URL from DB, or null if missing or inactive kanji. */
  async kanjiStrokeSvgPath(id: string): Promise<string | null> {
    const row = await this.prisma.kanji.findFirst({
      select: { strokeSvgPath: true },
      where: { id, status: "active" }
    });
    const p = row?.strokeSvgPath;
    if (typeof p !== "string") return null;
    const t = p.trim();
    return t.length ? t : null;
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
