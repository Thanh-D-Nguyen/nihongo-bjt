import { parseServerEnv } from "@nihongo-bjt/config";
import { createPrismaClient } from "@nihongo-bjt/database";
import { searchResultSchema, type SearchResult } from "@nihongo-bjt/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Meilisearch } from "meilisearch";

import { ContentRepository } from "../content/content.repository.js";

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly env = parseServerEnv(process.env);
  private readonly meili: Meilisearch;
  private readonly prisma = createPrismaClient();

  constructor(@Inject(ContentRepository) private readonly contentRepository: ContentRepository) {
    this.meili = new Meilisearch({
      apiKey: this.env.MEILI_MASTER_KEY,
      host: this.env.MEILI_HOST
    });
  }

  async search(q: string, limit: number): Promise<SearchResult[]> {
    const meili = await this.searchMeilisearch(q, limit);
    if (meili.length > 0) {
      return meili;
    }
    return this.searchPostgres(q, limit);
  }

  private async searchMeilisearch(q: string, limit: number): Promise<SearchResult[]> {
    try {
      const res = await this.meili.index<Record<string, unknown>>("content_search").search(q, {
        attributesToRetrieve: ["description", "id", "kind", "reading", "title"],
        limit
      });
      if (!res.hits.length) {
        return [];
      }
      const out: SearchResult[] = [];
      for (const hit of res.hits) {
        const parsed = searchResultSchema.safeParse(hit);
        if (parsed.success) {
          out.push(parsed.data);
        }
      }
      return out.slice(0, limit);
    } catch (error) {
      this.logger.warn(
        `Meilisearch search failed, falling back to PostgreSQL: ${(error as Error).message}`
      );
      return [];
    }
  }

  async rebuildProjectionIndex(): Promise<{ indexed: number; sourceSystem: "PostgreSQL"; timestamp: string }> {
    const [lexemes, kanji, grammar, examples] = await Promise.all([
      this.prisma.lexeme.findMany({
        include: { senses: { orderBy: { position: "asc" }, take: 1 } },
        take: 5000,
        where: { status: "active" }
      }),
      this.prisma.kanji.findMany({ take: 5000, where: { status: "active" } }),
      this.prisma.grammarPoint.findMany({ take: 5000, where: { status: "active" } }),
      this.prisma.exampleSentence.findMany({ take: 5000, where: { status: "active" } })
    ]);

    const documents: SearchResult[] = [
      ...lexemes.map((lexeme) => ({
        description: lexeme.shortMeaningVi ?? lexeme.senses[0]?.meaningVi ?? null,
        id: lexeme.id,
        kind: "lexeme" as const,
        reading: lexeme.reading,
        title: lexeme.headword
      })),
      ...kanji.map((item) => ({
        description: item.meaningVi,
        id: item.id,
        kind: "kanji" as const,
        reading: [item.onyomi, item.kunyomi].filter(Boolean).join(" / ") || null,
        title: item.character
      })),
      ...grammar.map((item) => ({
        description: item.meaningVi,
        id: item.id,
        kind: "grammar" as const,
        reading: item.jlptLevel,
        title: item.pattern
      })),
      ...examples.map((item) => ({
        description: item.translationVi,
        id: item.id,
        kind: "example" as const,
        reading: item.reading,
        title: item.japaneseText
      }))
    ];

    const index = this.meili.index<SearchResult>("content_search");
    await index.updateSettings({
      filterableAttributes: ["kind"],
      searchableAttributes: ["title", "reading", "description"],
      sortableAttributes: ["kind"]
    });
    await index.addDocuments(documents, { primaryKey: "id" });

    return {
      indexed: documents.length,
      sourceSystem: "PostgreSQL",
      timestamp: new Date().toISOString()
    };
  }

  private async searchPostgres(q: string, limit: number): Promise<SearchResult[]> {
    const [lexemes, kanji, grammar, examples] = await Promise.all([
      this.contentRepository.lexemes(q, limit),
      this.contentRepository.kanji(q, limit),
      this.contentRepository.grammar(q, limit),
      this.contentRepository.examples(q, limit)
    ]);

    return [
      ...lexemes.map((lexeme) => ({
        description: lexeme.shortMeaningVi ?? lexeme.senses[0]?.meaningVi ?? null,
        id: lexeme.id,
        kind: "lexeme" as const,
        reading: lexeme.reading,
        title: lexeme.headword
      })),
      ...kanji.map((item) => ({
        description: item.meaningVi,
        id: item.id,
        kind: "kanji" as const,
        reading: [item.onyomi, item.kunyomi].filter(Boolean).join(" / ") || null,
        title: item.character
      })),
      ...grammar.map((item) => ({
        description: item.meaningVi,
        id: item.id,
        kind: "grammar" as const,
        reading: item.jlptLevel,
        title: item.pattern
      })),
      ...examples.map((item) => ({
        description: item.translationVi,
        id: item.id,
        kind: "example" as const,
        reading: item.reading,
        title: item.japaneseText
      }))
    ].slice(0, limit * 4);
  }
}
