/**
 * Batch TTS generation for BJT questions using local OmniVoice server.
 *
 * ─── Prerequisites ─────────────────────────────────────────────────────────
 *
 * 1. Install OmniVoice server locally:
 *    ```bash
 *    pip install omnivoice
 *    # Or with uv:
 *    git clone https://github.com/k2-fsa/OmniVoice.git && cd OmniVoice && uv sync
 *    ```
 *
 * 2. Start the OmniVoice inference server (Gradio web UI acts as API):
 *    ```bash
 *    omnivoice-demo --ip 0.0.0.0 --port 8001
 *    ```
 *    Or use the batch CLI directly (this script supports both modes).
 *
 * 3. Prepare a Japanese reference audio (3-10s) for voice cloning quality:
 *    - Place at: data/tts-ref/ja-female-announcer.wav
 *    - Use a clean NHK-style announcer voice for BJT formality
 *
 * 4. Ensure MinIO is running (docker in WSL)
 *
 * ─── Usage ─────────────────────────────────────────────────────────────────
 *
 *   # Preview what would be generated (dry run)
 *   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt" \
 *     npx tsx scripts/generate-bjt-audio.ts --dry-run
 *
 *   # Generate audio for all questions with audioScript but no audioUrl
 *   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt" \
 *     npx tsx scripts/generate-bjt-audio.ts
 *
 *   # Generate for specific section only
 *   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt" \
 *     npx tsx scripts/generate-bjt-audio.ts --section J1-listening
 *
 *   # Regenerate ALL (overwrite existing audioUrl)
 *   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt" \
 *     npx tsx scripts/generate-bjt-audio.ts --force
 *
 *   # Use custom OmniVoice endpoint
 *   OMNIVOICE_URL=http://192.168.1.100:8001 \
 *     npx tsx scripts/generate-bjt-audio.ts
 *
 * ─── Environment Variables ─────────────────────────────────────────────────
 *
 *   DATABASE_URL          — PostgreSQL connection string (required)
 *   OMNIVOICE_URL         — OmniVoice server URL (default: http://localhost:8001)
 *   OMNIVOICE_REF_AUDIO   — Path to reference audio for voice cloning
 *                            (default: data/tts-ref/ja-female-announcer.wav)
 *   OMNIVOICE_REF_TEXT    — Transcript of reference audio (optional, Whisper auto-transcribes)
 *   MINIO_ENDPOINT        — MinIO host (default: 127.0.0.1)
 *   MINIO_PORT            — MinIO port (default: 19000)
 *   MINIO_ACCESS_KEY      — MinIO access key (default: minioadmin)
 *   MINIO_SECRET_KEY      — MinIO secret key (default: minioadmin)
 *   MINIO_BUCKET          — Bucket name (default: nihongo-bjt)
 */
import "dotenv/config";
import { createPrismaClient } from "../packages/database/src/index.js";
import * as Minio from "minio";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Config ─────────────────────────────────────────────────────────────────

