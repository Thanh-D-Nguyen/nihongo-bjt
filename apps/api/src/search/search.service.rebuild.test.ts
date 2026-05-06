import { describe, expect, it, vi } from "vitest";

import { SearchService } from "./search.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";
process.env.MEILI_HOST ??= "http://127.0.0.1:7700";
process.env.MEILI_MASTER_KEY ??= "masterKey";

describe("SearchService rebuildProjectionIndex", () => {
  it("rebuilds the Meilisearch projection from canonical PostgreSQL content rows", async () => {
    const service = new SearchService({} as any);
    const updateSettings = vi.fn().mockResolvedValue(undefined);
    const addDocuments = vi.fn().mockResolvedValue({ taskUid: 1 });

    (service as any).prisma = {
      exampleSentence: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ex-1", japaneseText: "会議を始めます。", reading: "かいぎをはじめます。", translationVi: "Bắt đầu cuộc họp." }
        ])
      },
      grammarPoint: {
        findMany: vi.fn().mockResolvedValue([
          { id: "gr-1", jlptLevel: "N3", meaningVi: "đã từng", pattern: "〜たことがある" }
        ])
      },
      kanji: {
        findMany: vi.fn().mockResolvedValue([
          { character: "会", id: "kanji-1", kunyomi: "あ.う", meaningVi: "hội", onyomi: "カイ" }
        ])
      },
      lexeme: {
        findMany: vi.fn().mockResolvedValue([
          { headword: "会議", id: "lex-1", reading: "かいぎ", senses: [{ meaningVi: "cuộc họp" }], shortMeaningVi: null }
        ])
      }
    };
    (service as any).meili = {
      index: vi.fn().mockReturnValue({
        addDocuments,
        updateSettings
      })
    };

    const result = await service.rebuildProjectionIndex();

    expect(updateSettings).toHaveBeenCalledWith({
      filterableAttributes: ["kind", "jlptLevel"],
      searchableAttributes: ["title", "reading", "description"],
      sortableAttributes: ["kind"]
    });
    expect(addDocuments).toHaveBeenCalledWith(
      [
        {
          description: "cuộc họp",
          id: "lex-1",
          jlptLevel: null,
          kind: "lexeme",
          reading: "かいぎ",
          title: "会議"
        },
        {
          description: "hội",
          id: "kanji-1",
          jlptLevel: null,
          kind: "kanji",
          reading: "カイ / あ.う",
          title: "会"
        },
        {
          description: "đã từng",
          id: "gr-1",
          jlptLevel: "N3",
          kind: "grammar",
          reading: "N3",
          title: "〜たことがある"
        },
        {
          description: "Bắt đầu cuộc họp.",
          id: "ex-1",
          jlptLevel: null,
          kind: "example",
          reading: "かいぎをはじめます。",
          title: "会議を始めます。"
        }
      ],
      { primaryKey: "id" }
    );
    expect(result.indexed).toBe(4);
    expect(result.sourceSystem).toBe("PostgreSQL");
    expect(typeof result.timestamp).toBe("string");
  });
});
