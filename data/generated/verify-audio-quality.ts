import { createPrismaClient } from "../../packages/database/src/index.js";

const prisma = createPrismaClient();

async function main() {
  // Check 3 LC samples: audioScript must contain the prompt text
  const lcSamples = await prisma.bjtQuestion.findMany({
    where: { section: { code: "LC_SCENE" }, audioScript: { not: null } },
    select: {
      prompt: true,
      scenario: true,
      audioScript: true,
      section: { select: { code: true } },
      options: { select: { optionKey: true, text: true }, orderBy: { optionKey: "asc" } },
    },
    take: 3,
  });

  for (const q of lcSamples) {
    const promptInScript = q.audioScript!.includes(q.prompt);
    const optionsInScript = q.options.every((o) => q.audioScript!.includes(o.text));
    console.log("--- LC_SCENE ---");
    console.log("Prompt in script:", promptInScript);
    console.log("Options in script:", optionsInScript);
    console.log("Script preview:", q.audioScript!.slice(0, 300));
    console.log("");
  }

  // Check LR sample
  const lrSample = await prisma.bjtQuestion.findFirst({
    where: { section: { code: "LR_SITUATION" }, audioScript: { not: null } },
    select: {
      prompt: true,
      audioScript: true,
      options: { select: { optionKey: true, text: true }, orderBy: { optionKey: "asc" } },
    },
  });
  if (lrSample) {
    console.log("--- LR_SITUATION ---");
    console.log("Prompt in script:", lrSample.audioScript!.includes(lrSample.prompt));
    console.log("Options in script:", lrSample.options.every((o) => lrSample.audioScript!.includes(o.text)));
    console.log("Script preview:", lrSample.audioScript!.slice(0, 300));
  }

  // Check RC has no audioScript
  const rcCount = await prisma.bjtQuestion.count({
    where: { section: { code: { startsWith: "RC_" } }, audioScript: { not: null } },
  });
  console.log("\nRC questions with audioScript (should be 0):", rcCount);

  await prisma.$disconnect();
}

main();
