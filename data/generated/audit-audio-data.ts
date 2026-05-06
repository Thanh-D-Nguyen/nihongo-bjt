import { createPrismaClient } from "../../packages/database/src/index.js";

const prisma = createPrismaClient();

async function main() {
  const all = await prisma.bjtQuestion.findMany({
    where: { section: { code: { startsWith: "LC_" } } },
    select: {
      id: true,
      prompt: true,
      scenario: true,
      section: {
        select: { code: true, test: { select: { slug: true } } },
      },
    },
  });

  // Group by prompt to find duplicates
  const byPrompt = new Map<string, typeof all>();
  for (const q of all) {
    const key = q.prompt;
    if (!byPrompt.has(key)) byPrompt.set(key, []);
    byPrompt.get(key)!.push(q);
  }

  let dupCount = 0;
  for (const [prompt, qs] of byPrompt) {
    if (qs.length > 1) {
      dupCount++;
      if (dupCount <= 5) {
        console.log(`\nDuplicate prompt (${qs.length}x):`);
        console.log("  Prompt:", prompt.slice(0, 100));
        console.log(
          "  Tests:",
          qs.map((q) => q.section.test.slug).join(", ")
        );
        console.log(
          "  Sections:",
          qs.map((q) => q.section.code).join(", ")
        );
      }
    }
  }
  console.log(
    `\nTotal LC: ${all.length}, Unique prompts: ${byPrompt.size}, Duplicate groups: ${dupCount}`
  );

  // Also check LR
  const allLr = await prisma.bjtQuestion.findMany({
    where: { section: { code: { startsWith: "LR_" } } },
    select: { prompt: true },
  });
  const uniqueLr = new Set(allLr.map((q) => q.prompt));
  console.log(`Total LR: ${allLr.length}, Unique prompts: ${uniqueLr.size}`);

  // Total unique (prompt + scenario combo)
  const allAudio = await prisma.bjtQuestion.findMany({
    where: { section: { code: { in: ["LC_SCENE", "LC_STATEMENT", "LC_INTEGRATED", "LR_SITUATION", "LR_DOCUMENT", "LR_INTEGRATED"] } } },
    select: { prompt: true, scenario: true, options: { select: { text: true }, orderBy: { optionKey: "asc" } } },
  });
  const combos = new Set(allAudio.map((q) => q.prompt + "|" + q.scenario + "|" + q.options.map(o => o.text).join("|")));
  console.log(`\nTotal audio questions: ${allAudio.length}, Unique (prompt+scenario+options) combos: ${combos.size}`);

  await prisma.$disconnect();
}

main();
