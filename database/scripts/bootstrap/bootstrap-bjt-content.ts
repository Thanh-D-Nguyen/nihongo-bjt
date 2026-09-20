/**
 * Idempotent content bootstrap for the BJT practice datasets (J5..J1+).
 *
 * Unlike seed-bjt-production.ts (destructive replace), this script NEVER
 * deletes questions, sections, tests, or any runtime data (quiz answers,
 * battle rounds, sessions). It upserts canonical content keyed on stable
 * identifiers:
 *   - BjtMockTest       by unique slug
 *   - BjtTestSection    by (testId, code)
 *   - BjtQuestion       by stable sourceId (sha-derived UUID, same scheme as
 *                       seed-bjt-official-mocks.ts) within its section
 *   - BjtQuestionOption by (questionId, optionKey)
 *
 * A dataset fingerprint (sha256 of canonical question payloads) is stored in
 * BjtMockTest.blueprintMeta.datasetFingerprint; when it matches, the test is
 * skipped entirely - fast no-op re-run.
 *
 * Questions in the DB that this dataset no longer declares are reported as
 * extraneous (never deleted).
 *
 * Usage:
 *   npx tsx database/scripts/bootstrap/bootstrap-bjt-content.ts [--dry-run]
 *
 * Env: DATABASE_URL (non-local requires ALLOW_REMOTE_TARGET=true).
 */
import { config as loadEnv } from "dotenv";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../../packages/config/src/index.js";
import { createPrismaClient } from "../../../packages/database/src/index.js";
import { SECTION_SPEC, type SeedLevelData, type SeedQuestion } from "../seeds/bjt/bjt-seed-types.js";
import { J5_DATA } from "../seeds/bjt/bjt-questions/j5.js";
import { J4_DATA } from "../seeds/bjt/bjt-questions/j4.js";
import { J3_DATA } from "../seeds/bjt/bjt-questions/j3.js";
import { J2_DATA } from "../seeds/bjt/bjt-questions/j2.js";
import { J1_DATA } from "../seeds/bjt/bjt-questions/j1.js";
import { J1PLUS_DATA } from "../seeds/bjt/bjt-questions/j1plus.js";
import { OFFICIAL_MOCK_FORMS } from "../seeds/bjt/official-mock-data.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

const DRY_RUN = process.argv.includes("--dry-run");
const PRACTICE_PROVENANCE = "seed-v3-production-bootstrap";

const TIME_LIMITS: Record<string, number> = {
  J5: 6300, J4: 6300, J3: 6300, J2: 6300, J1: 6300, "J1+": 6300,
};

const ALL_LEVELS: SeedLevelData[] = [J5_DATA, J4_DATA, J3_DATA, J2_DATA, J1_DATA, J1PLUS_DATA];

