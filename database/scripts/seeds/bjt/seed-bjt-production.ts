/**
 * Production BJT Exam Seed Script
 *
 * Replaces all existing seed exam data with 480 unique production-quality
 * questions across 6 levels (J5, J4, J3, J2, J1, J1+).
 *
 * Deletion order (respecting Restrict constraints):
 *   1. QuizAnswer (references BjtQuestion via Restrict)
 *   2. BattleRound (references BjtQuestion via Restrict)
 *   3. QuizSession (references BjtMockTest via Restrict)
 *   4. BjtQuestionOption (cascades from BjtQuestion, but explicit for safety)
 *   5. BjtQuestion
 *   6. BjtTestSection (cascades from BjtMockTest)
 *   7. BjtMockTest
 *
 * Then creates fresh tests/sections/questions with image metadata.
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient } from "../../../../packages/database/src/index.js";
import {
  SeedLevelData,
  SeedQuestion,
  MediaHint,
  SECTION_SPEC,
} from "./bjt-seed-types.js";
import { J5_DATA } from "./bjt-questions/j5.js";
import { J4_DATA } from "./bjt-questions/j4.js";
import { J3_DATA } from "./bjt-questions/j3.js";
import { J2_DATA } from "./bjt-questions/j2.js";
import { J1_DATA } from "./bjt-questions/j1.js";
import { J1PLUS_DATA } from "./bjt-questions/j1plus.js";

loadEnv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env"),
});

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

const ALL_LEVELS: SeedLevelData[] = [
  J5_DATA,
  J4_DATA,
  J3_DATA,
  J2_DATA,
  J1_DATA,
  J1PLUS_DATA,
];

/** Time limits per level in seconds */
const TIME_LIMITS: Record<string, number> = {
  J5: 6300, // 105 min
  J4: 6300,
  J3: 6300,
  J2: 6300,
  J1: 6300,
  "J1+": 6300,
};

/** Infer mediaHint from section code */
function inferMediaHint(sectionCode: string): MediaHint {
  const spec = SECTION_SPEC[sectionCode as keyof typeof SECTION_SPEC];
  return spec?.defaultMedia ?? "none";
}

/** Generate imageAlt from scenario + section code when not explicitly provided */
function generateImageAlt(
  q: SeedQuestion,
  sectionCode: string
): string | null {
  if (q.imageAlt) return q.imageAlt;

  const mediaHint = q.mediaHint ?? inferMediaHint(sectionCode);

  switch (mediaHint) {
    case "photo":
      return q.scenario
        ? `ビジネスシーンの写真：${q.scenario}`
        : `ビジネスシーンの写真`;
    case "illustration":
      return q.scenario
        ? `場面のイラスト：${q.scenario}`
        : `ビジネス場面のイラスト`;
    case "chart":
      return q.scenario
        ? `資料・グラフ：${q.scenario}`
        : `ビジネス資料`;
    case "document":
      return q.scenario
        ? `文書：${q.scenario.slice(0, 100)}`
        : `ビジネス文書`;
    case "text_fill":
    case "none":
      return null;
  }
}

