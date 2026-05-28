import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient } from "../../../../packages/database/src/index.js";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

interface SeedQuestion {
  correct: string;
  distractors: string[];
  explanation: string;
  prompt: string;
  skillTag: string;
  sourceId: string;
  sourceType: string;
}

async function main() {
  const [lexemes, grammar, examples] = await Promise.all([
    prisma.lexeme.findMany({
      orderBy: { headword: "asc" },
      take: 4,
      where: { reading: { not: null }, shortMeaningVi: { not: null }, status: "active" }
    }),
    prisma.grammarPoint.findMany({
      orderBy: { pattern: "asc" },
      take: 4,
      where: { status: "active" }
    }),
    prisma.exampleSentence.findMany({
      orderBy: { japaneseText: "asc" },
      take: 4,
      where: { status: "active", translationVi: { not: null } }
    })
  ]);

  const test = await prisma.bjtMockTest.upsert({
    create: {
      description: "Seeded from canonical content for local BJT practice.",
      slug: "local-bjt-practice-01",
      status: "published",
      titleJa: "ローカルBJT練習",
      titleVi: "BJT Practice từ dữ liệu local",
      type: "practice"
    },
    update: { status: "published" },
    where: { slug: "local-bjt-practice-01" }
  });

  await prisma.bjtTestSection.deleteMany({ where: { testId: test.id } });
  const section = await prisma.bjtTestSection.create({
    data: {
      code: "reading-context",
      displayOrder: 1,
      testId: test.id,
      titleJa: "読解",
      titleVi: "Đọc hiểu và từ vựng business"
    }
  });

  const questions: SeedQuestion[] = [
    lexemes[0]
      ? {
          correct: lexemes[0].shortMeaningVi ?? lexemes[0].headword,
          distractors: lexemes.slice(1, 4).map((item) => item.shortMeaningVi ?? item.headword),
          explanation: `Từ ${lexemes[0].headword} đọc là ${lexemes[0].reading ?? ""}.`,
          prompt: `Nghĩa phù hợp nhất của「${lexemes[0].headword}」là gì?`,
          skillTag: "vocabulary",
          sourceId: lexemes[0].id,
          sourceType: "lexeme"
        }
      : undefined,
    grammar[0]
      ? {
          correct: grammar[0].meaningVi,
          distractors: grammar.slice(1, 4).map((item) => item.meaningVi),
          explanation: `Mẫu ${grammar[0].pattern} thường được hiểu là: ${grammar[0].meaningVi}.`,
          prompt: `Ý nghĩa chính của mẫu「${grammar[0].pattern}」là gì?`,
          skillTag: "grammar",
          sourceId: grammar[0].id,
          sourceType: "grammar"
        }
      : undefined,
    examples[0]
      ? {
          correct: examples[0].translationVi ?? examples[0].japaneseText,
          distractors: examples.slice(1, 4).map((item) => item.translationVi ?? item.japaneseText),
          explanation: "Chọn bản dịch tiếng Việt sát nghĩa và phù hợp ngữ cảnh.",
          prompt: `Câu「${examples[0].japaneseText}」nên hiểu thế nào?`,
          skillTag: "reading",
          sourceId: examples[0].id,
          sourceType: "example"
        }
      : undefined
  ].filter((question): question is SeedQuestion => question !== undefined);

  for (const question of questions) {
    const created = await prisma.bjtQuestion.create({
      data: {
        explanationVi: question.explanation,
        prompt: question.prompt,
        sectionId: section.id,
        skillTag: question.skillTag,
        sourceId: question.sourceId,
        sourceType: question.sourceType
      }
    });

    const optionTexts = [question.correct, ...question.distractors].slice(0, 4);
    await prisma.bjtQuestionOption.createMany({
      data: optionTexts.map((text, index) => ({
        isCorrect: index === 0,
        optionKey: ["A", "B", "C", "D"][index] ?? String(index + 1),
        questionId: created.id,
        text
      }))
    });
  }

  console.log(`Seeded ${questions.length} BJT practice questions.`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
