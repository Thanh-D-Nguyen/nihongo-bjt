/**
 * Battle Seed — BattleConfigs + BattleBots
 *
 * Creates:
 * - 5 BattleConfigs (one per BJT level: J5→J1)
 * - 6 BattleBots with different difficulties and personalities
 *
 * Idempotent: upserts by unique keys.
 *
 * Usage:
 *   pnpm tsx database/scripts/seed-battle.ts
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
/* Battle Configs                                                      */
/* ------------------------------------------------------------------ */

const BATTLE_CONFIGS = [
  {
    name: "BJT J5 クイックバトル",
    description: "Trận nhanh dành cho trình độ J5. 5 câu hỏi, 30 giây/câu.",
    level: "J5",
    questionPoolKey: "bjt_j5",
    questionCount: 5,
    timePerQuestionSec: 30,
    maxParticipants: 2,
    botDifficulties: ["easy", "medium"],
    scoringRules: { correctPoints: 10, speedBonus: true, speedBonusMax: 5 },
  },
  {
    name: "BJT J4 スタンダードバトル",
    description: "Trận tiêu chuẩn trình độ J4. 7 câu hỏi, 25 giây/câu.",
    level: "J4",
    questionPoolKey: "bjt_j4",
    questionCount: 7,
    timePerQuestionSec: 25,
    maxParticipants: 2,
    botDifficulties: ["easy", "medium", "hard"],
    scoringRules: { correctPoints: 15, speedBonus: true, speedBonusMax: 5 },
  },
  {
    name: "BJT J3 チャレンジバトル",
    description: "Trận thử thách trình độ J3. 10 câu hỏi, 20 giây/câu.",
    level: "J3",
    questionPoolKey: "bjt_j3",
    questionCount: 10,
    timePerQuestionSec: 20,
    maxParticipants: 2,
    botDifficulties: ["medium", "hard"],
    scoringRules: { correctPoints: 20, speedBonus: true, speedBonusMax: 8 },
  },
  {
    name: "BJT J2 エキスパートバトル",
    description: "Trận dành cho chuyên gia J2. 10 câu hỏi, 15 giây/câu.",
    level: "J2",
    questionPoolKey: "bjt_j2",
    questionCount: 10,
    timePerQuestionSec: 15,
    maxParticipants: 2,
    botDifficulties: ["hard", "expert"],
    scoringRules: { correctPoints: 25, speedBonus: true, speedBonusMax: 10 },
  },
  {
    name: "BJT J1 マスターバトル",
    description: "Trận đỉnh cao J1. 10 câu hỏi, 12 giây/câu.",
    level: "J1",
    questionPoolKey: "bjt_j1",
    questionCount: 10,
    timePerQuestionSec: 12,
    maxParticipants: 2,
    botDifficulties: ["hard", "expert"],
    scoringRules: { correctPoints: 30, speedBonus: true, speedBonusMax: 15 },
  },
];

/* ------------------------------------------------------------------ */
/* Battle Bots                                                         */
/* ------------------------------------------------------------------ */

