import { createHash } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { createPrismaClient } from "../../packages/database/src/index.js";
import { createHash as createNodeHash } from "node:crypto";
import * as Minio from "minio";
import { buildBjtImageGenerationPrompt, resolveBjtImageMediaHint } from "../lib/bjt-question-image-metadata.js";
import { OFFICIAL_MOCK_FORMS } from "../../database/scripts/seeds/bjt/official-mock-data.js";

loadEnv();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const prisma = createPrismaClient(databaseUrl);
const minio = new Minio.Client({ endPoint: process.env.MINIO_ENDPOINT ?? "127.0.0.1", port: Number(process.env.MINIO_PORT ?? 9000), useSSL: process.env.MINIO_USE_SSL === "true", accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin", secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin" });
const bucket = process.env.MINIO_BUCKET ?? "nihongo-bjt-media";
const canonical = new Set([
  "bjt-j5-practice-v3", "bjt-j4-practice-v3", "bjt-j3-practice-v3", "bjt-j2-practice-v3", "bjt-j1-practice-v3", "bjt-j1plus-practice-v3",
  "bjt-full-simulation-a-v1", "bjt-full-simulation-b-v1", "bjt-full-simulation-c-v1",
]);

function sha(value: string): string { return createHash("sha256").update(value).digest("hex"); }

const rows = await prisma.bjtQuestion.findMany({
  where: { imageUrl: { not: null }, section: { test: { slug: { in: [...canonical] } } } },
  select: { id: true, prompt: true, imageUrl: true, imagePrompt: true, qualityFlags: true, section: { select: { test: { select: { slug: true } }, code: true } } },
});
const bjtAssets = await prisma.mediaAsset.findMany({ where: { objectKey: { startsWith: "bjt/ai/" } }, select: { id: true, objectKey: true } });
const stableIdByPrompt = new Map<string, string>();
for (const form of OFFICIAL_MOCK_FORMS) {
  let index = 0;
  for (const section of form.sections) for (const question of section.questions) {
    stableIdByPrompt.set(`${form.slug}\u0000${question.prompt}`, `${form.slug}:${section.code}:${String(index).padStart(4, "0")}`);
    index += 1;
  }
}
const results: Array<Record<string, unknown>> = [];
for (const row of rows) {
  const flags = row.qualityFlags as Record<string, unknown> | null;
  const generation = flags?.imageGeneration as Record<string, unknown> | undefined;
  const assetId = typeof generation?.mediaAssetId === "string" ? generation.mediaAssetId : null;
  const asset = assetId ? await prisma.mediaAsset.findUnique({ where: { id: assetId }, select: { id: true, objectKey: true, checksumSha256: true, provenance: true, rightsStatus: true } }) : null;
  const objectKey = typeof generation?.objectKey === "string" ? generation.objectKey : null;
  const relationOk = Boolean(asset && objectKey && asset.objectKey === objectKey);
  const promptHash = typeof generation?.promptHashSha256 === "string" ? generation.promptHashSha256 : null;
  const hint = resolveBjtImageMediaHint({ mediaHint: flags?.mediaHint, stimulusKind: flags?.stimulusKind });
  const promptCompatible = Boolean(promptHash && row.imagePrompt && promptHash === sha(buildBjtImageGenerationPrompt(hint, row.imagePrompt)));
  let objectPresent = false;
  let objectByteSize: number | null = null;
  let objectChecksumSha256: string | null = null;
  if (objectKey) {
    try {
      const stat = await minio.statObject(bucket, objectKey);
      objectPresent = true;
      objectByteSize = stat.size;
      const stream = await minio.getObject(bucket, objectKey);
      const hash = createNodeHash("sha256");
      for await (const chunk of stream) hash.update(chunk as Buffer);
      objectChecksumSha256 = hash.digest("hex");
    } catch { /* report absence */ }
  }
  const checksumVerified = Boolean(asset?.checksumSha256 && objectChecksumSha256 === asset.checksumSha256);
  const legacyPromptHash = Boolean(row.imagePrompt && promptHash && !promptCompatible);
  const accepted = relationOk && objectPresent && asset?.rightsStatus === "cleared" && Boolean(row.imagePrompt);
  results.push({ questionId: row.id, stableQuestionId: stableIdByPrompt.get(`${row.section.test.slug}\u0000${row.prompt}`) ?? null, testSlug: row.section.test.slug, sectionCode: row.section.code, imageUrl: row.imageUrl, mediaAssetId: assetId, relation: relationOk ? "ok" : "broken", objectKey, objectPresent, objectByteSize, objectChecksumSha256, checksumVerified, promptCompatible, legacyPromptHash, rightsStatus: asset?.rightsStatus ?? null, classification: accepted ? "ACCEPT" : asset ? "REGENERATE" : "UNKNOWN" });
}
const orphan = bjtAssets.filter((asset) => !results.some((result) => result.mediaAssetId === asset.id)).map((asset) => ({ mediaAssetId: asset.id, objectKey: asset.objectKey, classification: "ORPHAN" }));
console.log(JSON.stringify({ total: results.length, counts: Object.fromEntries([...new Set([...results.map(r => r.classification), ...orphan.map(r => r.classification)])].map(k => [k, [...results, ...orphan].filter(r => r.classification === k).length])), results, orphan }, null, 2));
await prisma.$disconnect();
