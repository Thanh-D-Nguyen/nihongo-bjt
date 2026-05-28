/**
 * BJT Assessment Standardization — Fix DB data to match official BJT format
 *
 * Fixes:
 * 1. Section titleJa: add 問題 suffix, fix LC_STATEMENT (発話表現 → 発言聴解問題)
 * 2. Section titleVi: update to accurate Vietnamese translations
 * 3. Exam timeLimitSeconds: 2700 → 6300 (105 minutes = 45+30+30)
 * 4. Exam blueprintMeta: enrich with official BJT structure
 * 5. Quality flags: add stimulusRequired, distractorQuality, difficultySource
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage:
 *   pnpm tsx database/scripts/fix-bjt-standardization.ts
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../../packages/config/src/index.js";
import { createPrismaClient } from "../../../packages/database/src/index.js";

loadEnv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"),
});

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

/* ------------------------------------------------------------------ */
/* Official BJT Section Metadata                                      */
/* ------------------------------------------------------------------ */

const OFFICIAL_SECTIONS: Record<
  string,
  { titleJa: string; titleVi: string; stimulusRequired: boolean }
> = {
  LC_SCENE: {
    titleJa: "聴解 – 場面把握問題",
    titleVi: "Nghe – Nhận biết tình huống",
    stimulusRequired: true, // requires photo + audio
  },
  LC_STATEMENT: {
    titleJa: "聴解 – 発言聴解問題",
    titleVi: "Nghe – Nghe hiểu phát ngôn",
    stimulusRequired: true, // requires photo + audio
  },
  LC_INTEGRATED: {
    titleJa: "聴解 – 総合聴解問題",
    titleVi: "Nghe – Tổng hợp nghe hiểu",
    stimulusRequired: true, // requires illustration + audio
  },
  LR_SITUATION: {
    titleJa: "聴読解 – 状況把握問題",
    titleVi: "Nghe-Đọc – Nhận biết tình huống",
    stimulusRequired: true, // requires photo + audio + written options
  },
  LR_DOCUMENT: {
    titleJa: "聴読解 – 資料聴読解問題",
    titleVi: "Nghe-Đọc – Tài liệu nghe-đọc",
    stimulusRequired: true, // requires chart/table/ad + audio
  },
  LR_INTEGRATED: {
    titleJa: "聴読解 – 総合聴読解問題",
    titleVi: "Nghe-Đọc – Tổng hợp nghe-đọc",
    stimulusRequired: true, // requires document + audio
  },
  RC_VOCAB_GRAMMAR: {
    titleJa: "読解 – 語彙・文法問題",
    titleVi: "Đọc – Từ vựng & Ngữ pháp",
    stimulusRequired: false, // text only
  },
  RC_EXPRESSION: {
    titleJa: "読解 – 表現読解問題",
    titleVi: "Đọc – Đọc hiểu biểu đạt",
    stimulusRequired: false, // text only
  },
  RC_INTEGRATED: {
    titleJa: "読解 – 総合読解問題",
    titleVi: "Đọc – Tổng hợp đọc hiểu",
    stimulusRequired: false, // document/text reading
  },
};

/* ------------------------------------------------------------------ */
/* Official BJT Blueprint Template                                    */
/* ------------------------------------------------------------------ */

function buildOfficialBlueprintMeta(level: string) {
  return {
    examFormat: "bjt-mock-full",
    bjtVersion: "current",
    parts: [
      {
        code: "listening",
        titleJa: "第1部 聴解",
        titleVi: "Phần I – Nghe hiểu",
        timeLimitSec: 2700,
        sections: ["LC_SCENE", "LC_STATEMENT", "LC_INTEGRATED"],
      },
      {
        code: "listening_reading",
        titleJa: "第2部 聴読解",
        titleVi: "Phần II – Nghe và đọc hiểu",
        timeLimitSec: 1800,
        sections: ["LR_SITUATION", "LR_DOCUMENT", "LR_INTEGRATED"],
      },
      {
        code: "reading",
        titleJa: "第3部 読解",
        titleVi: "Phần III – Đọc hiểu",
        timeLimitSec: 1800,
        sections: ["RC_VOCAB_GRAMMAR", "RC_EXPRESSION", "RC_INTEGRATED"],
      },
    ],
    optionsPerQuestion: 4,
    scoringStrategy: "linear_estimate",
    scoreRange: { min: 0, max: 800 },
    scoringRubric: {
      bandThresholds: [
        { band: "J5", min: 0, max: 199 },
        { band: "J4", min: 200, max: 319 },
        { band: "J3", min: 320, max: 419 },
        { band: "J2", min: 420, max: 529 },
        { band: "J1", min: 530, max: 599 },
        { band: "J1+", min: 600, max: 800 },
      ],
    },
    level,
    disclaimer: "practice_estimated_score_not_official",
  };
}

