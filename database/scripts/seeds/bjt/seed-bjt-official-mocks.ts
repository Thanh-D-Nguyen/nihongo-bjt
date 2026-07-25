/**
 * Idempotently seed three complete BJT full-simulation forms.
 *
 * The script never deletes learner attempts or existing practice-by-level
 * content. Stable test slugs, section codes, prompts and option keys are used
 * as natural seed identifiers.
 */

import { config as loadEnv } from "dotenv";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient, Prisma } from "../../../../packages/database/src/index.js";
import {
  OFFICIAL_MOCK_FORMS,
  OFFICIAL_MOCK_LICENSE,
  OFFICIAL_MOCK_PROVENANCE,
  validateOfficialMockForms
} from "./official-mock-data.js";

loadEnv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env")
});

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

async function seedQuestion(
  tx: Prisma.TransactionClient,
  sectionId: string,
  sectionCode: string,
  part: string,
  sourceId: string,
  question: (typeof OFFICIAL_MOCK_FORMS)[number]["sections"][number]["questions"][number]
) {
  const matches = await tx.bjtQuestion.findMany({
    where: {
      sectionId,
      OR: [{ sourceId }, { sourceId: null, prompt: question.prompt }]
    },
    select: { id: true }
  });
  if (matches.length > 1) {
    throw new Error(`Seed identity collision in ${sectionCode}: ${question.prompt.slice(0, 100)}`);
  }

  const qualityFlags = {
    bjtPart: part,
    bjtSection: sectionCode,
    businessSituation: question.businessSituation,
    stimulusKind: question.stimulusKind,
    hasAudioStimulus: question.audioScript !== null,
    hasVisualStimulus: question.imagePrompt !== null,
    distractorQuality: "automated_blueprint_validated",
    difficultySource: "blueprint_diagnostic_only",
    contentReviewStatus: "automated_validation_passed",
    scoreUse: "estimated_only",
    provenance: OFFICIAL_MOCK_PROVENANCE,
    license: OFFICIAL_MOCK_LICENSE
  } satisfies Prisma.InputJsonObject;

  const data = {
    prompt: question.prompt,
    scenario: question.scenario,
    audioScript: question.audioScript,
    imageAlt: question.imageAlt,
    imagePrompt: question.imagePrompt,
    explanationVi: question.explanationVi,
    skillTag: question.skillTag,
    difficulty: question.difficulty,
    sourceId,
    sourceType: OFFICIAL_MOCK_PROVENANCE,
    qualityFlags,
    status: "published",
    tags: question.tags
  };

  const savedQuestion = matches[0]
    ? await tx.bjtQuestion.update({
        where: { id: matches[0].id },
        data,
        select: { id: true }
      })
    : await tx.bjtQuestion.create({
        data: {
          sectionId,
          ...data
        },
        select: { id: true }
      });

  for (const option of question.options) {
    await tx.bjtQuestionOption.upsert({
      where: {
        questionId_optionKey: {
          questionId: savedQuestion.id,
          optionKey: option.key
        }
      },
      update: {
        text: option.text,
        isCorrect: option.isCorrect
      },
      create: {
        questionId: savedQuestion.id,
        optionKey: option.key,
        text: option.text,
        isCorrect: option.isCorrect
      }
    });
  }
  await tx.bjtQuestionOption.deleteMany({
    where: {
      questionId: savedQuestion.id,
      optionKey: { notIn: ["A", "B", "C", "D"] }
    }
  });
}

function stableSourceId(sourceKey: string): string {
  const hex = createHash("sha256").update(sourceKey).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex
    .slice(12, 16)
    .join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

async function main() {
  const report = validateOfficialMockForms();
  process.stdout.write(
    `Validated ${report.mockCount} forms / ${report.totalQuestions} questions before persistence.\n`
  );

  for (const form of OFFICIAL_MOCK_FORMS) {
    const persistedCount = await prisma.$transaction(
      async (tx) => {
        const test = await tx.bjtMockTest.upsert({
          where: { slug: form.slug },
          update: {
            titleVi: form.titleVi,
            titleJa: form.titleJa,
            type: form.type,
            status: form.status,
            level: form.level,
            timeLimitSeconds: form.timeLimitSeconds,
            description: form.description,
            blueprintMeta: form.blueprintMeta
          },
          create: {
            slug: form.slug,
            titleVi: form.titleVi,
            titleJa: form.titleJa,
            type: form.type,
            status: form.status,
            level: form.level,
            timeLimitSeconds: form.timeLimitSeconds,
            description: form.description,
            blueprintMeta: form.blueprintMeta
          },
          select: { id: true }
        });

        for (const sectionData of form.sections) {
          const sectionSpec = form.blueprintMeta.parts.find((part) =>
            part.sections.includes(sectionData.code)
          );
          if (!sectionSpec) {
            throw new Error(`${form.slug}/${sectionData.code}: section missing from blueprint`);
          }

          const section = await tx.bjtTestSection.upsert({
            where: {
              testId_code: {
                testId: test.id,
                code: sectionData.code
              }
            },
            update: {
              titleVi: sectionData.titleVi,
              titleJa: sectionData.titleJa,
              displayOrder: sectionData.displayOrder
            },
            create: {
              testId: test.id,
              code: sectionData.code,
              titleVi: sectionData.titleVi,
              titleJa: sectionData.titleJa,
              displayOrder: sectionData.displayOrder
            },
            select: { id: true }
          });

          for (const [questionIndex, question] of sectionData.questions.entries()) {
            await seedQuestion(
              tx,
              section.id,
              sectionData.code,
              sectionSpec.code,
              stableSourceId(`${form.slug}/${sectionData.code}/${questionIndex + 1}`),
              question
            );
          }
        }

        return tx.bjtQuestion.count({
          where: {
            sourceType: OFFICIAL_MOCK_PROVENANCE,
            section: { testId: test.id }
          }
        });
      },
      { maxWait: 10_000, timeout: 60_000 }
    );

    if (persistedCount !== form.blueprintMeta.totalQuestions) {
      throw new Error(
        `${form.slug}: expected ${form.blueprintMeta.totalQuestions} seeded questions, found ${persistedCount}`
      );
    }
    process.stdout.write(
      `Seeded ${form.slug}: ${persistedCount} questions / ${form.timeLimitSeconds}s.\n`
    );
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`BJT full-mock seed failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
