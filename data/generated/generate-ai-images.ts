/**
 * Generate production BJT question images through a configured provider.
 *
 * Prerequisites:
 *   1. Choose IMAGE_PROVIDER=openai|omniroute|pollinations|xkiro
 *   2. Add IMAGE_API_KEY (or OPENAI_API_KEY / XKIRO_API_KEY) when the provider requires one
 *   3. Run: DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt?schema=content" npx tsx data/generated/generate-ai-images.ts
 *
 * The script writes to whatever DATABASE_URL / MINIO_* pair it is given, so the
 * same command generates against local or straight against production. Writing
 * to a non-local target additionally requires ALLOW_REMOTE_TARGET=true.
 *
 * Interactive mode (default): prompts you to pick levels and confirms cost.
 * Non-interactive env vars:
 *   --dry-run / DRY_RUN=true — validate metadata and preview prompts without
 *                              requiring a provider/MinIO or writing anything
 *   LEVEL_FILTER  — e.g. "J3" or "J3,J4" (comma-separated)
 *   TEST_TYPE_FILTER — e.g. "official"
 *   TEST_SLUG_FILTER — comma-separated stable mock-test slugs
 *   MEDIA_FILTER  — e.g. "photo"
 *   LIMIT         — max questions to process
 *   YES           — "true" to skip confirmation prompt
 *   FORCE_REGENERATE — "true" to regenerate questions that already have an AI image
 *   ALLOW_REMOTE_TARGET — "true" to allow writing to a non-local DATABASE_URL
 *   IMAGE_CONCURRENCY — parallel jobs (default 3 for async-job providers, 1 otherwise)
 *   IMAGE_JOB_CHECKPOINT — path for the resumable async job checkpoint
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
  createBjtImageJob,
  generateBjtImage,
  isBlockedImageError,
  parseBjtImageGeneratorConfig,
  parseBjtPromptTranslatorConfig,
  providerUsesAsyncImageJobs,
  resolveBjtImageJob,
  translateBjtImagePrompt,
  type BjtGeneratedImage
} from "../../scripts/lib/bjt-image-generation-provider.js";
import {
  emptyBjtImageJobCheckpoint,
  forgetBjtImageJob,
  readBjtImageJobCheckpoint,
  rememberBjtImageJob,
  resumableBjtImageJobId,
  writeBjtImageJobCheckpoint,
  type BjtImageJobCheckpoint
} from "../../scripts/lib/bjt-image-job-store.js";

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
const USES_ASYNC_JOBS = providerUsesAsyncImageJobs(IMAGE_CONFIG.provider);
const LEVEL_FILTER = process.env.LEVEL_FILTER ?? null;
const TEST_TYPE_FILTER = process.env.TEST_TYPE_FILTER?.trim() || null;
const TEST_SLUG_FILTER = (process.env.TEST_SLUG_FILTER ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const MEDIA_FILTER = process.env.MEDIA_FILTER ?? null;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
const PILOT_IDS = (process.env.PILOT_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
const AUTO_YES = process.env.YES === "true";
const FORCE_REGENERATE = process.env.FORCE_REGENERATE === "true";
const ALLOW_REMOTE_TARGET = process.env.ALLOW_REMOTE_TARGET === "true";
const JOB_CHECKPOINT_PATH =
  process.env.IMAGE_JOB_CHECKPOINT?.trim() || "tmp/bjt-image-jobs.json";
// Spacing between requests inside one worker. Inline providers are rate-limited
// per request; async-job providers only need a light stagger so a batch does not
// slam the queue cap in one burst.
const PACE_MS = parseInt(process.env.IMAGE_PACE_MS ?? (USES_ASYNC_JOBS ? "500" : "3000"), 10);

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

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function databaseTargetLabel(databaseUrl: string): { host: string; isLocal: boolean } {
  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname;
    return {
      host: `${host}:${parsed.port || "5432"}${parsed.pathname}`,
      isLocal: ["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"].includes(host)
    };
  } catch {
    return { host: "unparseable DATABASE_URL", isLocal: false };
  }
}

/** Run `worker` over `items` with at most `limit` in flight. */
async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: workerCount }, async (_unused, lane) => {
    // Stagger lane starts so concurrent submissions do not land in one burst.
    if (lane > 0) await sleep(lane * Math.min(PACE_MS, 1_000));
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index]!, index);
      if (cursor < items.length && PACE_MS > 0) await sleep(PACE_MS);
    }
  });
  await Promise.all(runners);
}

