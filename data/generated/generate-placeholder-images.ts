/**
 * Generate unique SVG placeholder images for 330 BJT questions,
 * upload to MinIO, and update image_url in the database.
 *
 * Run: npx tsx data/generated/generate-placeholder-images.ts
 */
import { createPrismaClient } from "../../packages/database/src/index.js";
import * as Minio from "minio";

const prisma = createPrismaClient();

const minioClient = new Minio.Client({
  endPoint: "127.0.0.1",
  port: 9000,
  useSSL: false,
  accessKey: "minioadmin",
  secretKey: "minioadmin",
});

const BUCKET = "bjt-images";
const MINIO_PUBLIC_URL = "http://localhost:9000";

// ── Color palettes per media type ──────────────────────────────────
const PALETTES: Record<string, { bg: string; fg: string; accent: string; icon: string }[]> = {
  photo: [
    { bg: "#1e3a5f", fg: "#e8f0fe", accent: "#4a90d9", icon: "📷" },
    { bg: "#2d4a3e", fg: "#e8f5e9", accent: "#66bb6a", icon: "📷" },
    { bg: "#3e2723", fg: "#efebe9", accent: "#8d6e63", icon: "📷" },
    { bg: "#1a237e", fg: "#e8eaf6", accent: "#5c6bc0", icon: "📷" },
    { bg: "#004d40", fg: "#e0f2f1", accent: "#26a69a", icon: "📷" },
    { bg: "#263238", fg: "#eceff1", accent: "#78909c", icon: "📷" },
  ],
  illustration: [
    { bg: "#fff8e1", fg: "#5d4037", accent: "#ffb300", icon: "🎨" },
    { bg: "#fce4ec", fg: "#880e4f", accent: "#e91e63", icon: "🎨" },
    { bg: "#e8f5e9", fg: "#1b5e20", accent: "#4caf50", icon: "🎨" },
    { bg: "#e3f2fd", fg: "#0d47a1", accent: "#2196f3", icon: "🎨" },
    { bg: "#f3e5f5", fg: "#4a148c", accent: "#9c27b0", icon: "🎨" },
    { bg: "#fff3e0", fg: "#e65100", accent: "#ff9800", icon: "🎨" },
  ],
  chart: [
    { bg: "#f5f5f5", fg: "#212121", accent: "#1565c0", icon: "📊" },
    { bg: "#eceff1", fg: "#263238", accent: "#00897b", icon: "📈" },
    { bg: "#fafafa", fg: "#37474f", accent: "#e53935", icon: "📊" },
    { bg: "#e8eaf6", fg: "#283593", accent: "#3f51b5", icon: "📈" },
    { bg: "#fff8e1", fg: "#4e342e", accent: "#ff8f00", icon: "📊" },
    { bg: "#f1f8e9", fg: "#33691e", accent: "#7cb342", icon: "📈" },
  ],
  document: [
    { bg: "#fffde7", fg: "#33691e", accent: "#827717", icon: "📄" },
    { bg: "#efebe9", fg: "#3e2723", accent: "#795548", icon: "📄" },
    { bg: "#fafafa", fg: "#424242", accent: "#616161", icon: "📋" },
    { bg: "#e0f7fa", fg: "#006064", accent: "#00838f", icon: "📄" },
    { bg: "#fce4ec", fg: "#880e4f", accent: "#ad1457", icon: "📋" },
    { bg: "#f3e5f5", fg: "#4a148c", accent: "#7b1fa2", icon: "📄" },
  ],
};

// ── SVG generators per media type ──────────────────────────────────
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxCharsPerLine) {
      lines.push(remaining);
      break;
    }
    // Find a good break point
    let breakAt = maxCharsPerLine;
    const punctIdx = remaining.slice(0, maxCharsPerLine + 1).search(/[。、！？\s]/);
    if (punctIdx > 0 && punctIdx <= maxCharsPerLine) breakAt = punctIdx + 1;
    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt);
    if (lines.length >= 3) {
      if (remaining.length > 0) lines[2] = truncateText(lines[2], maxCharsPerLine);
      break;
    }
  }
  return lines;
}

