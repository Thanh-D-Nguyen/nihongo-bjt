/**
 * Generate AI images for BJT questions using OpenAI gpt-image-1.
 *
 * Prerequisites:
 *   1. Add OPENAI_API_KEY to .env
 *   2. Run: DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt?schema=content" npx tsx data/generated/generate-ai-images.ts
 *
 * Interactive mode (default): prompts you to pick levels and confirms cost.
 * Non-interactive env vars:
 *   DRY_RUN       — "true" to preview prompts without generating
 *   LEVEL_FILTER  — e.g. "J3" or "J3,J4" (comma-separated)
 *   MEDIA_FILTER  — e.g. "photo"
 *   LIMIT         — max questions to process
 *   YES           — "true" to skip confirmation prompt
 */
import "dotenv/config";
import { createPrismaClient } from "../../packages/database/src/index.js";
import OpenAI from "openai";
import * as Minio from "minio";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

// ── Config ─────────────────────────────────────────────────────────
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not set. Add it to .env and try again.");
  process.exit(1);
}

const prisma = createPrismaClient();
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const minioClient = new Minio.Client({
  endPoint: "127.0.0.1",
  port: 9000,
  useSSL: false,
  accessKey: "minioadmin",
  secretKey: "minioadmin",
});

const BUCKET = "bjt-images";
const MINIO_PUBLIC_URL = "http://localhost:9000";
const DRY_RUN = process.env.DRY_RUN === "true";
const LEVEL_FILTER = process.env.LEVEL_FILTER ?? null;
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

// ── Prompt templates per media type ────────────────────────────────
function buildImagePrompt(mediaHint: string, imageAlt: string, sectionCode: string): string {
  const baseStyle = "Clean, professional, photorealistic style. No text overlays, no watermarks, no logos. Suitable as a test question illustration.";

  switch (mediaHint) {
    case "photo":
      return [
        `A professional business photograph for a Japanese BJT (Business Japanese Test) question.`,
        `Scene description: ${imageAlt}`,
        `Style: ${baseStyle}`,
        `Setting: Modern Japanese office or business environment.`,
        `People should be dressed in standard Japanese business attire (suits, business casual).`,
        `The scene should clearly depict the described business situation.`,
        `Warm, natural lighting. Shot from a natural observer angle.`,
      ].join("\n");

    case "illustration":
      return [
        `A clean, modern illustration for a Japanese BJT (Business Japanese Test) question.`,
        `Scene description: ${imageAlt}`,
        `Style: Clean vector-style illustration, flat design with subtle shadows. ${baseStyle}`,
        `Setting: Japanese business environment depicted in illustration style.`,
        `Use a warm but professional color palette (navy, white, soft blue accents).`,
        `Characters should be simple but recognizable business people.`,
      ].join("\n");

    case "chart":
      return [
        `A professional business chart or graph for a Japanese BJT (Business Japanese Test) question.`,
        `Chart description: ${imageAlt}`,
        `Style: Clean infographic style. ${baseStyle}`,
        `Use a professional color scheme (blues, grays, with one accent color).`,
        `The chart should look like it comes from a Japanese business presentation or report.`,
        `Include axis labels and data points in Japanese where appropriate.`,
        `Make the data patterns clear and readable.`,
      ].join("\n");

    case "document":
      return [
        `A Japanese business document or form for a BJT (Business Japanese Test) question.`,
        `Document description: ${imageAlt}`,
        `Style: Realistic document layout. ${baseStyle}`,
        `The document should look like an authentic Japanese business document.`,
        `Include realistic-looking Japanese text layout (vertical or horizontal).`,
        `Use standard Japanese business document formatting.`,
      ].join("\n");

    default:
      return [
        `A professional image for a Japanese BJT question.`,
        `Description: ${imageAlt}`,
        `Style: ${baseStyle}`,
      ].join("\n");
  }
}

// ── Image generation ───────────────────────────────────────────────
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 15_000; // 15s initial backoff for 429

