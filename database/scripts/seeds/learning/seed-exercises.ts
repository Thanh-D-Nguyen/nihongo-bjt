/**
 * Exercise Seed — ExerciseConfigs + sample Exercises + Announcements
 *
 * Creates:
 * - 5 ExerciseConfigs (word_order, cloze, translation, meaning_match, listening)
 * - 2 Announcements (welcome + feature highlight)
 *
 * Idempotent: upserts by unique keys.
 *
 * Usage:
 *   pnpm tsx database/scripts/seed-exercises.ts
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient } from "../../../../packages/database/src/index.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);
const seedActorId =
  process.env.NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID ?? "00000000-0000-4000-8000-000000000001";

/* ------------------------------------------------------------------ */
/* Exercise Configs                                                    */
/* ------------------------------------------------------------------ */

const EXERCISE_CONFIGS = [
  { exerciseType: "word_order", placement: "practice_tab", displayOrder: 1, timeLimitSec: 60, pointsPerCorrect: 10, minLevel: null, maxLevel: null },
  { exerciseType: "cloze", placement: "practice_tab", displayOrder: 2, timeLimitSec: 45, pointsPerCorrect: 10, minLevel: null, maxLevel: null },
  { exerciseType: "translation", placement: "practice_tab", displayOrder: 3, timeLimitSec: 60, pointsPerCorrect: 15, minLevel: null, maxLevel: null },
  { exerciseType: "meaning_match", placement: "post_review", displayOrder: 1, timeLimitSec: 30, pointsPerCorrect: 8, minLevel: null, maxLevel: null },
  { exerciseType: "listening", placement: "daily_hub", displayOrder: 1, timeLimitSec: 45, pointsPerCorrect: 12, minLevel: "N5", maxLevel: "N3" },
  { exerciseType: "word_order", placement: "post_review", displayOrder: 2, timeLimitSec: 45, pointsPerCorrect: 10, minLevel: null, maxLevel: null },
  { exerciseType: "cloze", placement: "daily_hub", displayOrder: 2, timeLimitSec: 45, pointsPerCorrect: 10, minLevel: null, maxLevel: null },
];

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

const ANNOUNCEMENTS = [
  {
    type: "info",
    message: "🎉 Chào mừng bạn đến NihonGo BJT! Hãy bắt đầu hành trình chinh phục BJT ngay hôm nay.",
    href: "/onboarding",
    sortOrder: 1,
  },
  {
    type: "feature",
    message: "⚔️ Tính năng mới: Battle Mode! Thách đấu với bot AI để luyện tập BJT.",
    href: "/battle",
    sortOrder: 2,
  },
  {
    type: "info",
    message: "📚 Bộ thẻ từ vựng BJT mới: 20 từ kinh doanh cơ bản + 10 mẫu keigo email.",
    href: "/flashcards",
    sortOrder: 3,
  },
];

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  console.log("📝 Seeding exercises & announcements...\n");

  // 1. Exercise Configs
  console.log("🏋️ Seeding exercise configs...");
  for (const ec of EXERCISE_CONFIGS) {
    await prisma.exerciseConfig.upsert({
      where: {
        exerciseType_placement: {
          exerciseType: ec.exerciseType,
          placement: ec.placement,
        },
      },
      update: {
        displayOrder: ec.displayOrder,
        enabled: true,
        timeLimitSec: ec.timeLimitSec,
        pointsPerCorrect: ec.pointsPerCorrect,
        minLevel: ec.minLevel,
        maxLevel: ec.maxLevel,
        updatedBy: seedActorId,
      },
      create: {
        exerciseType: ec.exerciseType,
        placement: ec.placement,
        displayOrder: ec.displayOrder,
        enabled: true,
        timeLimitSec: ec.timeLimitSec,
        pointsPerCorrect: ec.pointsPerCorrect,
        minLevel: ec.minLevel,
        maxLevel: ec.maxLevel,
        createdBy: seedActorId,
        updatedBy: seedActorId,
      },
    });
  }
  console.log(`  ✅ ${EXERCISE_CONFIGS.length} exercise configs upserted`);

  // 2. Announcements
  console.log("📢 Seeding announcements...");
  for (const ann of ANNOUNCEMENTS) {
    const existing = await prisma.announcement.findFirst({
      where: { message: ann.message },
    });
    if (!existing) {
      await prisma.announcement.create({
        data: {
          type: ann.type,
          message: ann.message,
          href: ann.href,
          sortOrder: ann.sortOrder,
          active: true,
        },
      });
    }
  }
  console.log(`  ✅ ${ANNOUNCEMENTS.length} announcements upserted`);

  // 3. Audit log
  await prisma.adminAuditLog.create({
    data: {
      actorId: seedActorId,
      action: "seed_exercises_announcements",
      targetType: "exercise",
      targetId: "exercise-seed-v1",
      after: {
        exerciseConfigs: EXERCISE_CONFIGS.length,
        announcements: ANNOUNCEMENTS.length,
      },
    },
  });

  console.log("\n✅ Exercise & announcement seed complete!");
  console.log(`  🏋️ ${EXERCISE_CONFIGS.length} exercise configs`);
  console.log(`  📢 ${ANNOUNCEMENTS.length} announcements`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
