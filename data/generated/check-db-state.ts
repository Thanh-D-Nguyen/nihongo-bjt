import { createPrismaClient } from "../../packages/database/src/index.js";

const prisma = createPrismaClient();

async function main() {
  const total = await prisma.bjtQuestion.count();
  const lc = await prisma.bjtQuestion.count({ where: { section: { code: { startsWith: "LC" } } } });
  const lr = await prisma.bjtQuestion.count({ where: { section: { code: { startsWith: "LR" } } } });
  const rc = await prisma.bjtQuestion.count({ where: { section: { code: { startsWith: "RC" } } } });
  console.log(`Total: ${total}, LC: ${lc}, LR: ${lr}, RC: ${rc}`);

  const tests = await prisma.bjtMockTest.findMany({
    select: { slug: true, level: true },
  });
  console.log("Tests:", tests.map(t => `${t.slug} (${t.level})`).join(", "));

  // Check audioScript status
  const withAudio = await prisma.bjtQuestion.count({ where: { audioScript: { not: null } } });
  const withoutAudio = await prisma.bjtQuestion.count({ where: { audioScript: null } });
  console.log(`With audioScript: ${withAudio}, Without: ${withoutAudio}`);

  // Check imageAlt status
  const withImageAlt = await prisma.bjtQuestion.count({ where: { imageAlt: { not: null } } });
  console.log(`With imageAlt: ${withImageAlt}`);

  // Uniqueness check — all prompts should be unique
  const allPrompts = await prisma.bjtQuestion.findMany({ select: { prompt: true } });
  const uniquePrompts = new Set(allPrompts.map(q => q.prompt));
  console.log(`Unique prompts: ${uniquePrompts.size} / ${allPrompts.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