async function generateImage(prompt: string): Promise<Buffer> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "low",
      });

      const imageData = response.data?.[0];

      // gpt-image-1 returns b64_json by default
      if (imageData?.b64_json) {
        return Buffer.from(imageData.b64_json, "base64");
      }

      // Fallback: download from URL if provided
      if (imageData?.url) {
        const res = await fetch(imageData.url);
        if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      }

      throw new Error("No image data returned from OpenAI");
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const isRateLimit = status === 429;

      if (isRateLimit && attempt < MAX_RETRIES) {
        // Exponential backoff: 15s, 30s, 60s, 120s, 240s
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`    ⏳ Rate limit — waiting ${Math.round(delay / 1000)}s (retry ${attempt + 1}/${MAX_RETRIES})...`);
        await sleep(delay);
        continue;
      }

      throw err;
    }
  }

  throw new Error("Max retries exceeded");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log("🎨 BJT AI Image Generator (OpenAI gpt-image-1)");
  console.log("================================================\n");

  if (DRY_RUN) console.log("⚠️  DRY RUN — no images will be generated\n");

  // 1. Ensure bucket
  const bucketExists = await minioClient.bucketExists(BUCKET);
  if (!bucketExists) {
    await minioClient.makeBucket(BUCKET, "us-east-1");
  }
  const policy = {
    Version: "2012-10-17",
    Statement: [{
      Effect: "Allow",
      Principal: { AWS: ["*"] },
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${BUCKET}/*`],
    }],
  };
  await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));
  console.log(`✅ Bucket: ${BUCKET} (public-read)\n`);

  // 2. Fetch ALL questions with image_alt to show stats
  const allQuestions = await prisma.bjtQuestion.findMany({
    where: { imageAlt: { not: null } },
    select: {
      id: true,
      imageAlt: true,
      imageUrl: true,
      qualityFlags: true,
      section: {
        select: {
          code: true,
          test: { select: { level: true } },
        },
      },
    },
    orderBy: [
      { section: { test: { level: "asc" } } },
      { section: { code: "asc" } },
    ],
  });

  // 3. Build per-level stats
  const levels = [...new Set(allQuestions.map((q) => q.section?.test?.level ?? "unknown"))].sort();
  const levelStats = levels.map((level) => {
    const qs = allQuestions.filter((q) => (q.section?.test?.level ?? "unknown") === level);
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
      needGen: acc.needGen + s.needGen,
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
    selectedLevels = LEVEL_FILTER.split(",").map((s) => s.trim()).filter(Boolean);
    console.log(`🎯 Level filter (from env): ${selectedLevels.join(", ")}\n`);
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
      selectedLevels = indices
        .filter((i) => i >= 0 && i < levels.length)
        .map((i) => levels[i]!);
    }

    if (selectedLevels.length === 0) {
      console.log("❌ Không chọn level nào. Thoát.");
      await prisma.$disconnect();
      return;
    }
    console.log(`\n🎯 Đã chọn: ${selectedLevels.join(", ")}\n`);
  }

  // 6. Filter questions for selected levels
  let questions = allQuestions.filter((q) =>
    selectedLevels.includes(q.section?.test?.level ?? "")
  );

  if (MEDIA_FILTER) {
    questions = questions.filter((q) => {
      const qf = (q.qualityFlags ?? {}) as Record<string, unknown>;
      return (qf.mediaHint as string) === MEDIA_FILTER;
    });
    console.log(`🎯 Media filter: ${MEDIA_FILTER}`);
  }

  // 7. Skip already-generated AI images
  const toGenerate = questions.filter((q) => !q.imageUrl?.includes("/ai/"));
  const skipped = questions.length - toGenerate.length;

  if (skipped > 0) {
    console.log(`⏭️  Bỏ qua ${skipped} câu đã có ảnh AI`);
  }

  let finalList = toGenerate;
  if (LIMIT) {
    finalList = toGenerate.slice(0, LIMIT);
    console.log(`🔢 Giới hạn: ${LIMIT} câu`);
  }

  if (finalList.length === 0) {
    console.log("\n✅ Tất cả câu đã có ảnh AI! Không cần generate thêm.");
    await prisma.$disconnect();
    return;
  }

  // 8. Cost estimate & confirmation
  const COST_PER_IMAGE = 0.011; // gpt-image-1 low quality 1024x1024
  const estimatedCost = finalList.length * COST_PER_IMAGE;

  // Per-level breakdown
  const genByLevel: Record<string, number> = {};
  for (const q of finalList) {
    const lv = q.section?.test?.level ?? "?";
    genByLevel[lv] = (genByLevel[lv] ?? 0) + 1;
  }

  console.log(`\n📋 Sẽ generate ${finalList.length} ảnh:`);
  for (const [lv, cnt] of Object.entries(genByLevel).sort()) {
    console.log(`   ${lv}: ${cnt} ảnh (~$${(cnt * COST_PER_IMAGE).toFixed(2)})`);
  }
  console.log(`\n💰 Chi phí ước tính: ~$${estimatedCost.toFixed(2)}`);

  if (DRY_RUN) {
    console.log("\n--- DRY RUN: Sample prompts ---\n");
    for (const q of finalList.slice(0, 3)) {
      const qf = (q.qualityFlags ?? {}) as Record<string, unknown>;
      const mediaHint = (qf.mediaHint as string) ?? "photo";
      const sectionCode = q.section?.code ?? "";
      const prompt = buildImagePrompt(mediaHint, q.imageAlt ?? "", sectionCode);
      console.log(`[${q.section?.test?.level}/${sectionCode}] ${mediaHint}`);
      console.log(`  Alt: ${q.imageAlt}`);
      console.log(`  Prompt:\n${prompt.split("\n").map((l) => `    ${l}`).join("\n")}\n`);
    }
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
    const mediaHint = (qf.mediaHint as string) ?? "photo";
    const level = q.section?.test?.level ?? "unknown";
    const sectionCode = q.section?.code ?? "unknown";
    const prompt = buildImagePrompt(mediaHint, q.imageAlt ?? "", sectionCode);

    process.stdout.write(`  [${idx + 1}/${total}] ${level}/${sectionCode} (${mediaHint})... `);

    try {
      const imageBuffer = await generateImage(prompt);

      // Upload to MinIO under /ai/ path
      const objectKey = `bjt/ai/${level}/${sectionCode}/${q.id}.png`;
      await minioClient.putObject(BUCKET, objectKey, imageBuffer, imageBuffer.length, {
        "Content-Type": "image/png",
      });

      const imageUrl = `${MINIO_PUBLIC_URL}/${BUCKET}/${objectKey}`;

      // Update DB
      await prisma.bjtQuestion.update({
        where: { id: q.id },
        data: { imageUrl },
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
    where: { imageUrl: { contains: "/ai/" } },
  });
  const totalWithImage = await prisma.bjtQuestion.count({
    where: { imageUrl: { not: null } },
  });
  console.log(`\n📊 Verification: ${aiCount} AI images, ${totalWithImage} total with image_url`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