function stableSourceId(sourceKey: string): string {
  const hex = createHash("sha256").update(sourceKey).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex
    .slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function inferMediaHint(sectionCode: string): string {
  return SECTION_SPEC[sectionCode as keyof typeof SECTION_SPEC]?.defaultMedia ?? "none";
}

function generateImageAlt(q: SeedQuestion, sectionCode: string): string | null {
  if (q.imageAlt) return q.imageAlt;
  const hint = q.mediaHint ?? inferMediaHint(sectionCode);
  switch (hint) {
    case "photo":
      return q.scenario ? `ビジネスシーンの写真：${q.scenario}` : "ビジネスシーンの写真";
    case "illustration":
      return q.scenario ? `場面のイラスト：${q.scenario}` : "ビジネス場面のイラスト";
    case "chart":
      return q.scenario ? `資料・グラフ：${q.scenario}` : "ビジネス資料";
    case "document":
      return q.scenario ? `文書：${q.scenario.slice(0, 100)}` : "ビジネス文書";
    default:
      return null;
  }
}

function datasetFingerprint(level: SeedLevelData): string {
  const hash = createHash("sha256");
  for (const section of level.sections) {
    hash.update(section.code);
    for (const q of section.questions) {
      hash.update(JSON.stringify([
        q.prompt, q.scenario, q.explanationVi, q.skillTag, q.difficulty,
        q.mediaHint ?? null, q.imageAlt ?? null,
        q.options.map((o) => [o.key, o.text, o.isCorrect]),
      ]));
    }
  }
  return hash.digest("hex");
}

function blueprint(fingerprint: string) {
  return {
    version: "v3-production",
    datasetFingerprint: fingerprint,
    totalQuestions: 80,
    parts: {
      listening: { sections: ["LC_SCENE", "LC_STATEMENT", "LC_INTEGRATED"], count: 30 },
      listeningReading: { sections: ["LR_SITUATION", "LR_DOCUMENT", "LR_INTEGRATED"], count: 15 },
      reading: { sections: ["RC_VOCAB_GRAMMAR", "RC_EXPRESSION", "RC_INTEGRATED"], count: 35 },
    },
  };
}

async function main() {
  const isLocal = env.DATABASE_URL.includes("127.0.0.1") || env.DATABASE_URL.includes("localhost");
  if (!DRY_RUN && !isLocal && process.env.ALLOW_REMOTE_TARGET !== "true") {
    console.error("Refusing to write to a non-local DATABASE_URL without ALLOW_REMOTE_TARGET=true");
    process.exitCode = 1;
    return;
  }

  const report = { tests: 0, created: 0, updated: 0, skipped: 0, extraneous: 0 };

  for (const levelData of ALL_LEVELS) {
    const fingerprint = datasetFingerprint(levelData);

    if (DRY_RUN) {
      const count = levelData.sections.reduce((n, s) => n + s.questions.length, 0);
      console.log(`[dry-run] would upsert ${levelData.slug} (${count} questions), fingerprint ${fingerprint.slice(0, 12)}`);
      report.tests++;
      continue;
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.bjtMockTest.findUnique({ where: { slug: levelData.slug } });
        const meta = existing?.blueprintMeta as Record<string, unknown> | null;
        if (meta && typeof meta === "object" && meta.datasetFingerprint === fingerprint) {
          return { skipped: true as const, created: 0, updated: 0, extraneous: 0 };
        }

        const test = await tx.bjtMockTest.upsert({
          where: { slug: levelData.slug },
          update: {
            titleVi: levelData.titleVi,
            titleJa: levelData.titleJa,
            type: "practice",
            status: "published",
            level: levelData.level,
            timeLimitSeconds: TIME_LIMITS[levelData.level] ?? 6300,
            blueprintMeta: blueprint(fingerprint),
          },
          create: {
            slug: levelData.slug,
            titleVi: levelData.titleVi,
            titleJa: levelData.titleJa,
            type: "practice",
            status: "published",
            level: levelData.level,
            timeLimitSeconds: TIME_LIMITS[levelData.level] ?? 6300,
            blueprintMeta: blueprint(fingerprint),
          },
          select: { id: true },
        });

        let created = 0;
        let updated = 0;
        const knownSourceIds = new Set<string>();

        for (let si = 0; si < levelData.sections.length; si++) {
          const sectionData = levelData.sections[si]!;
          const section = await tx.bjtTestSection.upsert({
            where: { testId_code: { testId: test.id, code: sectionData.code } },
            update: { titleVi: sectionData.titleVi, titleJa: sectionData.titleJa, displayOrder: si + 1 },
            create: {
              testId: test.id,
              code: sectionData.code,
              titleVi: sectionData.titleVi,
              titleJa: sectionData.titleJa,
              displayOrder: si + 1,
            },
            select: { id: true },
          });

          for (const [qi, q] of sectionData.questions.entries()) {
            const sourceId = stableSourceId(`${levelData.slug}/${sectionData.code}/${qi + 1}`);
            knownSourceIds.add(sourceId);
            const mediaHint = q.mediaHint ?? inferMediaHint(sectionData.code);

            // Match by stable sourceId; fall back to unset-sourceId + same prompt
            // in this section (adopting rows created by the old destructive seeder).
            const existingQ = await tx.bjtQuestion.findFirst({
              where: { sectionId: section.id, OR: [{ sourceId }, { sourceId: null, prompt: q.prompt }] },
              select: { id: true },
            });

            const data = {
              prompt: q.prompt,
              scenario: q.scenario,
              imageAlt: generateImageAlt(q, sectionData.code),
              imagePrompt: q.imagePrompt ?? null,
              explanationVi: q.explanationVi,
              skillTag: q.skillTag,
              difficulty: q.difficulty,
              sourceType: PRACTICE_PROVENANCE,
              sourceId,
              status: "published",
              tags: [levelData.level, sectionData.code, mediaHint],
            };

            const question = existingQ
              ? await tx.bjtQuestion.update({ where: { id: existingQ.id }, data, select: { id: true } })
              : await tx.bjtQuestion.create({ data: { sectionId: section.id, ...data }, select: { id: true } });
            if (existingQ) updated++; else created++;

            for (const option of q.options) {
              await tx.bjtQuestionOption.upsert({
                where: { questionId_optionKey: { questionId: question.id, optionKey: option.key } },
                update: { text: option.text, isCorrect: option.isCorrect },
                create: { questionId: question.id, optionKey: option.key, text: option.text, isCorrect: option.isCorrect },
              });
            }
          }
        }

        // Extraneous: rows under this test not declared by the canonical set. Never deleted.
        const dbQuestions = await tx.bjtQuestion.findMany({
          where: { section: { testId: test.id } },
          select: { sourceId: true },
        });
        const extraneous = dbQuestions.filter(
          (q) => q.sourceId === null || !knownSourceIds.has(q.sourceId),
        ).length;

        return { skipped: false as const, created, updated, extraneous };
      },
      { maxWait: 10_000, timeout: 300_000 },
    );

    report.tests++;
    if (result.skipped) {
      report.skipped++;
      console.log(`  = ${levelData.slug}: fingerprint unchanged, skipped`);
    } else {
      report.created += result.created;
      report.updated += result.updated;
      report.extraneous += result.extraneous;
      console.log(`  ✓ ${levelData.slug}: ${result.created} created, ${result.updated} updated, ${result.extraneous} extraneous (kept)`);
    }
  }

  for (const form of OFFICIAL_MOCK_FORMS) {
    if (DRY_RUN) {
      console.log(`[dry-run] would preserve/upsert ${form.slug} (official)`);
      report.tests++;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const test = await tx.bjtMockTest.findUnique({ where: { slug: form.slug }, select: { id: true } });
      if (!test) return;
      for (const sectionData of form.sections) {
        const section = await tx.bjtTestSection.findUnique({ where: { testId_code: { testId: test.id, code: sectionData.code } }, select: { id: true } });
        if (!section) continue;
        for (const question of sectionData.questions) {
          const existing = await tx.bjtQuestion.findFirst({ where: { sectionId: section.id, prompt: question.prompt }, select: { id: true } });
          if (!existing) continue;
          await tx.bjtQuestion.update({ where: { id: existing.id }, data: { imageAlt: question.imageAlt, imagePrompt: question.imagePrompt, scenario: question.scenario, qualityFlags: { bjtPart: sectionData.code.startsWith("RC") ? "reading" : "listening", bjtSection: sectionData.code, stimulusKind: question.stimulusKind, hasAudioStimulus: question.audioScript !== null, hasVisualStimulus: question.imagePrompt !== null, provenance: "nihongo-bjt-original-full-mock-v1", license: "original-internal-production-content" } } });
        }
      }
    });
    report.tests++;
  }

  console.log(
    `\nBootstrap ${DRY_RUN ? "(dry-run) " : ""}done: ${report.tests} tests — created ${report.created}, updated ${report.updated}, skipped ${report.skipped}, extraneous kept ${report.extraneous}`,
  );
  await prisma.$disconnect();
}

await main();
