import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
loadEnv({ path: resolve(process.cwd(), ".env") });
const { createPrismaClient } = await import("./packages/database/src/index.js");
const { parseServerEnv } = await import("./packages/config/src/index.js");
const prisma = createPrismaClient(parseServerEnv(process.env).DATABASE_URL);
// canonical slugs = 6 practice v3 + 3 full-simulation official
const canonical = new Set(["bjt-j5-practice-v3","bjt-j4-practice-v3","bjt-j3-practice-v3","bjt-j2-practice-v3","bjt-j1-practice-v3","bjt-j1plus-practice-v3","bjt-full-simulation-a-v1","bjt-full-simulation-b-v1","bjt-full-simulation-c-v1"]);
const tests = await prisma.bjtMockTest.findMany({ select: { id: true, slug: true, type: true, sections: { select: { code: true } } } });
for (const t of tests) {
  const qCount = await prisma.bjtQuestion.count({ where: { section: { testId: t.id } } });
  const flag = canonical.has(t.slug) ? "canonical" : "EXTRA-TEST";
  console.log(`${flag}  ${t.slug}  type=${t.type}  questions=${qCount}`);
}
// any question whose test is not canonical
const extraTests = tests.filter(t => !canonical.has(t.slug));
for (const t of extraTests) {
  const qs = await prisma.bjtQuestion.findMany({ where: { section: { testId: t.id } }, select: { id: true, sourceId: true, prompt: true, skillTag: true, sourceType: true, createdAt: true } });
  for (const q of qs) console.log("EXTRA-Q", JSON.stringify({ id: q.id, sourceId: q.sourceId, test: t.slug, sourceType: q.sourceType, skillTag: q.skillTag, created: q.createdAt, prompt: q.prompt.slice(0, 80) }));
}
await prisma.$disconnect();