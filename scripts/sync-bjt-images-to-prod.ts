/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Sync BJT question images: LOCAL → PRODUCTION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Why this script exists
 *  ──────────────────────
 *  BJT question images live in TWO places that must both be synced:
 *    1. The image FILE          → object inside a MinIO bucket
 *    2. The pointer `imageUrl`  → a column on the `BjtQuestion` table (PostgreSQL)
 *
 *  The image-generation script stores a FULL URL with a hardcoded host
 *  (e.g. http://localhost:19000/<bucket>/<key>). That URL is meaningless on
 *  production, so the images "disappear" even after a DB copy.
 *
 *  This script fixes all three problems in one pass:
 *    • copies each image OBJECT from local MinIO → prod MinIO (same object key)
 *    • rewrites the host  localhost:19000  →  the prod public base URL
 *    • writes imageUrl + imageAlt into the PROD database
 *
 *  It is IDEMPOTENT and safe to re-run. Existing prod objects are skipped
 *  unless --force is passed.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   # 1. Preview what would change (NO writes)
 *   npx tsx scripts/sync-bjt-images-to-prod.ts --dry-run
 *
 *   # 2. Run for real
 *   npx tsx scripts/sync-bjt-images-to-prod.ts
 *
 *   # 3. Re-upload objects even if they already exist on prod
 *   npx tsx scripts/sync-bjt-images-to-prod.ts --force
 *
 * ─── Required environment variables ──────────────────────────────────────────
 *
 *   LOCAL_DATABASE_URL      postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt
 *   LOCAL_MINIO_ENDPOINT    127.0.0.1
 *   LOCAL_MINIO_PORT        19000
 *   LOCAL_MINIO_ACCESS_KEY  minioadmin
 *   LOCAL_MINIO_SECRET_KEY  minioadmin
 *   LOCAL_MINIO_USE_SSL     false
 *
 *   PROD_DATABASE_URL       postgresql://USER:PASS@PROD_HOST:5432/nihongo_bjt
 *   PROD_MINIO_ENDPOINT     minio.your-prod.com        (internal host the script can reach)
 *   PROD_MINIO_PORT         9000
 *   PROD_MINIO_ACCESS_KEY   ...
 *   PROD_MINIO_SECRET_KEY   ...
 *   PROD_MINIO_USE_SSL      false
 *
 *   MINIO_BUCKET            nihongo-bjt-media          (must match both sides)
 *
 *   # The host browsers will actually use to load images. Stored into imageUrl.
 *   # Example: https://media.your-prod.com   (NO trailing slash, NO bucket)
 *   PROD_PUBLIC_BASE_URL    https://media.your-prod.com
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
import "dotenv/config";
import * as Minio from "minio";

import { createPrismaClient } from "../packages/database/src/index.js";

// ── Flags ────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

// ── Env helpers ──────────────────────────────────────────────────────────────

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v.trim().toLowerCase() === "true";
}

const MINIO_BUCKET = process.env.MINIO_BUCKET ?? "nihongo-bjt-media";
const PROD_PUBLIC_BASE_URL = required("PROD_PUBLIC_BASE_URL").replace(/\/+$/, "");

// ── Clients ──────────────────────────────────────────────────────────────────

const localDb = createPrismaClient(required("LOCAL_DATABASE_URL"));
const prodDb = createPrismaClient(required("PROD_DATABASE_URL"));

const localMinio = new Minio.Client({
  endPoint: required("LOCAL_MINIO_ENDPOINT"),
  port: parseInt(process.env.LOCAL_MINIO_PORT ?? "19000", 10),
  useSSL: bool("LOCAL_MINIO_USE_SSL", false),
  accessKey: required("LOCAL_MINIO_ACCESS_KEY"),
  secretKey: required("LOCAL_MINIO_SECRET_KEY")
});