async function main() {
  console.log("=== BJT Production Seed Script ===\n");

  // ---- Step 0: Validate data before touching DB ----
  console.log("Step 0: Validating seed data...");
  let totalQuestions = 0;
  const allPrompts = new Set<string>();

  for (const level of ALL_LEVELS) {
    let levelCount = 0;
    for (const section of level.sections) {
      const spec =
        SECTION_SPEC[section.code as keyof typeof SECTION_SPEC];
      if (!spec) {
        throw new Error(
          `Unknown section code: ${section.code} in level ${level.level}`
        );
      }
      if (section.questions.length !== spec.count) {
        throw new Error(
          `${level.level} ${section.code}: expected ${spec.count} questions, got ${section.questions.length}`
        );
      }

      for (const q of section.questions) {
        if (q.options.length !== 4) {
          throw new Error(
            `${level.level} ${section.code}: question has ${q.options.length} options (expected 4)`
          );
        }
        const correctCount = q.options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          throw new Error(
            `${level.level} ${section.code}: question has ${correctCount} correct options (expected 1): ${q.prompt.slice(0, 50)}`
          );
        }
        // Track uniqueness
        const key = `${level.level}::${q.prompt.slice(0, 80)}`;
        if (allPrompts.has(key)) {
          throw new Error(
            `Duplicate prompt detected in ${level.level}: ${q.prompt.slice(0, 60)}`
          );
        }
        allPrompts.add(key);
      }
      levelCount += section.questions.length;
    }
    totalQuestions += levelCount;
    console.log(`  ✓ ${level.level}: ${levelCount} questions validated`);
  }
  console.log(`  Total: ${totalQuestions} questions\n`);

  if (totalQuestions !== 480) {
    throw new Error(
      `Expected 480 total questions, got ${totalQuestions}`
    );
  }

  // ---- Step 1: Find existing tests to delete ----
  console.log("Step 1: Finding existing seed tests...");

  // Find both old-format (bjt-set2-*) and current-format (bjt-*-practice-v3) slugs
  const existingTests = await prisma.bjtMockTest.findMany({
    where: {
      OR: [
        { slug: { startsWith: "bjt-set2-" } },
        { slug: { endsWith: "-practice-v3" } },
      ],
    },
    select: { id: true, slug: true },
  });

  const testIds = existingTests.map((t) => t.id);
  console.log(
    `  Found ${existingTests.length} tests to replace: ${existingTests.map((t) => t.slug).join(", ")}`
  );

  if (testIds.length > 0) {
    // ---- Step 2: Get all question IDs from these tests ----
    const sections = await prisma.bjtTestSection.findMany({
      where: { testId: { in: testIds } },
      select: { id: true },
    });
    const sectionIds = sections.map((s) => s.id);

    const questions = await prisma.bjtQuestion.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { id: true },
    });
    const questionIds = questions.map((q) => q.id);

    console.log(
      `  Found ${sectionIds.length} sections, ${questionIds.length} questions to delete\n`
    );

    // ---- Step 3: Delete in correct order (Restrict-safe) ----
    console.log("Step 2: Deleting old data (Restrict-safe order)...");

    if (questionIds.length > 0) {
      // 3a: Quiz answers referencing these questions
      const deletedAnswers = await prisma.quizAnswer.deleteMany({
        where: { questionId: { in: questionIds } },
      });
      console.log(`  Deleted ${deletedAnswers.count} quiz answers`);

      // 3b: Battle rounds referencing these questions
      const deletedRounds = await prisma.battleRound.deleteMany({
        where: { questionId: { in: questionIds } },
      });
      console.log(`  Deleted ${deletedRounds.count} battle rounds`);
    }

    if (testIds.length > 0) {
      // 3c: Quiz sessions referencing these tests
      const deletedSessions = await prisma.quizSession.deleteMany({
        where: { testId: { in: testIds } },
      });
      console.log(`  Deleted ${deletedSessions.count} quiz sessions`);
    }

    // 3d: Delete tests (cascades: sections → questions → options)
    const deletedTests = await prisma.bjtMockTest.deleteMany({
      where: { id: { in: testIds } },
    });
    console.log(`  Deleted ${deletedTests.count} mock tests (cascade)\n`);
  } else {
    console.log("  No existing tests to delete.\n");
  }

  // ---- Step 4: Create new tests ----
  console.log("Step 3: Creating new production tests...\n");

  let grandTotalCreated = 0;

  for (const levelData of ALL_LEVELS) {
    console.log(`  Creating ${levelData.level} (${levelData.slug})...`);

    const test = await prisma.bjtMockTest.create({
      data: {
        slug: levelData.slug,
        titleVi: levelData.titleVi,
        titleJa: levelData.titleJa,
        type: "practice",
        status: "published",
        level: levelData.level,
        timeLimitSeconds: TIME_LIMITS[levelData.level] ?? 6300,
        blueprintMeta: {
          version: "v3-production",
          totalQuestions: 80,
          parts: {
            listening: { sections: ["LC_SCENE", "LC_STATEMENT", "LC_INTEGRATED"], count: 30 },
            listeningReading: { sections: ["LR_SITUATION", "LR_DOCUMENT", "LR_INTEGRATED"], count: 15 },
            reading: { sections: ["RC_VOCAB_GRAMMAR", "RC_EXPRESSION", "RC_INTEGRATED"], count: 35 },
          },
        },
      },
    });

    let levelQuestionCount = 0;

    for (let si = 0; si < levelData.sections.length; si++) {
      const sectionData = levelData.sections[si];
      const section = await prisma.bjtTestSection.create({
        data: {
          testId: test.id,
          code: sectionData.code,
          titleVi: sectionData.titleVi,
          titleJa: sectionData.titleJa,
          displayOrder: si + 1,
        },
      });

      for (const q of sectionData.questions) {
        const mediaHint = q.mediaHint ?? inferMediaHint(sectionData.code);
        const imageAlt = generateImageAlt(q, sectionData.code);

        await prisma.bjtQuestion.create({
          data: {
            sectionId: section.id,
            prompt: q.prompt,
            scenario: q.scenario,
            imageAlt: imageAlt,
            // imageUrl left null — will be populated when actual images are sourced
            explanationVi: q.explanationVi,
            skillTag: q.skillTag,
            difficulty: q.difficulty,
            sourceType: "seed-v3-production",
            qualityFlags: { mediaHint, hasImage: false, needsImage: mediaHint !== "text_fill" && mediaHint !== "none" },
            status: "published",
            tags: [levelData.level, sectionData.code, mediaHint],
            options: {
              create: q.options.map((opt) => ({
                optionKey: opt.key,
                text: opt.text,
                isCorrect: opt.isCorrect,
              })),
            },
          },
        });
        levelQuestionCount++;
      }
    }

    grandTotalCreated += levelQuestionCount;
    console.log(
      `    ✓ ${levelData.level}: ${levelQuestionCount} questions created`
    );
  }

  console.log(`\n=== Done! Created ${grandTotalCreated} questions across ${ALL_LEVELS.length} tests ===`);

  // ---- Step 5: Verify ----
  console.log("\nStep 4: Verification...");
  const verifyTests = await prisma.bjtMockTest.findMany({
    where: { slug: { endsWith: "-practice-v3" } },
    include: {
      sections: {
        include: {
          questions: { include: { options: true } },
        },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  for (const t of verifyTests) {
    const qCount = t.sections.reduce(
      (sum, s) => sum + s.questions.length,
      0
    );
    const withImageAlt = t.sections.reduce(
      (sum, s) =>
        sum + s.questions.filter((q) => q.imageAlt !== null).length,
      0
    );
    console.log(
      `  ${t.level} (${t.slug}): ${t.sections.length} sections, ${qCount} questions, ${withImageAlt} with imageAlt`
    );
    for (const s of t.sections) {
      const optCounts = s.questions.map((q) => q.options.length);
      const allFourOpts = optCounts.every((c) => c === 4);
      console.log(
        `    ${s.code}: ${s.questions.length} qs, all 4-opt: ${allFourOpts ? "✓" : "✗"}`
      );
    }
  }

  console.log("\n=== Seed complete ===");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
