/**
 * Generate production BJT question images through a configured provider.
 *
 * Prerequisites:
 *   1. Choose IMAGE_PROVIDER=openai|omniroute|pollinations
 *   2. Add IMAGE_API_KEY/OPENAI_API_KEY when the provider requires one
 *   2. Run: DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt?schema=content" npx tsx data/generated/generate-ai-images.ts
 *
 * Interactive mode (default): prompts you to pick levels and confirms cost.
 * Non-interactive env vars:
 *   --dry-run / DRY_RUN=true — validate metadata and preview prompts without
 *                              requiring OpenAI/MinIO or writing anything
 *   LEVEL_FILTER  — e.g. "J3" or "J3,J4" (comma-separated)
 *   TEST_TYPE_FILTER — e.g. "official"
 *   TEST_SLUG_FILTER — comma-separated stable mock-test slugs
 *   MEDIA_FILTER  — e.g. "photo"
 *   LIMIT         — max questions to process
 *   YES           — "true" to skip confirmation prompt
 */
import "dotenv/config";
import { parseServerEnv } from "../../packages/config/src/index.js";
import { createPrismaClient, Prisma } from "../../packages/database/src/index.js";
import * as Minio from "minio";
import { createHash } from "node:crypto";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  buildBjtAiImageMetadata,
  buildBjtAiImageLicense,
  buildBjtImageGenerationPrompt,
  buildMinioPublicBaseUrl,
  resolveBjtImageMediaHint,
  validateBjtQuestionImageMetadata
} from "../../scripts/lib/bjt-question-image-metadata.js";
import {
  generateBjtImage,
  parseBjtImageGeneratorConfig,
  parseBjtPromptTranslatorConfig,
  translateBjtImagePrompt
} from "../../scripts/lib/bjt-image-generation-provider.js";

// ── Config ─────────────────────────────────────────────────────────
const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

const minioClient = new Minio.Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY
});

