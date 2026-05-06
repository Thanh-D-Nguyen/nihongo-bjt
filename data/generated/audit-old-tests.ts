import { createPrismaClient } from "../../packages/database/src/index.js";

const prisma = createPrismaClient();

async function main() {
  // List all tests with question counts
  const tests = await prisma.bjtMockTest.findMany({
    select: {
      id: true,
      slug: true,
      level: true,
      status: true,
      _count: { select: { sections: true, sessions: true } },
    },
    orderBy: { slug: "asc" },
  });

  console.log("=== All BJT Mock Tests ===\n");
  console.log("Slug | Level | Status | Sections | Sessions");
  console.log("--- | --- | --- | --- | ---");

  const v3Slugs: string[] = [];
  const nonV3Slugs: string[] = [];

  for (const t of tests) {
    const isV3 = t.slug.endsWith("-practice-v3");
    const marker = isV3 ? "✓ v3" : "⚠ OLD";
    console.log(
      `${marker} ${t.slug} | ${t.level} | ${t.status} | ${t._count.sections} | ${t._count.sessions}`
    );
    if (isV3) v3Slugs.push(t.slug);
    else nonV3Slugs.push(t.slug);
  }

  // Count questions per test group
  const v3Tests = await prisma.bjtMockTest.findMany({
    where: { slug: { endsWith: "-practice-v3" } },
    select: { id: true },
  });
  const v3Sections = await prisma.bjtTestSection.findMany({
    where: { testId: { in: v3Tests.map((t) => t.id) } },
    select: { id: true },
  });
  const v3QCount = await prisma.bjtQuestion.count({
    where: { sectionId: { in: v3Sections.map((s) => s.id) } },
  });

  const nonV3Tests = await prisma.bjtMockTest.findMany({
    where: { NOT: { slug: { endsWith: "-practice-v3" } } },
    select: { id: true },
  });
  const nonV3Sections = await prisma.bjtTestSection.findMany({
    where: { testId: { in: nonV3Tests.map((t) => t.id) } },
    select: { id: true },
  });
  const nonV3QCount = await prisma.bjtQuestion.count({
    where: { sectionId: { in: nonV3Sections.map((s) => s.id) } },
  });

  // Check sessions/answers on old tests
  const nonV3Ids = nonV3Tests.map((t) => t.id);
  const nonV3SessionCount = await prisma.quizSession.count({
    where: { testId: { in: nonV3Ids } },
  });

  const nonV3QuestionIds = await prisma.bjtQuestion.findMany({
    where: { sectionId: { in: nonV3Sections.map((s) => s.id) } },
    select: { id: true },
  });
  const nonV3AnswerCount = await prisma.quizAnswer.count({
    where: { questionId: { in: nonV3QuestionIds.map((q) => q.id) } },
  });
  const nonV3BattleCount = await prisma.battleRound.count({
    where: { questionId: { in: nonV3QuestionIds.map((q) => q.id) } },
  });

  console.log(`\n=== Summary ===`);
  console.log(`v3 tests: ${v3Slugs.length}, questions: ${v3QCount}`);
  console.log(`Old tests: ${nonV3Slugs.length}, questions: ${nonV3QCount}`);
  console.log(`Old test sessions: ${nonV3SessionCount}`);
  console.log(`Old test answers: ${nonV3AnswerCount}`);
  console.log(`Old test battle rounds: ${nonV3BattleCount}`);
  console.log(`\nOld slugs to delete: ${nonV3Slugs.join(", ")}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
