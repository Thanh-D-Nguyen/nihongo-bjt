import { createHash } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as Minio from "minio";
import { createPrismaClient } from "../../packages/database/src/index.js";

loadEnv();
const prisma = createPrismaClient(process.env.DATABASE_URL!);
const minio = new Minio.Client({ endPoint: process.env.MINIO_ENDPOINT ?? "127.0.0.1", port: Number(process.env.MINIO_PORT ?? 9000), useSSL: process.env.MINIO_USE_SSL === "true", accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin", secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin" });
const bucket = process.env.MINIO_BUCKET ?? "nihongo-bjt-media";
const rows = await prisma.bjtQuestion.findMany({ where: { qualityFlags: { path: ["imageGeneration", "provider"], equals: "xkiro" } }, select: { id: true, imageUrl: true, imageAlt: true, imagePrompt: true, qualityFlags: true, section: { select: { code: true, test: { select: { slug: true, type: true } } } } } });
const assets = [];
for (const row of rows) {
  const generation = (row.qualityFlags as any)?.imageGeneration ?? {};
  let objectPresent = false; let checksumMatches = false; let byteSize: number | null = null;
  try {
    const stat = await minio.statObject(bucket, generation.objectKey);
    objectPresent = true; byteSize = stat.size;
    const stream = await minio.getObject(bucket, generation.objectKey); const hash = createHash("sha256");
    for await (const chunk of stream) hash.update(chunk as Buffer);
    checksumMatches = hash.digest("hex") === (await prisma.mediaAsset.findUnique({ where: { id: generation.mediaAssetId }, select: { checksumSha256: true } }))?.checksumSha256;
  } catch { /* status remains HUMAN_REVIEW with storage failure recorded */ }
  assets.push({ questionId: row.id, testSlug: row.section.test.slug, testType: row.section.test.type, sectionCode: row.section.code, model: generation.model, provider: generation.provider, objectKey: generation.objectKey, mediaAssetId: generation.mediaAssetId, promptHashSha256: generation.promptHashSha256, imageUrl: row.imageUrl, objectPresent, byteSize, checksumMatches, visualQaStatus: "HUMAN_REVIEW", qaChecks: { contextAlignment: null, participantsRoles: null, actionContext: null, workplacePlausibility: null, misleadingEvidence: null, inventedCriticalInfo: null, hallucinatedText: null, visualClarity: null, pedagogicalUsefulness: null, styleConsistency: null } });
}
const report = { version: "p6c-ai-batch-1", provider: "xkiro", model: "gpt-image", configuredConcurrency: 2, observedCapacityLimit: 3, attempted: 16, generatedOrResumed: assets.length, accepted: 0, regenerate: 0, rejected: 0, humanReview: assets.length, blockedOrFailed: 6, retry429: 6, assets };
await writeFile(resolve(process.cwd(), "audit/p6c-ai-batch-1-qa.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ attempted: report.attempted, generatedOrResumed: report.generatedOrResumed, humanReview: report.humanReview, objectMissing: assets.filter((asset) => !asset.objectPresent).length, checksumMismatch: assets.filter((asset) => !asset.checksumMatches).length }));
await prisma.$disconnect();