const BUCKET = env.MINIO_BUCKET;
const MINIO_PUBLIC_URL = buildMinioPublicBaseUrl({
  endPoint: env.MINIO_PUBLIC_ENDPOINT ?? env.MINIO_ENDPOINT,
  port: env.MINIO_PUBLIC_PORT ?? env.MINIO_PORT,
  useSSL: env.MINIO_PUBLIC_USE_SSL ?? env.MINIO_USE_SSL
});
const DRY_RUN = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");
const IMAGE_CONFIG = parseBjtImageGeneratorConfig(process.env, {
  requireCredentials: !DRY_RUN
});
const PROMPT_TRANSLATOR_CONFIG = parseBjtPromptTranslatorConfig(process.env);
const IMAGE_LICENSE = buildBjtAiImageLicense(IMAGE_CONFIG.provider, IMAGE_CONFIG.model);
const LEVEL_FILTER = process.env.LEVEL_FILTER ?? null;
const TEST_TYPE_FILTER = process.env.TEST_TYPE_FILTER?.trim() || null;
const TEST_SLUG_FILTER = (process.env.TEST_SLUG_FILTER ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const MEDIA_FILTER = process.env.MEDIA_FILTER ?? null;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
const AUTO_YES = process.env.YES === "true";

// ── Interactive prompt ─────────────────────────────────────────────
async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storageSegment(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/gu, "-")
      .replace(/^-+|-+$/gu, "") || "unknown"
  );
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log(
    `🎨 BJT AI Image Generator (${IMAGE_CONFIG.provider}/${IMAGE_CONFIG.model}, ${IMAGE_CONFIG.width}x${IMAGE_CONFIG.height})`
  );
  if (PROMPT_TRANSLATOR_CONFIG) {
    console.log(
      `🌐 Prompt translator: ${PROMPT_TRANSLATOR_CONFIG.model} via ${PROMPT_TRANSLATOR_CONFIG.baseUrl}`
    );
  }
  console.log("================================================\n");

  if (DRY_RUN) console.log("⚠️  DRY RUN — no images will be generated\n");

  // 1. Ensure bucket only for a real generation run. Dry-run must be read-only
  // and must not require a reachable MinIO service.
  if (!DRY_RUN) {
    const bucketExists = await minioClient.bucketExists(BUCKET);
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET, "us-east-1");
    }
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${BUCKET}/*`]
        }
      ]
    };
    await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));
    console.log(`✅ Bucket: ${BUCKET} (public-read)\n`);
  }

  // 2. Fetch visual questions. imageAlt is learner-facing accessibility copy;
  // imagePrompt is the authoritative AI-generation brief.
  const fetchedQuestions = await prisma.bjtQuestion.findMany({
    where: {
      OR: [{ imageAlt: { not: null } }, { imagePrompt: { not: null } }]
    },
    select: {
      id: true,
      imageAlt: true,
      imagePrompt: true,
      imageUrl: true,
      qualityFlags: true,
      section: {
        select: {
          code: true,
          test: { select: { level: true, slug: true, type: true } }
        }
      }
    },
    orderBy: [{ section: { test: { level: "asc" } } }, { section: { code: "asc" } }]
  });
  const allQuestions = fetchedQuestions.filter((question) => {
    const test = question.section?.test;
    if (TEST_TYPE_FILTER && test?.type !== TEST_TYPE_FILTER) return false;
    if (TEST_SLUG_FILTER.length > 0 && (!test?.slug || !TEST_SLUG_FILTER.includes(test.slug))) {
      return false;
    }
    return true;
  });
  if (TEST_TYPE_FILTER) console.log(`🎯 Test type filter: ${TEST_TYPE_FILTER}`);
  if (TEST_SLUG_FILTER.length > 0) {
    console.log(`🎯 Test slug filter: ${TEST_SLUG_FILTER.join(", ")}`);
  }

  // 3. Build per-level stats
  const scopeFor = (question: (typeof allQuestions)[number]) =>
    question.section?.test?.level ?? question.section?.test?.slug ?? "unknown";
  const levels = [...new Set(allQuestions.map(scopeFor))].sort();
  const levelStats = levels.map((level) => {
    const qs = allQuestions.filter((q) => scopeFor(q) === level);
    const total = qs.length;
    const aiDone = qs.filter((q) => q.imageUrl?.includes("/ai/")).length;
    const svgPlaceholder = qs.filter((q) => q.imageUrl && !q.imageUrl.includes("/ai/")).length;
    const noImage = qs.filter((q) => !q.imageUrl).length;
    const needGen = total - aiDone; // SVG placeholder + no image = need generation
    return { level, total, aiDone, svgPlaceholder, noImage, needGen };
  });

  // 4. Display status table
  console.log("📊 Image status per level:");
  console.log("┌────────┬───────┬──────────┬─────────────┬──────────┬──────────┐");
  console.log("│ Level  │ Total │ AI done  │ Placeholder │ No image │ Need gen │");
  console.log("├────────┼───────┼──────────┼─────────────┼──────────┼──────────┤");
  for (const s of levelStats) {
    console.log(
      `│ ${s.level.padEnd(6)} │ ${String(s.total).padStart(5)} │ ${String(s.aiDone).padStart(8)} │ ${String(s.svgPlaceholder).padStart(11)} │ ${String(s.noImage).padStart(8)} │ ${String(s.needGen).padStart(8)} │`
    );
  }
  const totals = levelStats.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      aiDone: acc.aiDone + s.aiDone,
      svgPlaceholder: acc.svgPlaceholder + s.svgPlaceholder,
      noImage: acc.noImage + s.noImage,
      needGen: acc.needGen + s.needGen
    }),
    { total: 0, aiDone: 0, svgPlaceholder: 0, noImage: 0, needGen: 0 }
  );
  console.log("├────────┼───────┼──────────┼─────────────┼──────────┼──────────┤");
  console.log(
    `│ TOTAL  │ ${String(totals.total).padStart(5)} │ ${String(totals.aiDone).padStart(8)} │ ${String(totals.svgPlaceholder).padStart(11)} │ ${String(totals.noImage).padStart(8)} │ ${String(totals.needGen).padStart(8)} │`
  );
  console.log("└────────┴───────┴──────────┴─────────────┴──────────┴──────────┘\n");

  // 5. Select levels
  let selectedLevels: string[];
  if (LEVEL_FILTER) {
    selectedLevels = LEVEL_FILTER.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    console.log(`🎯 Level filter (from env): ${selectedLevels.join(", ")}\n`);
  } else if (DRY_RUN) {
    selectedLevels = levels;
    console.log(`🎯 Dry-run tự động kiểm tra tất cả level: ${levels.join(", ")}\n`);
  } else {
    console.log("Chọn level cần generate ảnh:");
    levels.forEach((l, i) => {
      const s = levelStats.find((ls) => ls.level === l)!;
      const status = s.aiDone === s.total ? "✅ done" : `⏳ ${s.needGen} cần gen`;
      console.log(`  ${i + 1}. ${l} (${status})`);
    });
    console.log(`  0. Tất cả (${totals.needGen} cần gen)`);
    console.log();

    const choice = await ask("Nhập số (vd: 1 hoặc 1,3,5 hoặc 0 cho tất cả): ");
    if (choice === "0" || choice.toLowerCase() === "all") {
      selectedLevels = levels;
    } else {
      const indices = choice.split(",").map((s) => parseInt(s.trim(), 10) - 1);
      selectedLevels = indices.filter((i) => i >= 0 && i < levels.length).map((i) => levels[i]!);
    }

    if (selectedLevels.length === 0) {
      console.log("❌ Không chọn level nào. Thoát.");
      await prisma.$disconnect();
      return;
    }
    console.log(`\n🎯 Đã chọn: ${selectedLevels.join(", ")}\n`);
  }

  // 6. Filter questions for selected levels
  let questions = allQuestions.filter((q) => selectedLevels.includes(scopeFor(q)));

  if (MEDIA_FILTER) {
    questions = questions.filter((q) => {
      const qf = (q.qualityFlags ?? {}) as Record<string, unknown>;
      return resolveBjtImageMediaHint(qf) === MEDIA_FILTER;
    });
    console.log(`🎯 Media filter: ${MEDIA_FILTER}`);
  }

  // 7. Skip already-generated AI images
  const toGenerate = questions.filter((q) => !q.imageUrl?.includes("/ai/"));
  const skipped = questions.length - toGenerate.length;

  if (skipped > 0) {
    console.log(`⏭️  Bỏ qua ${skipped} câu đã có ảnh AI`);
  }

  const metadata = validateBjtQuestionImageMetadata(toGenerate);
  const metadataErrorCount = metadata.missingAlt.length + metadata.missingPrompt.length;
  console.log(
    `🧾 Metadata: ${metadata.valid.length} hợp lệ, ` +
      `${metadata.missingAlt.length} thiếu imageAlt, ` +
      `${metadata.missingPrompt.length} thiếu imagePrompt`
  );
  if (metadata.missingAlt.length > 0) {
    console.error(
      `   Thiếu imageAlt: ${metadata.missingAlt
        .slice(0, 10)
        .map((q) => q.id)
        .join(", ")}`
    );
  }
  if (metadata.missingPrompt.length > 0) {
    console.error(
      `   Thiếu imagePrompt: ${metadata.missingPrompt
        .slice(0, 10)
        .map((q) => q.id)
        .join(", ")}`
    );
  }
  if (metadataErrorCount > 0 && !DRY_RUN) {
    throw new Error(
      "Invalid BJT image metadata. Fix imageAlt/imagePrompt or scope the run before generating."
    );
  }

  let finalList = metadata.valid;
  if (LIMIT) {
    finalList = metadata.valid.slice(0, LIMIT);
    console.log(`🔢 Giới hạn: ${LIMIT} câu`);
  }

  if (finalList.length === 0) {
    console.log("\n✅ Không có câu hợp lệ nào cần generate thêm.");
    if (metadataErrorCount > 0) process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  // 8. Cost estimate & confirmation
  const COST_PER_IMAGE = IMAGE_CONFIG.provider === "openai" ? 0.011 : 0;
  const estimatedCost = finalList.length * COST_PER_IMAGE;

  // Per-level breakdown
  const genByLevel: Record<string, number> = {};
  for (const q of finalList) {
    const lv = scopeFor(q);
    genByLevel[lv] = (genByLevel[lv] ?? 0) + 1;
  }

  console.log(`\n📋 Sẽ generate ${finalList.length} ảnh:`);
  for (const [lv, cnt] of Object.entries(genByLevel).sort()) {
    const costLabel =
      IMAGE_CONFIG.provider === "openai"
        ? ` (~$${(cnt * COST_PER_IMAGE).toFixed(2)})`
        : " (free provider)";
    console.log(`   ${lv}: ${cnt} ảnh${costLabel}`);
  }
  console.log(
    IMAGE_CONFIG.provider === "openai"
      ? `\n💰 Chi phí ước tính: ~$${estimatedCost.toFixed(2)}`
      : "\n💰 Provider được cấu hình ở chế độ miễn phí; không ước tính phí API."
  );

  if (DRY_RUN) {
    console.log("\n--- DRY RUN: Sample prompts ---\n");
    for (const q of finalList.slice(0, 3)) {
      const qf = (q.qualityFlags ?? {}) as Record<string, unknown>;
      const mediaHint = resolveBjtImageMediaHint(qf);
      const sectionCode = q.section?.code ?? "";
      const prompt = buildBjtImageGenerationPrompt(mediaHint, q.imagePrompt);
      console.log(`[${scopeFor(q)}/${sectionCode}] ${mediaHint}`);
      console.log(`  Alt: ${q.imageAlt}`);
      console.log(
        `  Prompt:\n${prompt
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n")}\n`
      );
    }
    if (metadataErrorCount > 0) process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  if (!AUTO_YES) {
    const confirm = await ask("\nBắt đầu generate? (y/N): ");
    if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
      console.log("❌ Đã hủy.");
      await prisma.$disconnect();
      return;
    }
  }

  // 9. Generate one-by-one with retry (sequential to respect rate limits)
  let generated = 0;
  let errors = 0;
  const errorLog: Array<{ id: string; error: string }> = [];
  const total = finalList.length;

  for (let idx = 0; idx < total; idx++) {
    const q = finalList[idx]!;
    const qf = (q.qualityFlags ?? {}) as Record<string, unknown>;
    const mediaHint = resolveBjtImageMediaHint(qf);
    const scope = scopeFor(q);
    const sectionCode = q.section?.code ?? "unknown";
    process.stdout.write(`  [${idx + 1}/${total}] ${scope}/${sectionCode} (${mediaHint})... `);

    try {
      const translatedImagePrompt = PROMPT_TRANSLATOR_CONFIG
        ? await translateBjtImagePrompt(q.imagePrompt!, PROMPT_TRANSLATOR_CONFIG, {
            onRetry: (attempt, _error, delayMs) => {
              console.log(
                `\n    ⏳ Dịch prompt tạm lỗi — chờ ${Math.round(delayMs / 1000)}s (lần ${attempt}/${PROMPT_TRANSLATOR_CONFIG.maxAttempts})...`
              );
            }
          })
        : q.imagePrompt;
      const prompt = buildBjtImageGenerationPrompt(mediaHint, translatedImagePrompt);
      const generatedImage = await generateBjtImage(prompt, IMAGE_CONFIG, {
        onRetry: (attempt, _error, delayMs) => {
          console.log(
            `\n    ⏳ Provider tạm lỗi — chờ ${Math.round(delayMs / 1000)}s (lần ${attempt}/${IMAGE_CONFIG.maxAttempts})...`
          );
        }
      });
      const imageBuffer = generatedImage.buffer;

      // Upload to MinIO under /ai/ path
      const objectKey = `bjt/ai/${storageSegment(scope)}/${storageSegment(sectionCode)}/${q.id}.${generatedImage.extension}`;
      await minioClient.putObject(BUCKET, objectKey, imageBuffer, imageBuffer.length, {
        "Content-Type": generatedImage.mimeType
      });

      const imageUrl = `${MINIO_PUBLIC_URL}/${BUCKET}/${objectKey}`;
      const generatedAt = new Date().toISOString();
      const checksumSha256 = createHash("sha256").update(imageBuffer).digest("hex");
      const promptHashSha256 = createHash("sha256").update(prompt, "utf8").digest("hex");

      // Persist the canonical media asset and link its production metadata back
      // to the BJT question without overloading learner-facing imageAlt.
      await prisma.$transaction(async (tx) => {
        const asset = await tx.mediaAsset.upsert({
          create: {
            accessibility: { altText: q.imageAlt },
            byteSize: imageBuffer.length,
            checksumSha256,
            license: IMAGE_LICENSE,
            mimeType: generatedImage.mimeType,
            objectKey,
            provider: IMAGE_CONFIG.provider,
            provenance: {
              generatedAt,
              model: IMAGE_CONFIG.model,
              promptTranslationModel: PROMPT_TRANSLATOR_CONFIG?.model,
              promptHashSha256,
              provider: IMAGE_CONFIG.provider,
              questionId: q.id,
              source: "data/generated/generate-ai-images.ts"
            },
            rightsStatus: "cleared",
            sourceUrl: imageUrl,
            status: "active"
          },
          update: {
            accessibility: { altText: q.imageAlt },
            byteSize: imageBuffer.length,
            checksumSha256,
            license: IMAGE_LICENSE,
            provenance: {
              generatedAt,
              model: IMAGE_CONFIG.model,
              promptTranslationModel: PROMPT_TRANSLATOR_CONFIG?.model,
              promptHashSha256,
              provider: IMAGE_CONFIG.provider,
              questionId: q.id,
              source: "data/generated/generate-ai-images.ts"
            },
            rightsStatus: "cleared",
            sourceUrl: imageUrl,
            status: "active"
          },
          where: { objectKey }
        });
        await tx.bjtQuestion.update({
          data: {
            imageUrl,
            qualityFlags: {
              ...qf,
              imageGeneration: buildBjtAiImageMetadata({
                generatedAt,
                license: IMAGE_LICENSE,
                mediaAssetId: asset.id,
                model: IMAGE_CONFIG.model,
                objectKey,
                promptTranslationModel: PROMPT_TRANSLATOR_CONFIG?.model,
                promptHashSha256,
                provider: IMAGE_CONFIG.provider
              })
            } as Prisma.InputJsonObject
          },
          where: { id: q.id }
        });
      });

      generated++;
      console.log("✅");
    } catch (err) {
      errors++;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`❌ ${errMsg.slice(0, 80)}`);
      errorLog.push({ id: q.id, error: errMsg.slice(0, 200) });
    }

    // Pause between requests to stay under rate limits
    if (idx + 1 < total) {
      await sleep(3000);
    }
  }

  console.log(`\n🏁 Done: ${generated} generated, ${errors} errors`);
  if (errorLog.length > 0) {
    console.log("\n❌ Error summary:");
    for (const e of errorLog.slice(0, 10)) {
      console.log(`  - ${e.error}`);
    }
  }

  // 4. Verify
  const aiCount = await prisma.bjtQuestion.count({
    where: { imageUrl: { contains: "/ai/" } }
  });
  const totalWithImage = await prisma.bjtQuestion.count({
    where: { imageUrl: { not: null } }
  });
  console.log(`\n📊 Verification: ${aiCount} AI images, ${totalWithImage} total with image_url`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
