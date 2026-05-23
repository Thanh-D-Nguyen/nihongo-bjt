import { parseServerEnv } from "@nihongo-bjt/config";
import { createPrismaClient } from "@nihongo-bjt/database";
import { searchResultSchema, type SearchResult, type SearchSuggestion } from "@nihongo-bjt/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Meilisearch } from "meilisearch";
import { isRomaji, toHiragana, toKatakana } from "wanakana";

import { ContentRepository } from "../content/content.repository.js";

interface ScoredResult extends SearchResult {
  score: number;
}

/** Check if a string is all katakana */
function isAllKatakana(s: string): boolean {
  return /^[\u30A0-\u30FF\u30FC]+$/.test(s);
}

/** Convert katakana to hiragana */
function katakanaToHiragana(s: string): string {
  return s.replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** Extract individual kanji characters from a string */
function extractKanji(s: string): string[] {
  return [...s].filter((ch) => /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch));
}

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

  async search(q: string, limit: number, scope?: string, level?: string): Promise<SearchResult[]> {
    // Always use PostgreSQL ranked search — Meilisearch CJK tokenization
    // breaks multi-character Japanese words into individual characters,
    // producing irrelevant results (e.g. 会議 → matches anything with 会 or 議).
    const scored = await this.searchPostgresRanked(q, limit, scope, level);
    return scored.map(({ score: _s, ...rest }) => rest).slice(0, limit);
  }

  private async searchMeilisearch(q: string, limit: number, scope?: string, level?: string): Promise<SearchResult[]> {
    try {
      const filters: string[] = [];
      if (scope) {
        filters.push(`kind = "${scope}"`);
      }
      if (level) {
        filters.push(`jlptLevel = "${level}"`);
      }
      const searchOptions: Record<string, unknown> = {
        attributesToRetrieve: ["description", "id", "jlptLevel", "kind", "reading", "title"],
        limit
      };
      if (filters.length > 0) {
        searchOptions.filter = filters.join(" AND ");
      }
      const res = await this.meili.index<Record<string, unknown>>("content_search").search(q, searchOptions);
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

  async suggest(q: string, limit: number): Promise<SearchSuggestion[]> {
    // Bypass Meilisearch — CJK tokenization breaks multi-character words (e.g. 会議 → 会 + 議)
    return this.suggestPostgres(q, limit);
  }

  private async suggestPostgres(q: string, limit: number): Promise<SearchSuggestion[]> {
    const queries = this.normalizeQuery(q);
    const perType = Math.max(limit, 20);

    // Fetch ranked rows per query variant from contentRepository (raw SQL with exact-match ORDER BY)
    const lexemeRowsArr = await Promise.all(queries.map((v) => this.contentRepository.lexemes(v, perType)));
    const kanjiRowsArr = await Promise.all(queries.map((v) => this.contentRepository.kanji(v, perType)));
    const grammarRowsArr = await Promise.all(queries.map((v) => this.contentRepository.grammar(v, perType)));

    const scored: Array<SearchSuggestion & { score: number }> = [];
    const seen = new Set<string>();

    for (const rows of lexemeRowsArr) {
      for (const l of rows) {
        if (seen.has(l.id)) continue;
        seen.add(l.id);
        scored.push({
          id: l.id,
          kind: "lexeme",
          reading: l.reading,
          title: l.headword,
          score: this.scoreResult(queries, l.headword, l.reading, l.shortMeaningVi ?? null)
        });
      }
    }
    for (const rows of kanjiRowsArr) {
      for (const k of rows) {
        if (seen.has(k.id)) continue;
        seen.add(k.id);
        const reading = [k.onyomi, k.kunyomi].filter(Boolean).join(" / ") || null;
        scored.push({
          id: k.id,
          kind: "kanji",
          reading,
          title: k.character,
          score: this.scoreResult(queries, k.character, reading, null)
        });
      }
    }
    for (const rows of grammarRowsArr) {
      for (const g of rows) {
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        scored.push({
          id: g.id,
          kind: "grammar",
          reading: g.jlptLevel,
          title: g.pattern,
          score: this.scoreResult(queries, g.pattern, null, null)
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(({ score: _s, ...rest }) => rest);
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

    const documents = [
      ...lexemes.map((lexeme) => ({
        description: lexeme.shortMeaningVi ?? lexeme.senses[0]?.meaningVi ?? null,
        id: lexeme.id,
        jlptLevel: lexeme.jlptLevel ?? null,
        kind: "lexeme" as const,
        reading: lexeme.reading,
        title: lexeme.headword
      })),
      ...kanji.map((item) => ({
        description: item.meaningVi,
        id: item.id,
        jlptLevel: item.level != null ? `N${item.level}` : null,
        kind: "kanji" as const,
        reading: [item.onyomi, item.kunyomi].filter(Boolean).join(" / ") || null,
        title: item.character
      })),
      ...grammar.map((item) => ({
        description: item.meaningVi,
        id: item.id,
        jlptLevel: item.jlptLevel ?? null,
        kind: "grammar" as const,
        reading: item.jlptLevel,
        title: item.pattern
      })),
      ...examples.map((item) => ({
        description: item.translationVi,
        id: item.id,
        jlptLevel: null as string | null,
        kind: "example" as const,
        reading: item.reading,
        title: item.japaneseText
      }))
    ];

    const index = this.meili.index("content_search");
    await index.updateSettings({
      filterableAttributes: ["kind", "jlptLevel"],
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

  /**
   * Normalize query: if romaji, convert to hiragana; if katakana, also get hiragana.
   * Returns array of unique query strings to search with.
   */
  private normalizeQuery(q: string): string[] {
    const queries = new Set<string>([q]);

    // Romaji → hiragana + katakana (e.g. "kaigi" → "かいぎ", "カイギ")
    if (isRomaji(q)) {
      try {
        const hira = toHiragana(q);
        const kata = toKatakana(q);
        if (hira !== q) queries.add(hira);
        if (kata !== q) queries.add(kata);
      } catch {
        // wanakana may throw on edge cases — keep original
      }
    }

    // Katakana → hiragana (e.g. "カイギ" → "かいぎ")
    if (isAllKatakana(q)) {
      queries.add(katakanaToHiragana(q));
    }

    return [...queries];
  }

  private async searchPostgresRanked(q: string, limit: number, scope?: string, level?: string): Promise<ScoredResult[]> {
    const queries = this.normalizeQuery(q);
    // Fetch a larger pool to ensure exact matches aren't pushed out
    const perType = Math.max(limit, 30);
    const fetches: Promise<ScoredResult[]>[] = [];

    if (!scope || scope === "lexeme") {
      fetches.push(this.fetchAndScoreLexemes(queries, perType));
    }
    if (!scope || scope === "kanji") {
      fetches.push(this.fetchAndScoreKanji(queries, q, perType));
    }
    if (!scope || scope === "grammar") {
      fetches.push(this.fetchAndScoreGrammar(queries, perType));
    }
    if (!scope || scope === "example") {
      fetches.push(this.fetchAndScoreExamples(queries, perType));
    }

    const pools = await Promise.all(fetches);
    let results = pools.flat();

    // Deduplicate by id (multiple queries might return the same result)
    const seen = new Set<string>();
    results = results.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    if (level) {
      results = results.filter((r) => r.jlptLevel === level);
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /** Score a result based on how well `title` and `reading` match the query */
  private scoreResult(queries: string[], title: string, reading: string | null, description: string | null): number {
    let bestScore = 0;
    for (const q of queries) {
      bestScore = Math.max(bestScore, this.scoreOnePair(q, title, reading, description));
    }
    return bestScore;
  }

  private scoreOnePair(q: string, title: string, reading: string | null, description: string | null): number {
    const qLower = q.toLowerCase();
    const titleLower = title.toLowerCase();

    // Exact match on title (headword)
    if (titleLower === qLower) return 100;
    // Reading exact match (critical for kana/romaji search: かいぎ → 会議)
    if (reading && reading.toLowerCase() === qLower) return 90;
    // Title starts with query
    if (titleLower.startsWith(qLower)) return 80;
    // Reading starts with query
    if (reading && reading.toLowerCase().startsWith(qLower)) return 75;
    // Query starts with title (e.g. query "会議中" matches title "会議")
    if (qLower.startsWith(titleLower)) return 70;
    // Title contains query
    if (titleLower.includes(qLower)) return 60;
    // Reading contains query
    if (reading && reading.toLowerCase().includes(qLower)) return 40;
    // Description contains query
    if (description && description.toLowerCase().includes(qLower)) return 20;
    // Matched through related data (senses, examples)
    return 10;
  }

  private async fetchAndScoreLexemes(queries: string[], limit: number): Promise<ScoredResult[]> {
    // Fetch results for all query variants, deduplicate by id
    const all = new Map<string, ScoredResult>();
    for (const q of queries) {
      const rows = await this.contentRepository.lexemes(q, limit);
      for (const lexeme of rows) {
        if (all.has(lexeme.id)) continue;
        const title = lexeme.headword;
        const reading = lexeme.reading;
        const description = lexeme.shortMeaningVi ?? lexeme.senses[0]?.meaningVi ?? null;
        all.set(lexeme.id, {
          description,
          id: lexeme.id,
          jlptLevel: lexeme.jlptLevel ?? null,
          kind: "lexeme" as const,
          reading,
          score: this.scoreResult(queries, title, reading, description),
          title
        });
      }
    }
    return [...all.values()];
  }

  private async fetchAndScoreKanji(queries: string[], originalQ: string, limit: number): Promise<ScoredResult[]> {
    const all = new Map<string, ScoredResult>();

    // For multi-character input containing kanji, decompose into individual characters
    // e.g. 会議 → search for both 会 and 議 as individual kanji
    const kanjiChars = extractKanji(originalQ);
    const kanjiQueries = kanjiChars.length > 1 ? kanjiChars : queries;

    for (const q of kanjiQueries) {
      const rows = await this.contentRepository.kanji(q, limit);
      for (const item of rows) {
        if (all.has(item.id)) continue;
        const title = item.character;
        const reading = [item.onyomi, item.kunyomi].filter(Boolean).join(" / ") || null;
        const description = item.meaningVi;
        // For decomposed kanji, score based on whether the character is in the original query
        const score = kanjiChars.length > 1 && kanjiChars.includes(title)
          ? 95 // Individual kanji from the query word
          : this.scoreResult(queries, title, reading, description);
        all.set(item.id, {
          description,
          id: item.id,
          jlptLevel: item.level != null ? `N${item.level}` : null,
          kind: "kanji" as const,
          reading,
          score,
          title
        });
      }
    }
    return [...all.values()];
  }

  private async fetchAndScoreGrammar(queries: string[], limit: number): Promise<ScoredResult[]> {
    const all = new Map<string, ScoredResult>();
    for (const q of queries) {
      const rows = await this.contentRepository.grammar(q, limit);
      for (const item of rows) {
        if (all.has(item.id)) continue;
        const title = item.pattern;
        const reading = item.jlptLevel;
        const description = item.meaningVi;
        all.set(item.id, {
          description,
          id: item.id,
          jlptLevel: item.jlptLevel ?? null,
          kind: "grammar" as const,
          reading,
          score: this.scoreResult(queries, title, reading, description),
          title
        });
      }
    }
    return [...all.values()];
  }

  private async fetchAndScoreExamples(queries: string[], limit: number): Promise<ScoredResult[]> {
    const all = new Map<string, ScoredResult>();
    for (const q of queries) {
      const rows = await this.contentRepository.examples(q, limit);
      for (const item of rows) {
        if (all.has(item.id)) continue;
        const title = item.japaneseText;
        const reading = item.reading;
        const description = item.translationVi;
        all.set(item.id, {
          description,
          id: item.id,
          jlptLevel: null,
          kind: "example" as const,
          reading,
          score: this.scoreResult(queries, title, reading, description),
          title
        });
      }
    }
    return [...all.values()];
  }

}