const OMNIVOICE_URL = process.env.OMNIVOICE_URL ?? "http://localhost:8001";
const REF_AUDIO_PATH = process.env.OMNIVOICE_REF_AUDIO ?? "data/tts-ref/ja-female-announcer.wav";
const REF_TEXT = process.env.OMNIVOICE_REF_TEXT ?? undefined;

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? "127.0.0.1";
const MINIO_PORT = parseInt(process.env.MINIO_PORT ?? "19000", 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? "minioadmin";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? "minioadmin";
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? "nihongo-bjt";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const SECTION_FILTER = (() => {
  const idx = process.argv.indexOf("--section");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

// ── Clients ────────────────────────────────────────────────────────────────

const prisma = createPrismaClient();

const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: false,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

// ── OmniVoice API ─────────────────────────────────────────────────────────

/**
 * Call OmniVoice Gradio API for TTS synthesis.
 * The Gradio app exposes a /api/predict endpoint.
 * If server doesn't expose REST, we fall back to CLI batch mode.
 */
async function synthesizeWithOmniVoice(text: string): Promise<Buffer> {
  // Try Gradio API first (omnivoice-demo exposes this)
  const response = await fetch(`${OMNIVOICE_URL}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [
        text,                    // Input text
        REF_AUDIO_PATH,         // Reference audio path (server-local)
        REF_TEXT ?? "",          // Reference text (empty = auto-transcribe)
        "",                      // Instruct (voice design — unused in clone mode)
        32,                      // num_step (diffusion steps)
        1.0,                     // speed
      ],
      fn_index: 0,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OmniVoice API error ${response.status}: ${err}`);
  }

  const result = await response.json() as { data: string[] };
  // Gradio returns file path(s) for audio output
  const audioPath = result.data[0];

  if (!audioPath) throw new Error("OmniVoice returned empty audio path");

  // If the audio is returned as a file path on the server, download it
  if (audioPath.startsWith("http")) {
    const audioRes = await fetch(audioPath);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);
    return Buffer.from(await audioRes.arrayBuffer());
  }

  // If it's a local path (same machine), read directly
  if (fs.existsSync(audioPath)) {
    return fs.readFileSync(audioPath);
  }

  // Try as Gradio file endpoint
  const fileUrl = `${OMNIVOICE_URL}/file=${audioPath}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error(`Failed to fetch audio from ${fileUrl}: ${fileRes.status}`);
  return Buffer.from(await fileRes.arrayBuffer());
}

/**
 * Alternative: Use omnivoice-infer CLI directly (more reliable for batch).
 * Writes to a temp file and reads back.
 */
async function synthesizeWithCli(text: string, outputPath: string): Promise<Buffer> {
  const { execFileSync } = await import("node:child_process");

  const args = [
    "--model",
    "k2-fsa/OmniVoice",
    "--text",
    text,
    "--output",
    outputPath,
    "--num_step",
    "32",
    "--speed",
    "1.0",
  ];

  // Add reference audio for voice cloning
  if (fs.existsSync(REF_AUDIO_PATH)) {
    args.push("--ref_audio", REF_AUDIO_PATH);
    if (REF_TEXT) args.push("--ref_text", REF_TEXT);
  }

  execFileSync("omnivoice-infer", args, {
    stdio: "pipe",
    timeout: 120_000, // 2 min per utterance max
  });

  return fs.readFileSync(outputPath);
}

// ── Upload to MinIO ───────────────────────────────────────────────────────

async function uploadToMinio(buffer: Buffer, questionId: string): Promise<string> {
  const objectKey = `bjt-audio/${questionId}.wav`;

  await minioClient.putObject(MINIO_BUCKET, objectKey, buffer, buffer.length, {
    "Content-Type": "audio/wav",
  });

  // Return public URL (internal network — same as existing pattern)
  return `http://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}/${objectKey}`;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║  BJT Question Audio Generator (OmniVoice)                ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`  OmniVoice URL:    ${OMNIVOICE_URL}`);
  console.log(`  Reference audio:  ${REF_AUDIO_PATH}`);
  console.log(`  Mode:             ${DRY_RUN ? "DRY RUN" : FORCE ? "FORCE (overwrite)" : "Normal (skip existing)"}`);
  console.log(`  Section filter:   ${SECTION_FILTER ?? "ALL"}`);
  console.log();

  // Validate reference audio exists
  if (!DRY_RUN && !fs.existsSync(REF_AUDIO_PATH)) {
    console.warn(`⚠️  Reference audio not found: ${REF_AUDIO_PATH}`);
    console.warn(`   Voice cloning won't work — will use auto voice mode instead.`);
    console.warn(`   For best BJT quality, provide a clean NHK-announcer-style clip.`);
    console.warn();
  }

  // Query questions that need audio
  const where: Record<string, unknown> = {
    audioScript: { not: null },
    status: "published",
  };

  if (!FORCE) {
    // Only process questions without existing audio
    where.audioUrl = null;
  }

  if (SECTION_FILTER) {
    where.section = { code: { contains: SECTION_FILTER } };
  }

  const questions = await prisma.bjtQuestion.findMany({
    where,
    select: {
      id: true,
      audioScript: true,
      audioUrl: true,
      prompt: true,
      section: { select: { code: true, test: { select: { name: true } } } },
    },
    orderBy: [{ section: { displayOrder: "asc" } }, { createdAt: "asc" }],
  });

  console.log(`Found ${questions.length} questions to process.`);
  if (questions.length === 0) {
    console.log("Nothing to do. Exiting.");
    return;
  }

  console.log();

  // Show preview
  const preview = questions.slice(0, 5);
  for (const q of preview) {
    const script = q.audioScript!.slice(0, 60);
    console.log(`  [${q.section.code}] ${script}${q.audioScript!.length > 60 ? "..." : ""}`);
  }
  if (questions.length > 5) console.log(`  ... and ${questions.length - 5} more`);
  console.log();

  if (DRY_RUN) {
    console.log("🏁 Dry run complete. No audio generated.");
    return;
  }

  // Ensure MinIO bucket exists
  const bucketExists = await minioClient.bucketExists(MINIO_BUCKET);
  if (!bucketExists) {
    await minioClient.makeBucket(MINIO_BUCKET);
    console.log(`Created MinIO bucket: ${MINIO_BUCKET}`);
  }

  // Create temp directory for CLI mode
  const tmpDir = path.join(process.cwd(), "tmp", "bjt-audio-gen");
  fs.mkdirSync(tmpDir, { recursive: true });

  // Process questions
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const progress = `[${i + 1}/${questions.length}]`;

    if (!q.audioScript) {
      skipped++;
      continue;
    }

    try {
      console.log(`${progress} Generating: ${q.audioScript.slice(0, 50)}...`);

      let audioBuffer: Buffer;

      // Try API first, fall back to CLI
      try {
        audioBuffer = await synthesizeWithOmniVoice(q.audioScript);
      } catch {
        // Fallback: use CLI
        const tmpFile = path.join(tmpDir, `${q.id}.wav`);
        audioBuffer = await synthesizeWithCli(q.audioScript, tmpFile);
        // Cleanup tmp file
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }

      // Upload to MinIO
      const audioUrl = await uploadToMinio(audioBuffer, q.id);

      // Update DB
      await prisma.bjtQuestion.update({
        where: { id: q.id },
        data: { audioUrl },
      });

      success++;
      console.log(`  ✅ Done → ${audioUrl}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed: ${msg}`);
    }

    // Rate limit: small delay between requests to avoid overwhelming GPU
    if (i < questions.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // Summary
  console.log();
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  ✅ Success:  ${success}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log(`  ⏭️  Skipped:  ${skipped}`);
  console.log(`  📊 Total:    ${questions.length}`);
  console.log("═══════════════════════════════════════════════════════════");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