const BATTLE_BOTS = [
  {
    botKey: "bot_tanaka_intern",
    name: "田中くん (Intern)",
    difficulty: "easy",
    persona: "Nhân viên tập sự nhiệt tình nhưng hay sai. Thường chọn đáp án đúng 50% thời gian.",
    accuracyPct: 50,
    minDelayMs: 3000,
    maxDelayMs: 8000,
    vocabularyLevel: "J5",
    avatarFallback: "田",
    styleToken: "nervous",
  },
  {
    botKey: "bot_suzuki_junior",
    name: "鈴木さん (Junior)",
    difficulty: "easy",
    persona: "Nhân viên mới 1 năm kinh nghiệm. Biết cơ bản nhưng còn thiếu từ vựng nâng cao.",
    accuracyPct: 60,
    minDelayMs: 2500,
    maxDelayMs: 7000,
    vocabularyLevel: "J4",
    avatarFallback: "鈴",
    styleToken: "focused",
  },
  {
    botKey: "bot_yamada_senpai",
    name: "山田先輩 (Senpai)",
    difficulty: "medium",
    persona: "Tiền bối 3 năm kinh nghiệm. Vững keigo cơ bản, đọc email nhanh.",
    accuracyPct: 72,
    minDelayMs: 2000,
    maxDelayMs: 5000,
    vocabularyLevel: "J3",
    avatarFallback: "山",
    styleToken: "confident",
  },
  {
    botKey: "bot_sato_manager",
    name: "佐藤課長 (Manager)",
    difficulty: "hard",
    persona: "Trưởng phòng 7 năm kinh nghiệm. Keigo thành thạo, nắm vững văn hóa công sở.",
    accuracyPct: 85,
    minDelayMs: 1500,
    maxDelayMs: 4000,
    vocabularyLevel: "J2",
    avatarFallback: "佐",
    styleToken: "sharp",
  },
  {
    botKey: "bot_takahashi_director",
    name: "高橋部長 (Director)",
    difficulty: "expert",
    persona: "Giám đốc bộ phận. Tiếng Nhật bản ngữ, thành thạo mọi tình huống kinh doanh.",
    accuracyPct: 92,
    minDelayMs: 1000,
    maxDelayMs: 3000,
    vocabularyLevel: "J1",
    avatarFallback: "高",
    styleToken: "elite",
  },
  {
    botKey: "bot_ai_sensei",
    name: "AI先生 (Sensei)",
    difficulty: "expert",
    persona: "AI thầy giáo. Tốc độ nhanh, độ chính xác cao, phản hồi tức thì.",
    accuracyPct: 95,
    minDelayMs: 800,
    maxDelayMs: 2000,
    vocabularyLevel: "J1",
    avatarFallback: "AI",
    styleToken: "elite",
  },
];

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  console.log("⚔️  Seeding battle data...\n");

  // 1. Battle Configs
  console.log("🎮 Seeding battle configs...");
  for (const bc of BATTLE_CONFIGS) {
    const existing = await prisma.battleConfig.findFirst({
      where: { name: bc.name },
    });
    if (existing) {
      await prisma.battleConfig.update({
        where: { id: existing.id },
        data: {
          description: bc.description,
          level: bc.level,
          questionPoolKey: bc.questionPoolKey,
          questionCount: bc.questionCount,
          timePerQuestionSec: bc.timePerQuestionSec,
          maxParticipants: bc.maxParticipants,
          botDifficulties: bc.botDifficulties,
          scoringRules: bc.scoringRules,
          status: "published",
          publishedAt: new Date(),
          updatedById: seedActorId,
        },
      });
    } else {
      await prisma.battleConfig.create({
        data: {
          name: bc.name,
          description: bc.description,
          level: bc.level,
          questionPoolKey: bc.questionPoolKey,
          questionCount: bc.questionCount,
          timePerQuestionSec: bc.timePerQuestionSec,
          maxParticipants: bc.maxParticipants,
          botDifficulties: bc.botDifficulties,
          scoringRules: bc.scoringRules,
          status: "published",
          publishedAt: new Date(),
          createdById: seedActorId,
          updatedById: seedActorId,
        },
      });
    }
  }
  console.log(`  ✅ ${BATTLE_CONFIGS.length} battle configs upserted`);

  // 2. Battle Bots
  console.log("🤖 Seeding battle bots...");
  for (const bot of BATTLE_BOTS) {
    await prisma.battleBot.upsert({
      where: { botKey: bot.botKey },
      update: {
        name: bot.name,
        difficulty: bot.difficulty,
        persona: bot.persona,
        accuracyPct: bot.accuracyPct,
        minDelayMs: bot.minDelayMs,
        maxDelayMs: bot.maxDelayMs,
        vocabularyLevel: bot.vocabularyLevel,
        avatarFallback: bot.avatarFallback,
        styleToken: bot.styleToken,
        status: "active",
        updatedById: seedActorId,
      },
      create: {
        botKey: bot.botKey,
        name: bot.name,
        difficulty: bot.difficulty,
        persona: bot.persona,
        accuracyPct: bot.accuracyPct,
        minDelayMs: bot.minDelayMs,
        maxDelayMs: bot.maxDelayMs,
        vocabularyLevel: bot.vocabularyLevel,
        avatarFallback: bot.avatarFallback,
        styleToken: bot.styleToken,
        status: "active",
        createdById: seedActorId,
        updatedById: seedActorId,
      },
    });
  }
  console.log(`  ✅ ${BATTLE_BOTS.length} battle bots upserted`);

  // 3. Audit log
  await prisma.adminAuditLog.create({
    data: {
      actorId: seedActorId,
      action: "seed_battle",
      targetType: "battle",
      targetId: "battle-seed-v1",
      after: {
        battleConfigs: BATTLE_CONFIGS.length,
        battleBots: BATTLE_BOTS.length,
      },
    },
  });

  console.log("\n✅ Battle seed complete!");
  console.log(`  🎮 ${BATTLE_CONFIGS.length} battle configs`);
  console.log(`  🤖 ${BATTLE_BOTS.length} battle bots`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