// ── Async job checkpoint (serialized writes) ───────────────────────
let checkpoint: BjtImageJobCheckpoint = emptyBjtImageJobCheckpoint();
let checkpointQueue: Promise<void> = Promise.resolve();

function updateCheckpoint(
  mutate: (current: BjtImageJobCheckpoint) => BjtImageJobCheckpoint
): Promise<void> {
  checkpointQueue = checkpointQueue.then(async () => {
    checkpoint = mutate(checkpoint);
    try {
      await writeBjtImageJobCheckpoint(JOB_CHECKPOINT_PATH, checkpoint);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`    ⚠️  Không ghi được job checkpoint (${JOB_CHECKPOINT_PATH}): ${msg}`);
    }
  });
  return checkpointQueue;
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  const target = databaseTargetLabel(env.DATABASE_URL);

  console.log(
    `🎨 BJT AI Image Generator (${IMAGE_CONFIG.provider}/${IMAGE_CONFIG.model}, ${IMAGE_CONFIG.width}x${IMAGE_CONFIG.height})`
  );
  console.log(`   Mode:        ${USES_ASYNC_JOBS ? "async job queue" : "inline request"}`);
  console.log(`   Concurrency: ${IMAGE_CONFIG.concurrency}`);
  if (USES_ASYNC_JOBS) {
    console.log(
      `   Poll:        every ${IMAGE_CONFIG.pollIntervalMs}ms, giving up after ${IMAGE_CONFIG.pollTimeoutMs}ms`
    );
    console.log(`   Checkpoint:  ${JOB_CHECKPOINT_PATH}`);
  }
  console.log(`   Target DB:   ${target.host}${target.isLocal ? " (local)" : " ⚠️  REMOTE"}`);
  console.log(`   Target MinIO: ${MINIO_PUBLIC_URL}/${BUCKET}`);
  if (PROMPT_TRANSLATOR_CONFIG) {
    console.log(
      `🌐 Prompt translator: ${PROMPT_TRANSLATOR_CONFIG.model} via ${PROMPT_TRANSLATOR_CONFIG.baseUrl}`
    );
  }
  console.log("================================================\n");

  if (DRY_RUN) console.log("⚠️  DRY RUN — no images will be generated\n");

  // Writing image URLs into a remote (production) database must be deliberate.
  if (!DRY_RUN && !target.isLocal && !ALLOW_REMOTE_TARGET) {
    throw new Error(
      `Refusing to write to non-local database ${target.host}. Re-run with ALLOW_REMOTE_TARGET=true if this is intended.`
    );
  }

  if (USES_ASYNC_JOBS && !DRY_RUN) {
    checkpoint = await readBjtImageJobCheckpoint(JOB_CHECKPOINT_PATH);
    const pending = Object.keys(checkpoint.jobs).length;
    if (pending > 0) console.log(`♻️  Checkpoint có ${pending} job đang chờ — sẽ thử resume.\n`);
  }

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
    if (PILOT_IDS.length > 0 && !PILOT_IDS.includes(question.id)) return false;
    return true;
  });
  if (TEST_TYPE_FILTER) console.log(`🎯 Test type filter: ${TEST_TYPE_FILTER}`);
  if (TEST_SLUG_FILTER.length > 0) {
    console.log(`🎯 Test slug filter: ${TEST_SLUG_FILTER.join(", ")}`);
  }
  if (PILOT_IDS.length > 0) console.log(`🎯 Pilot ID filter: ${PILOT_IDS.length} question IDs`);

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
  } else if (AUTO_YES) {
    selectedLevels = levels;
    console.log(`🎯 YES=true → chạy tất cả level: ${levels.join(", ")}\n`);
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
  const toGenerate = FORCE_REGENERATE
    ? questions
    : questions.filter((q) => !q.imageUrl?.includes("/ai/"));
  const skipped = questions.length - toGenerate.length;

  if (FORCE_REGENERATE) {
    console.log("♻️  FORCE_REGENERATE=true — sinh lại cả những câu đã có ảnh AI");
  } else if (skipped > 0) {
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
  const BILLED_PER_IMAGE = IMAGE_CONFIG.provider === "xkiro";

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
        : BILLED_PER_IMAGE
          ? ` (${cnt} billable unit)`
          : " (free provider)";
    console.log(`   ${lv}: ${cnt} ảnh${costLabel}`);
  }
  console.log(
    IMAGE_CONFIG.provider === "openai"
      ? `\n💰 Chi phí ước tính: ~$${estimatedCost.toFixed(2)}`
      : BILLED_PER_IMAGE
        ? `\n💰 xKiro tính 1 đơn vị / ảnh bất kể size → ~${finalList.length} đơn vị (job bị "blocked" vẫn bị tính).`
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

  // 9. Generate with bounded concurrency. Async-job providers overlap jobs;
  // inline providers stay at concurrency 1 to respect per-request rate limits.
  let generated = 0;
  let errors = 0;
  let blocked = 0;
  let resumed = 0;
  const errorLog: Array<{ id: string; error: string }> = [];
  const total = finalList.length;

  await runWithConcurrency(finalList, IMAGE_CONFIG.concurrency, async (q, idx) => {
    const qf = (q.qualityFlags ?? {}) as Record<string, unknown>;
    const mediaHint = resolveBjtImageMediaHint(qf);
    const scope = scopeFor(q);
    const sectionCode = q.section?.code ?? "unknown";
    const label = `[${idx + 1}/${total}] ${scope}/${sectionCode} (${mediaHint})`;
    // Hash the source brief, not the translated prompt: translation output is
    // not byte-stable, and the checkpoint must still match on a re-run.
    const briefHashSha256 = sha256(`${mediaHint}\n${q.imagePrompt}`);

    try {
      let generatedImage: BjtGeneratedImage;
      let prompt: string;

      const resumableJobId = USES_ASYNC_JOBS
        ? resumableBjtImageJobId(checkpoint, q.id, {
            model: IMAGE_CONFIG.model,
            promptHashSha256: briefHashSha256,
            provider: IMAGE_CONFIG.provider
          })
        : null;

      if (resumableJobId) {
        console.log(`  ${label} ♻️  resume job ${resumableJobId}`);
        try {
          generatedImage = await resolveBjtImageJob(resumableJobId, IMAGE_CONFIG);
          // The exact submitted prompt is not recoverable from the job, so
          // record the untranslated brief for provenance.
          prompt = buildBjtImageGenerationPrompt(mediaHint, q.imagePrompt);
          resumed += 1;
        } catch (resumeError) {
          const msg = resumeError instanceof Error ? resumeError.message : String(resumeError);
          await updateCheckpoint((current) => forgetBjtImageJob(current, q.id));
          if (isBlockedImageError(resumeError)) throw resumeError;
          console.log(`  ${label} ⚠️  resume thất bại (${msg.slice(0, 80)}) — submit job mới`);
          const result = await generateOne(q, mediaHint, briefHashSha256, label);
          prompt = result.prompt;
          generatedImage = result.image;
        }
      } else {
        const result = await generateOne(q, mediaHint, briefHashSha256, label);
        prompt = result.prompt;
        generatedImage = result.image;
      }

      const imageBuffer = generatedImage.buffer;

      // Upload to MinIO under /ai/ path
      const objectKey = `bjt/ai/${storageSegment(scope)}/${storageSegment(sectionCode)}/${q.id}.${generatedImage.extension}`;
      await minioClient.putObject(BUCKET, objectKey, imageBuffer, imageBuffer.length, {
        "Content-Type": generatedImage.mimeType
      });

      const imageUrl = `${MINIO_PUBLIC_URL}/${BUCKET}/${objectKey}`;
      const generatedAt = new Date().toISOString();
      const checksumSha256 = createHash("sha256").update(imageBuffer).digest("hex");
      const promptHashSha256 = sha256(prompt);

      // Persist the canonical media asset and link its production metadata back
      // to the BJT question without overloading learner-facing imageAlt.
      await prisma.$transaction(async (tx) => {
        const provenance = {
          generatedAt,
          model: IMAGE_CONFIG.model,
          promptTranslationModel: PROMPT_TRANSLATOR_CONFIG?.model,
          promptHashSha256,
          provider: IMAGE_CONFIG.provider,
          questionId: q.id,
          source: "data/generated/generate-ai-images.ts"
        };
        const asset = await tx.mediaAsset.upsert({
          create: {
            accessibility: { altText: q.imageAlt },
            byteSize: imageBuffer.length,
            checksumSha256,
            license: IMAGE_LICENSE,
            mimeType: generatedImage.mimeType,
            objectKey,
            provider: IMAGE_CONFIG.provider,
            provenance,
            rightsStatus: "cleared",
            sourceUrl: imageUrl,
            status: "active"
          },
          update: {
            accessibility: { altText: q.imageAlt },
            byteSize: imageBuffer.length,
            checksumSha256,
            license: IMAGE_LICENSE,
            provenance,
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

      // The image is durably stored; the job no longer needs resuming.
      if (USES_ASYNC_JOBS) {
        await updateCheckpoint((current) => forgetBjtImageJob(current, q.id));
      }

      generated += 1;
      console.log(`  ${label} ✅`);
    } catch (err) {
      errors += 1;
      const errMsg = err instanceof Error ? err.message : String(err);
      if (isBlockedImageError(err)) {
        blocked += 1;
        console.log(`  ${label} 🚫 blocked: ${errMsg.slice(0, 80)}`);
      } else {
        console.log(`  ${label} ❌ ${errMsg.slice(0, 80)}`);
      }
      errorLog.push({ id: q.id, error: errMsg.slice(0, 200) });
    }
  });

  await checkpointQueue;

  console.log(`\n🏁 Done: ${generated} generated, ${resumed} resumed, ${errors} errors`);
  if (blocked > 0) {
    console.log(
      `   🚫 ${blocked} câu bị provider từ chối (blocked) — cần sửa imagePrompt rồi chạy lại.`
    );
  }
  if (errorLog.length > 0) {
    console.log("\n❌ Error summary:");
    for (const e of errorLog.slice(0, 10)) {
      console.log(`  - ${e.id}: ${e.error}`);
    }
    if (errorLog.length > 10) console.log(`  … và ${errorLog.length - 10} lỗi khác`);
  }

  // 10. Verify
  const aiCount = await prisma.bjtQuestion.count({
    where: { imageUrl: { contains: "/ai/" } }
  });
  const totalWithImage = await prisma.bjtQuestion.count({
    where: { imageUrl: { not: null } }
  });
  console.log(`\n📊 Verification: ${aiCount} AI images, ${totalWithImage} total with image_url`);

  if (errors > 0) process.exitCode = 1;

  await prisma.$disconnect();
}

/**
 * Translate the brief (when configured), submit the job, and wait for bytes.
 * For async-job providers the job id is checkpointed the moment it exists, so
 * an interrupted run resumes rather than re-submitting a billable job.
 */
async function generateOne(
  question: { id: string; imagePrompt: string | null },
  mediaHint: string,
  briefHashSha256: string,
  label: string
): Promise<{ image: BjtGeneratedImage; prompt: string }> {
  const translatedImagePrompt = PROMPT_TRANSLATOR_CONFIG
    ? await translateBjtImagePrompt(question.imagePrompt!, PROMPT_TRANSLATOR_CONFIG, {
        onRetry: (attempt, _error, delayMs) => {
          console.log(
            `  ${label} ⏳ Dịch prompt tạm lỗi — chờ ${Math.round(delayMs / 1000)}s (lần ${attempt}/${PROMPT_TRANSLATOR_CONFIG.maxAttempts})...`
          );
        }
      })
    : question.imagePrompt;
  const prompt = buildBjtImageGenerationPrompt(mediaHint, translatedImagePrompt);

  const image = await generateBjtImage(prompt, IMAGE_CONFIG, {
    onJobCreated: async (job) => {
      await updateCheckpoint((current) =>
        rememberBjtImageJob(current, question.id, {
          jobId: job.id,
          model: IMAGE_CONFIG.model,
          promptHashSha256: briefHashSha256,
          provider: IMAGE_CONFIG.provider,
          submittedAt: new Date().toISOString()
        })
      );
    },
    onRetry: (attempt, _error, delayMs) => {
      console.log(
        `  ${label} ⏳ Provider tạm lỗi — chờ ${Math.round(delayMs / 1000)}s (lần ${attempt}/${IMAGE_CONFIG.maxAttempts})...`
      );
    }
  });

  return { image, prompt };
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
