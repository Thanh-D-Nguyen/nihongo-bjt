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

const BATCH_SIZE = 10_000;
const SEARCHABLE_EXAMPLE_LIMIT = 5_000;
const TASK_TIMEOUT_MS = 120_000;

async function replaceDocuments(documents: SearchResult[]) {
  if (documents.length === 0) return;

  await meili
    .index("content_search")
    .addDocuments(documents, { primaryKey: "id" })
    .waitTask({ timeout: TASK_TIMEOUT_MS });
}

/** Builds the complete Meilisearch projection from canonical PostgreSQL content tables. */
async function main() {
  const index = meili.index("content_search");

  await index
    .updateSettings({
      filterableAttributes: ["kind", "jlptLevel"],
      searchableAttributes: ["title", "reading", "description"],
      sortableAttributes: ["kind"]
    })
    .waitTask({ timeout: TASK_TIMEOUT_MS });
  await index.deleteAllDocuments().waitTask({ timeout: TASK_TIMEOUT_MS });

  let indexed = 0;

  for (let skip = 0; ; skip += BATCH_SIZE) {
    const lexemes = await prisma.lexeme.findMany({
      include: { senses: { orderBy: { position: "asc" }, take: 1 } },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
      where: { status: "active" }
    });
    if (lexemes.length === 0) break;

    await replaceDocuments(
      lexemes.map((lexeme) => ({
        description: lexeme.shortMeaningVi ?? lexeme.senses[0]?.meaningVi ?? null,
        id: lexeme.id,
        jlptLevel: lexeme.jlptLevel,
        kind: "lexeme" as const,
        reading: lexeme.reading,
        title: lexeme.headword
      }))
    );
    indexed += lexemes.length;
  }

  for (let skip = 0; ; skip += BATCH_SIZE) {
    const kanji = await prisma.kanji.findMany({
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
      where: { status: "active" }
    });
    if (kanji.length === 0) break;

    await replaceDocuments(
      kanji.map((item) => ({
        description: item.meaningVi,
        id: item.id,
        jlptLevel: item.level != null ? `N${item.level}` : null,
        kind: "kanji" as const,
        reading: [item.onyomi, item.kunyomi].filter(Boolean).join(" / ") || null,
        title: item.character
      }))
    );
    indexed += kanji.length;
  }

  for (let skip = 0; ; skip += BATCH_SIZE) {
    const grammar = await prisma.grammarPoint.findMany({
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
      where: { status: "active" }
    });
    if (grammar.length === 0) break;

    await replaceDocuments(
      grammar.map((item) => ({
        description: item.meaningVi,
        id: item.id,
        jlptLevel: item.jlptLevel,
        kind: "grammar" as const,
        reading: item.jlptLevel,
        title: item.pattern
      }))
    );
    indexed += grammar.length;
  }

  // Example sentences are supporting search documents. Keep the complete
  // canonical dataset in PostgreSQL without making the search projection
  // disproportionately large on the production VM.
  const examples = await prisma.exampleSentence.findMany({
    orderBy: { id: "asc" },
    take: SEARCHABLE_EXAMPLE_LIMIT,
    where: { status: "active" }
  });
  await replaceDocuments(
    examples.map((item) => ({
      description: item.translationVi,
      id: item.id,
      jlptLevel: null,
      kind: "example" as const,
      reading: item.reading,
      title: item.japaneseText
    }))
  );
  indexed += examples.length;

  for (let skip = 0; ; skip += BATCH_SIZE) {
    const lessons = await prisma.bjtLesson.findMany({
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
      where: { status: "active" }
    });
    if (lessons.length === 0) break;
    await replaceDocuments(
      lessons.map((lesson) => ({
        description: lesson.descriptionVi,
        id: lesson.id,
        jlptLevel: lesson.levelCode,
        kind: "lesson" as const,
        reading: lesson.titleJa,
        title: lesson.titleVi
      }))
    );
    indexed += lessons.length;
  }

  console.log(`Indexed ${indexed} content documents into Meilisearch.`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