/* ------------------------------------------------------------------ */
/* Main Fix                                                           */
/* ------------------------------------------------------------------ */

async function fixStandardization() {
  console.log("BJT Standardization Fix — starting...\n");

  // 1. Fix all section titles
  console.log("1. Fixing section titleJa and titleVi...");
  let sectionUpdates = 0;

  for (const [code, meta] of Object.entries(OFFICIAL_SECTIONS)) {
    const result = await prisma.bjtTestSection.updateMany({
      where: { code },
      data: {
        titleJa: meta.titleJa,
        titleVi: meta.titleVi,
      },
    });
    sectionUpdates += result.count;
    console.log(
      `  ${code}: ${result.count} sections updated → ${meta.titleJa}`
    );
  }
  console.log(`  Total: ${sectionUpdates} section records updated\n`);

  // 2. Fix timeLimitSeconds on all production exams
  console.log("2. Fixing timeLimitSeconds (2700 → 6300)...");
  const timeResult = await prisma.bjtMockTest.updateMany({
    where: {
      timeLimitSeconds: 2700,
      slug: { startsWith: "bjt-production-" },
    },
    data: { timeLimitSeconds: 6300 },
  });
  console.log(`  ${timeResult.count} exams updated to 6300s (105 min)\n`);

  // Also fix seed exams
  const seedTimeResult = await prisma.bjtMockTest.updateMany({
    where: {
      timeLimitSeconds: 2700,
      slug: { startsWith: "seed-bjt-" },
    },
    data: { timeLimitSeconds: 6300 },
  });
  console.log(`  ${seedTimeResult.count} seed exams updated to 6300s\n`);

  // 3. Enrich blueprintMeta on production exams
  console.log("3. Enriching blueprintMeta with official BJT structure...");
  const productionExams = await prisma.bjtMockTest.findMany({
    where: { slug: { startsWith: "bjt-production-" } },
  });

  for (const exam of productionExams) {
    const blueprint = buildOfficialBlueprintMeta(exam.level ?? "unknown");
    await prisma.bjtMockTest.update({
      where: { id: exam.id },
      data: { blueprintMeta: blueprint },
    });
    console.log(`  ${exam.slug}: blueprintMeta enriched`);
  }
  console.log();

  // 4. Enrich qualityFlags on all questions
  console.log("4. Enriching question qualityFlags...");
  let questionUpdates = 0;

  const sections = await prisma.bjtTestSection.findMany({
    include: {
      questions: { select: { id: true, qualityFlags: true } },
      test: { select: { level: true } },
    },
  });

  for (const section of sections) {
    const sectionMeta = OFFICIAL_SECTIONS[section.code];
    if (!sectionMeta) continue;

    for (const question of section.questions) {
      const existingFlags =
        (question.qualityFlags as Record<string, unknown>) ?? {};

      // Only add missing fields, don't overwrite existing
      const enrichedFlags = {
        ...existingFlags,
        bjtPart: section.code.startsWith("LC")
          ? "listening"
          : section.code.startsWith("LR")
            ? "listening_reading"
            : "reading",
        bjtSection: section.code,
        level: section.test?.level ?? existingFlags.level,
        stimulusRequired: sectionMeta.stimulusRequired,
        hasAudioStimulus: false, // no audio files yet
        hasVisualStimulus: false, // no visual files yet
        distractorQuality:
          existingFlags.distractorQuality ?? "generated",
        difficultySource:
          existingFlags.difficultySource ?? "estimated",
        itemReviewed: existingFlags.itemReviewed ?? false,
      };

      await prisma.bjtQuestion.update({
        where: { id: question.id },
        data: { qualityFlags: enrichedFlags },
      });
      questionUpdates++;
    }
  }
  console.log(`  ${questionUpdates} questions enriched\n`);

  // 5. Summary verification
  console.log("5. Verification...");
  const verifyExam = await prisma.bjtMockTest.findFirst({
    where: { slug: "bjt-production-bjt-j5" },
    include: {
      sections: {
        orderBy: { displayOrder: "asc" },
        include: {
          questions: { select: { id: true }, take: 1 },
        },
      },
    },
  });

  if (verifyExam) {
    console.log(`  Exam: ${verifyExam.slug}`);
    console.log(`  timeLimitSeconds: ${verifyExam.timeLimitSeconds}`);
    console.log(`  blueprintMeta present: ${!!verifyExam.blueprintMeta}`);
    for (const s of verifyExam.sections) {
      console.log(`    ${s.code}: titleJa="${s.titleJa}" | titleVi="${s.titleVi}"`);
    }
  }

  console.log("\n✅ BJT Standardization Fix complete!");
  await prisma.$disconnect();
}

fixStandardization().catch((err) => {
  console.error("Standardization fix failed:", err);
  process.exit(1);
});
