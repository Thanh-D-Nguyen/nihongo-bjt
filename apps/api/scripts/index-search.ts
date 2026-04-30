import { parseServerEnv } from "@nihongo-bjt/config";
import { createPrismaClient } from "@nihongo-bjt/database";
import type { SearchResult } from "@nihongo-bjt/shared";
import { config as loadEnv } from "dotenv";
import { Meilisearch } from "meilisearch";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);
const meili = new Meilisearch({
  apiKey: env.MEILI_MASTER_KEY,
  host: env.MEILI_HOST
});

/** Builds Meilisearch documents from **canonical** PostgreSQL content tables (staging/import must land in DB first). */
async function main() {
  const [lexemes, kanji, grammar, examples] = await Promise.all([
    prisma.lexeme.findMany({
      include: { senses: { orderBy: { position: "asc" }, take: 1 } },
      take: 5000,
      where: { status: "active" }
    }),
    prisma.kanji.findMany({ take: 5000, where: { status: "active" } }),
    prisma.grammarPoint.findMany({ take: 5000, where: { status: "active" } }),
    prisma.exampleSentence.findMany({ take: 5000, where: { status: "active" } })
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

  const index = meili.index("content_search");
  await index.updateSettings({
    filterableAttributes: ["kind"],
    searchableAttributes: ["title", "reading", "description"],
    sortableAttributes: ["kind"]
  });
  await index.addDocuments(documents, { primaryKey: "id" });

  console.log(`Indexed ${documents.length} content documents into Meilisearch.`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