function generatePhotoSvg(alt: string, idx: number, palette: typeof PALETTES.photo[0]): string {
  const lines = wrapText(alt, 22);
  const textY = 140 - (lines.length - 1) * 14;
  const textLines = lines
    .map((l, i) => `<text x="200" y="${textY + i * 28}" text-anchor="middle" fill="${palette.fg}" font-size="16" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">${escapeXml(l)}</text>`)
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280">
  <defs>
    <linearGradient id="bg${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${palette.bg}"/>
      <stop offset="100%" style="stop-color:${palette.accent}44"/>
    </linearGradient>
  </defs>
  <rect width="400" height="280" rx="12" fill="url(#bg${idx})"/>
  <circle cx="320" cy="60" r="30" fill="${palette.accent}33"/>
  <circle cx="80" cy="220" r="20" fill="${palette.accent}22"/>
  <rect x="40" y="200" width="320" height="1" fill="${palette.accent}44"/>
  <text x="200" y="60" text-anchor="middle" font-size="36">${palette.icon}</text>
  <text x="200" y="90" text-anchor="middle" fill="${palette.accent}" font-size="11" font-family="'Hiragino Sans',sans-serif">ビジネスシーン写真</text>
    ${textLines}
  <text x="200" y="260" text-anchor="middle" fill="${palette.fg}88" font-size="10" font-family="sans-serif">BJT Practice — Placeholder #${idx + 1}</text>
</svg>`;
}

function generateIllustrationSvg(alt: string, idx: number, palette: typeof PALETTES.illustration[0]): string {
  const lines = wrapText(alt, 22);
  const textY = 140 - (lines.length - 1) * 14;
  const textLines = lines
    .map((l, i) => `<text x="200" y="${textY + i * 28}" text-anchor="middle" fill="${palette.fg}" font-size="16" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">${escapeXml(l)}</text>`)
    .join("\n    ");

  // Decorative shapes for illustration style
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280">
  <rect width="400" height="280" rx="12" fill="${palette.bg}"/>
  <rect x="20" y="20" width="360" height="240" rx="8" fill="${palette.accent}15" stroke="${palette.accent}44" stroke-width="2" stroke-dasharray="8 4"/>
  <circle cx="60" cy="50" r="15" fill="${palette.accent}33"/>
  <circle cx="340" cy="50" r="10" fill="${palette.accent}22"/>
  <rect x="140" y="40" width="120" height="4" rx="2" fill="${palette.accent}33"/>
  <text x="200" y="70" text-anchor="middle" font-size="28">${palette.icon}</text>
  <text x="200" y="95" text-anchor="middle" fill="${palette.accent}" font-size="11" font-family="'Hiragino Sans',sans-serif">場面イラスト</text>
    ${textLines}
  <rect x="60" y="210" width="280" height="3" rx="1" fill="${palette.accent}22"/>
  <text x="200" y="255" text-anchor="middle" fill="${palette.fg}66" font-size="10" font-family="sans-serif">BJT Practice — Placeholder #${idx + 1}</text>
</svg>`;
}

function generateChartSvg(alt: string, idx: number, palette: typeof PALETTES.chart[0]): string {
  const lines = wrapText(alt, 24);
  const textY = 60;
  const textLines = lines
    .map((l, i) => `<text x="200" y="${textY + i * 22}" text-anchor="middle" fill="${palette.fg}" font-size="13" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">${escapeXml(l)}</text>`)
    .join("\n    ");

  // Generate pseudo-random bar heights based on idx
  const bars = [0.4, 0.7, 0.5, 0.85, 0.6, 0.9, 0.55, 0.75];
  const barW = 32;
  const barGap = 10;
  const chartX = 50;
  const chartBottom = 230;
  const chartH = 100;
  const barsSvg = bars
    .map((h, i) => {
      const shifted = bars[(i + idx) % bars.length]!;
      const bh = shifted * chartH;
      const color = i % 2 === 0 ? palette.accent : `${palette.accent}88`;
      return `<rect x="${chartX + i * (barW + barGap)}" y="${chartBottom - bh}" width="${barW}" height="${bh}" rx="3" fill="${color}"/>`;
    })
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280">
  <rect width="400" height="280" rx="12" fill="${palette.bg}"/>
  <text x="200" y="30" text-anchor="middle" font-size="24">${palette.icon}</text>
    ${textLines}
  <line x1="45" y1="${chartBottom}" x2="380" y2="${chartBottom}" stroke="${palette.fg}44" stroke-width="1"/>
  <line x1="45" y1="${chartBottom - chartH}" x2="380" y2="${chartBottom - chartH}" stroke="${palette.fg}22" stroke-width="1" stroke-dasharray="4 3"/>
  <line x1="45" y1="${chartBottom - chartH / 2}" x2="380" y2="${chartBottom - chartH / 2}" stroke="${palette.fg}22" stroke-width="1" stroke-dasharray="4 3"/>
    ${barsSvg}
  <text x="200" y="260" text-anchor="middle" fill="${palette.fg}66" font-size="10" font-family="sans-serif">BJT Practice — Placeholder #${idx + 1}</text>
</svg>`;
}

function generateDocumentSvg(alt: string, idx: number, palette: typeof PALETTES.document[0]): string {
  const lines = wrapText(alt, 24);
  const textY = 80;
  const textLines = lines
    .map((l, i) => `<text x="200" y="${textY + i * 22}" text-anchor="middle" fill="${palette.fg}" font-size="13" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">${escapeXml(l)}</text>`)
    .join("\n    ");

  // Fake document lines
  const docLines = Array.from({ length: 7 }, (_, i) => {
    const w = 200 + ((idx + i * 17) % 80);
    const y = 155 + i * 16;
    return `<rect x="${(400 - w) / 2}" y="${y}" width="${w}" height="6" rx="3" fill="${palette.fg}18"/>`;
  }).join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280">
  <rect width="400" height="280" rx="12" fill="${palette.bg}"/>
  <rect x="60" y="15" width="280" height="250" rx="6" fill="white" stroke="${palette.fg}22" stroke-width="1"/>
  <rect x="60" y="15" width="280" height="35" rx="6" fill="${palette.accent}15"/>
  <text x="200" y="40" text-anchor="middle" font-size="20">${palette.icon}</text>
  <text x="200" y="60" text-anchor="middle" fill="${palette.accent}" font-size="10" font-family="'Hiragino Sans',sans-serif">資料・ドキュメント</text>
    ${textLines}
    ${docLines}
  <text x="200" y="265" text-anchor="middle" fill="${palette.fg}44" font-size="9" font-family="sans-serif">BJT Practice — Placeholder #${idx + 1}</text>
</svg>`;
}

function generateSvg(mediaHint: string, alt: string, idx: number): string {
  const palette = (PALETTES[mediaHint] ?? PALETTES.photo!);
  const pal = palette[idx % palette.length]!;
  switch (mediaHint) {
    case "photo":
      return generatePhotoSvg(alt, idx, pal);
    case "illustration":
      return generateIllustrationSvg(alt, idx, pal);
    case "chart":
      return generateChartSvg(alt, idx, pal);
    case "document":
      return generateDocumentSvg(alt, idx, pal);
    default:
      return generatePhotoSvg(alt, idx, pal);
  }
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log("🖼️  BJT Placeholder Image Generator");
  console.log("====================================\n");

  // 1. Ensure bucket exists
  const bucketExists = await minioClient.bucketExists(BUCKET);
  if (!bucketExists) {
    await minioClient.makeBucket(BUCKET, "us-east-1");
    console.log(`✅ Created bucket: ${BUCKET}`);
  } else {
    console.log(`✅ Bucket exists: ${BUCKET}`);
  }

  // Set bucket policy to public-read for images
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${BUCKET}/*`],
      },
    ],
  };
  await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));
  console.log("✅ Bucket policy set to public-read\n");

  // 2. Fetch questions that need images
  const questions = await prisma.bjtQuestion.findMany({
    where: {
      imageAlt: { not: null },
      imageUrl: null,
    },
    select: {
      id: true,
      imageAlt: true,
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

  console.log(`📋 Found ${questions.length} questions needing images\n`);

  if (questions.length === 0) {
    console.log("Nothing to do!");
    await prisma.$disconnect();
    return;
  }

  // 3. Generate, upload, and update
  let uploaded = 0;
  let errors = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const qf = (q.qualityFlags ?? {}) as Record<string, unknown>;
    const mediaHint = (qf.mediaHint as string) ?? "photo";
    const alt = q.imageAlt ?? "";
    const level = q.section?.test?.level ?? "unknown";
    const sectionCode = q.section?.code ?? "unknown";

    const objectKey = `bjt/${level}/${sectionCode}/${q.id}.svg`;
    const svgContent = generateSvg(mediaHint, alt, i);
    const svgBuffer = Buffer.from(svgContent, "utf-8");

    try {
      await minioClient.putObject(BUCKET, objectKey, svgBuffer, svgBuffer.length, {
        "Content-Type": "image/svg+xml",
      });

      const imageUrl = `${MINIO_PUBLIC_URL}/${BUCKET}/${objectKey}`;

      await prisma.bjtQuestion.update({
        where: { id: q.id },
        data: { imageUrl },
      });

      uploaded++;
      if (uploaded % 30 === 0 || uploaded === questions.length) {
        console.log(`  ✅ ${uploaded}/${questions.length} uploaded (${level}/${sectionCode})`);
      }
    } catch (err) {
      errors++;
      console.error(`  ❌ Failed: ${q.id} — ${(err as Error).message}`);
    }
  }

  console.log(`\n🏁 Done: ${uploaded} uploaded, ${errors} errors`);

  // 4. Verify
  const verify = await prisma.bjtQuestion.aggregate({
    _count: { imageUrl: true, imageAlt: true },
    where: { imageAlt: { not: null } },
  });
  console.log(`\n📊 Verification: ${verify._count.imageUrl}/${verify._count.imageAlt} questions now have image_url`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
