/**
 * Clean up old/duplicated BJT test data.
 * Keeps only v3 production tests, deletes everything else.
 *
 * Deletion order (Restrict-safe):
 *   1. QuizAnswer (Restrict on BjtQuestion)
 *   2. BattleRound (Restrict on BjtQuestion)
 *   3. QuizSession (Restrict on BjtMockTest)
 *   4. BjtMockTest cascade (sections → questions → options)
 */

import { createPrismaClient } from "../../packages/database/src/index.js";

const prisma = createPrismaClient();

async function main() {
  console.log("=== Cleanup Old BJT Data ===\n");

  // Find all non-v3 tests
  const oldTests = await prisma.bjtMockTest.findMany({
    where: { NOT: { slug: { endsWith: "-practice-v3" } } },
    select: { id: true, slug: true },
  });

  if (oldTests.length === 0) {
    console.log("No old tests found. Nothing to clean up.");
    return;
  }

  const oldTestIds = oldTests.map((t) => t.id);
  console.log(`Found ${oldTests.length} old tests to delete:`);
  for (const t of oldTests) {
    console.log(`  - ${t.slug}`);
  }

  // Get all question IDs from old tests
  const oldSections = await prisma.bjtTestSection.findMany({
    where: { testId: { in: oldTestIds } },
    select: { id: true },
  });
  const oldQuestions = await prisma.bjtQuestion.findMany({
    where: { sectionId: { in: oldSections.map((s) => s.id) } },
    select: { id: true },
  });
  const oldQuestionIds = oldQuestions.map((q) => q.id);

  console.log(
    `\n  ${oldSections.length} sections, ${oldQuestionIds.length} questions to delete`
  );

  // Step 1: Delete quiz answers
  if (oldQuestionIds.length > 0) {
    const deletedAnswers = await prisma.quizAnswer.deleteMany({
      where: { questionId: { in: oldQuestionIds } },
    });
    console.log(`\n  ✓ Deleted ${deletedAnswers.count} quiz answers`);

    // Step 2: Delete battle rounds
    const deletedRounds = await prisma.battleRound.deleteMany({
      where: { questionId: { in: oldQuestionIds } },
    });
    console.log(`  ✓ Deleted ${deletedRounds.count} battle rounds`);
  }

  // Step 3: Delete quiz sessions
  const deletedSessions = await prisma.quizSession.deleteMany({
    where: { testId: { in: oldTestIds } },
  });
  console.log(`  ✓ Deleted ${deletedSessions.count} quiz sessions`);

  // Step 4: Delete tests (cascade to sections → questions → options)
  const deletedTests = await prisma.bjtMockTest.deleteMany({
    where: { id: { in: oldTestIds } },
  });
  console.log(`  ✓ Deleted ${deletedTests.count} mock tests (cascade)`);

  // Verify
  const remaining = await prisma.bjtQuestion.count();
  const remainingTests = await prisma.bjtMockTest.count();
  console.log(`\n=== After cleanup ===`);
  console.log(`  Tests: ${remainingTests}`);
  console.log(`  Questions: ${remaining}`);

  // Uniqueness check
  const allPrompts = await prisma.bjtQuestion.findMany({
    select: { prompt: true },
  });
  const uniquePrompts = new Set(allPrompts.map((q) => q.prompt));
  console.log(
    `  Unique prompts: ${uniquePrompts.size} / ${allPrompts.length}`
  );
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
