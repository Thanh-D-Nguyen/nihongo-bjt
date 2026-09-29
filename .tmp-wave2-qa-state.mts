import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
loadEnv({ path: resolve(process.cwd(), ".env") });
const { createPrismaClient } = await import("./packages/database/src/index.js");
const { parseServerEnv } = await import("./packages/config/src/index.js");
const prisma = createPrismaClient(parseServerEnv(process.env).DATABASE_URL);
const scope = (await import("./audit/high-wave2-db-scope.json", { with: { type: "json" } })).default;
const qids = new Set(scope.candidates.map(c => c.questionId));
const qs = await prisma.bjtQuestion.findMany({
  where: { sourceId: { in: [...qids] } },
  select: { id: true, sourceId: true, mediaAssets: true }
});
for (const q of qs) {
  for (const m of q.mediaAssets) {
    console.log(JSON.stringify({
      sourceId: q.sourceId, assetId: m.id, objectKey: m.objectKey,
      status: m.status, lifecycle: m.lifecycleState, metadata: m.metadata
    }));
  }
}
await prisma.$disconnect();