const prodMinio = new Minio.Client({
  endPoint: required("PROD_MINIO_ENDPOINT"),
  port: parseInt(process.env.PROD_MINIO_PORT ?? "9000", 10),
  useSSL: bool("PROD_MINIO_USE_SSL", false),
  accessKey: required("PROD_MINIO_ACCESS_KEY"),
  secretKey: required("PROD_MINIO_SECRET_KEY")
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the MinIO object key from a stored imageUrl.
 * Handles full URLs (http://host:port/<bucket>/<key>) and bare object keys.
 * Returns null when the URL is an external/unknown source we should not touch.
 */
function objectKeyFromImageUrl(imageUrl: string): string | null {
  const value = imageUrl.trim();
  if (value === "") return null;

  // Bare object key (no scheme) — already storage-relative.
  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, "");
  }

  let pathname: string;
  try {
    pathname = new URL(value).pathname;
  } catch {
    return null;
  }

  // Strip leading slash, then a leading "<bucket>/" segment if present.
  let key = pathname.replace(/^\/+/, "");
  const bucketPrefix = `${MINIO_BUCKET}/`;
  if (key.startsWith(bucketPrefix)) {
    key = key.slice(bucketPrefix.length);
  }
  return key === "" ? null : key;
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function objectExists(client: Minio.Client, key: string): Promise<boolean> {
  try {
    await client.statObject(MINIO_BUCKET, key);
    return true;
  } catch {
    return false;
  }
}

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface Stats {
  total: number;
  copied: number;
  skippedObject: number;
  dbUpdated: number;
  skippedExternal: number;
  errors: number;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Sync BJT question images: LOCAL → PRODUCTION              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`  Bucket:          ${MINIO_BUCKET}`);
  console.log(`  Prod public URL: ${PROD_PUBLIC_BASE_URL}`);
  console.log(`  Mode:            ${DRY_RUN ? "DRY RUN (no writes)" : FORCE ? "FORCE" : "normal"}`);
  console.log();

  // Ensure prod bucket exists.
  if (!DRY_RUN) {
    const exists = await prodMinio.bucketExists(MINIO_BUCKET).catch(() => false);
    if (!exists) {
      throw new Error(
        `Prod bucket "${MINIO_BUCKET}" does not exist. Create it first (mc mb / console).`
      );
    }
  }

  const rows = await localDb.bjtQuestion.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, imageUrl: true, imageAlt: true }
  });

  const stats: Stats = {
    total: rows.length,
    copied: 0,
    skippedObject: 0,
    dbUpdated: 0,
    skippedExternal: 0,
    errors: 0
  };

  console.log(`  Found ${rows.length} question(s) with an imageUrl.\n`);

  for (const row of rows) {
    const key = row.imageUrl ? objectKeyFromImageUrl(row.imageUrl) : null;

    if (!key) {
      stats.skippedExternal++;
      console.log(`  ⏭  ${row.id}  external/unknown URL, left untouched: ${row.imageUrl}`);
      continue;
    }

    const newImageUrl = `${PROD_PUBLIC_BASE_URL}/${MINIO_BUCKET}/${key}`;

    try {
      // 1. Copy the object local → prod (unless already present and not forced).
      const alreadyOnProd = !FORCE && (await objectExists(prodMinio, key));
      if (alreadyOnProd) {
        stats.skippedObject++;
        console.log(`  •  ${row.id}  object exists on prod, skip upload: ${key}`);
      } else if (DRY_RUN) {
        console.log(`  ↑  ${row.id}  WOULD upload object: ${key}`);
      } else {
        const srcStream = await localMinio.getObject(MINIO_BUCKET, key);
        const buffer = await streamToBuffer(srcStream);
        await prodMinio.putObject(MINIO_BUCKET, key, buffer, buffer.length, {
          "Content-Type": contentTypeFor(key)
        });
        stats.copied++;
        console.log(`  ↑  ${row.id}  uploaded object (${buffer.length} bytes): ${key}`);
      }

      // 2. Upsert the pointer into the PROD database.
      if (DRY_RUN) {
        console.log(`     WOULD set imageUrl → ${newImageUrl}`);
      } else {
        await prodDb.bjtQuestion.update({
          where: { id: row.id },
          data: { imageUrl: newImageUrl, imageAlt: row.imageAlt ?? null }
        });
        stats.dbUpdated++;
        console.log(`     imageUrl → ${newImageUrl}`);
      }
    } catch (err) {
      stats.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗  ${row.id}  ERROR: ${msg}`);
    }
  }

  console.log();
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  Total questions with image : ${stats.total}`);
  console.log(`  Objects uploaded           : ${stats.copied}`);
  console.log(`  Objects already on prod    : ${stats.skippedObject}`);
  console.log(`  DB rows updated            : ${stats.dbUpdated}`);
  console.log(`  External/untouched URLs    : ${stats.skippedExternal}`);
  console.log(`  Errors                     : ${stats.errors}`);
  console.log("─────────────────────────────────────────────────────────────");

  if (stats.errors > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await localDb.$disconnect().catch(() => {});
    await prodDb.$disconnect().catch(() => {});
  });
