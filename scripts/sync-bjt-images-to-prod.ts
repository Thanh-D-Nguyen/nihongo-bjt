/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Sync BJT question media: LOCAL → PRODUCTION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Why this script exists
 *  ──────────────────────
 *  BJT question media lives in TWO places that must both be synced:
 *    1. The image/audio FILE           → object inside a MinIO bucket
 *    2. The `imageUrl`/`audioUrl` link → columns on `BjtQuestion` (PostgreSQL)
 *
 *  The image-generation script stores a FULL URL with its environment host
 *  (e.g. http://localhost:19000/<bucket>/<key>). That URL is meaningless on
 *  production, so the images "disappear" even after a DB copy.
 *
 *  This script fixes all three problems in one pass:
 *    • copies each media OBJECT from local MinIO → prod MinIO (same object key)
 *    • rewrites the host  localhost:19000  →  the prod public base URL
 *    • writes imageUrl + imageAlt + imagePrompt + audioUrl into the PROD database
 *    • upserts AI image provenance/rights into MediaAsset and keeps its id in qualityFlags
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
 *   # The host browsers will actually use to load media. Stored into imageUrl/audioUrl.
 *   # Example: https://media.your-prod.com   (NO trailing slash, NO bucket)
 *   PROD_PUBLIC_BASE_URL    https://media.your-prod.com
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
import "dotenv/config";
import * as Minio from "minio";

import { createPrismaClient, Prisma } from "../packages/database/src/index.js";
import { imageMetadataForProductionSync } from "./lib/bjt-question-image-metadata.js";

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
 * Extract the MinIO object key from a stored media URL.
 * Handles full URLs (http://host:port/<bucket>/<key>) and bare object keys.
 * Returns null when the URL is an external/unknown source we should not touch.
 */
function objectKeyFromMediaUrl(mediaUrl: string): string | null {
  const value = mediaUrl.trim();
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

function publicReadPolicy() {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${MINIO_BUCKET}/*`]
      }
    ]
  });
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
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface Stats {
  totalQuestions: number;
  totalMedia: number;
  copied: number;
  skippedObject: number;
  dbUpdated: number;
  skippedExternal: number;
  errors: number;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Sync BJT question media: LOCAL → PRODUCTION               ║");
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
    await prodMinio.setBucketPolicy(MINIO_BUCKET, publicReadPolicy());
  }

  const rows = await localDb.bjtQuestion.findMany({
    where: {
      OR: [{ imageUrl: { not: null } }, { audioUrl: { not: null } }]
    },
    select: {
      id: true,
      imageUrl: true,
      imageAlt: true,
      imagePrompt: true,
      audioUrl: true,
      qualityFlags: true
    }
  });

  const stats: Stats = {
    totalQuestions: rows.length,
    totalMedia: 0,
    copied: 0,
    skippedObject: 0,
    dbUpdated: 0,
    skippedExternal: 0,
    errors: 0
  };

  console.log(`  Found ${rows.length} question(s) with media URLs.\n`);

  for (const row of rows) {
    const updates: {
      imageUrl?: string;
      imageAlt?: string | null;
      imagePrompt?: string | null;
      audioUrl?: string;
      qualityFlags?: Prisma.InputJsonValue;
    } = {};
    const media = [
      { field: "imageUrl" as const, url: row.imageUrl },
      { field: "audioUrl" as const, url: row.audioUrl }
    ];

    for (const item of media) {
      if (!item.url) continue;
      stats.totalMedia++;
      const key = objectKeyFromMediaUrl(item.url);
      if (!key) {
        stats.skippedExternal++;
        console.log(
          `  ⏭  ${row.id}  ${item.field} external/unknown URL, left untouched: ${item.url}`
        );
        continue;
      }

      const newUrl = `${PROD_PUBLIC_BASE_URL}/${MINIO_BUCKET}/${key}`;
      try {
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
        updates[item.field] = newUrl;
        if (item.field === "imageUrl") {
          Object.assign(updates, imageMetadataForProductionSync(row));
          const localAsset = await localDb.mediaAsset.findUnique({ where: { objectKey: key } });
          if (localAsset) {
            if (DRY_RUN) {
              console.log(`     WOULD preserve MediaAsset provenance/rights for ${key}`);
            } else {
              const prodAsset = await prodDb.mediaAsset.upsert({
                create: {
                  accessibility: localAsset.accessibility ?? Prisma.JsonNull,
                  byteSize: localAsset.byteSize,
                  checksumSha256: localAsset.checksumSha256,
                  license: localAsset.license,
                  mimeType: localAsset.mimeType,
                  objectKey: key,
                  provider: localAsset.provider,
                  provenance: localAsset.provenance ?? Prisma.JsonNull,
                  rightsStatus: localAsset.rightsStatus,
                  sourceUrl: newUrl,
                  status: localAsset.status
                },
                update: {
                  accessibility: localAsset.accessibility ?? Prisma.JsonNull,
                  byteSize: localAsset.byteSize,
                  checksumSha256: localAsset.checksumSha256,
                  license: localAsset.license,
                  mimeType: localAsset.mimeType,
                  provider: localAsset.provider,
                  provenance: localAsset.provenance ?? Prisma.JsonNull,
                  rightsStatus: localAsset.rightsStatus,
                  sourceUrl: newUrl,
                  status: localAsset.status
                },
                where: { objectKey: key }
              });
              const qualityFlags = (row.qualityFlags ?? {}) as Record<string, unknown>;
              const imageGeneration = (qualityFlags.imageGeneration ?? {}) as Record<
                string,
                unknown
              >;
              updates.qualityFlags = {
                ...qualityFlags,
                imageGeneration: {
                  ...imageGeneration,
                  mediaAssetId: prodAsset.id,
                  objectKey: key
                }
              } as Prisma.InputJsonObject;
            }
          }
        }
      } catch (err) {
        stats.errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗  ${row.id}  ${item.field} ERROR: ${msg}`);
      }
    }

    if (Object.keys(updates).length === 0) continue;
    if (DRY_RUN) {
      for (const [field, value] of Object.entries(updates)) {
        if (field === "imageAlt" || field === "imagePrompt") {
          const length = typeof value === "string" ? value.length : 0;
          console.log(`     WOULD preserve ${field} (${length} chars)`);
        } else if (field === "qualityFlags") {
          console.log("     WOULD preserve qualityFlags image provenance");
        } else {
          console.log(`     WOULD set ${field} → ${value}`);
        }
      }
    } else {
      await prodDb.bjtQuestion.update({ where: { id: row.id }, data: updates });
      stats.dbUpdated++;
    }
  }

  console.log();
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  Questions with media URLs  : ${stats.totalQuestions}`);
  console.log(`  Media URLs processed       : ${stats.totalMedia}`);
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
