/**
 * Gamification Seed — Achievements, Streaks, Leaderboards
 *
 * Creates:
 * - 8 AchievementDefinitions with bronze/silver/gold/platinum tiers each
 * - 4 StreakConfigs (review, exercise, quiz, any)
 * - 4 LeaderboardConfigs (weekly XP, weekly battles, monthly reviews, all-time streak)
 *
 * Idempotent: upserts by unique keys.
 *
 * Usage:
 *   pnpm tsx database/scripts/seed-gamification.ts
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
/* Achievement Definitions                                             */
/* ------------------------------------------------------------------ */

interface AchievementSeed {
  slug: string;
  nameKey: string;
  descriptionKey: string;
  category: string;
  metricKey: string;
  displayOrder: number;
  tiers: { tier: string; threshold: number; nameKey: string }[];
}

const ACHIEVEMENTS: AchievementSeed[] = [
  {
    slug: "vocab-master",
    nameKey: "achievement.vocab_master.name",
    descriptionKey: "achievement.vocab_master.description",
    category: "mastery",
    metricKey: "words_learned",
    displayOrder: 1,
    tiers: [
      { tier: "bronze", threshold: 50, nameKey: "achievement.vocab_master.bronze" },
      { tier: "silver", threshold: 200, nameKey: "achievement.vocab_master.silver" },
      { tier: "gold", threshold: 500, nameKey: "achievement.vocab_master.gold" },
      { tier: "platinum", threshold: 1000, nameKey: "achievement.vocab_master.platinum" },
    ],
  },
  {
    slug: "kanji-scholar",
    nameKey: "achievement.kanji_scholar.name",
    descriptionKey: "achievement.kanji_scholar.description",
    category: "mastery",
    metricKey: "kanji_learned",
    displayOrder: 2,
    tiers: [
      { tier: "bronze", threshold: 20, nameKey: "achievement.kanji_scholar.bronze" },
      { tier: "silver", threshold: 100, nameKey: "achievement.kanji_scholar.silver" },
      { tier: "gold", threshold: 300, nameKey: "achievement.kanji_scholar.gold" },
      { tier: "platinum", threshold: 600, nameKey: "achievement.kanji_scholar.platinum" },
    ],
  },
  {
    slug: "grammar-sage",
    nameKey: "achievement.grammar_sage.name",
    descriptionKey: "achievement.grammar_sage.description",
    category: "mastery",
    metricKey: "grammar_points_learned",
    displayOrder: 3,
    tiers: [
      { tier: "bronze", threshold: 10, nameKey: "achievement.grammar_sage.bronze" },
      { tier: "silver", threshold: 50, nameKey: "achievement.grammar_sage.silver" },
      { tier: "gold", threshold: 150, nameKey: "achievement.grammar_sage.gold" },
      { tier: "platinum", threshold: 300, nameKey: "achievement.grammar_sage.platinum" },
    ],
  },
  {
    slug: "streak-champion",
    nameKey: "achievement.streak_champion.name",
    descriptionKey: "achievement.streak_champion.description",
    category: "streak",
    metricKey: "streak_days",
    displayOrder: 4,
    tiers: [
      { tier: "bronze", threshold: 7, nameKey: "achievement.streak_champion.bronze" },
      { tier: "silver", threshold: 30, nameKey: "achievement.streak_champion.silver" },
      { tier: "gold", threshold: 100, nameKey: "achievement.streak_champion.gold" },
      { tier: "platinum", threshold: 365, nameKey: "achievement.streak_champion.platinum" },
    ],
  },
  {
    slug: "battle-warrior",
    nameKey: "achievement.battle_warrior.name",
    descriptionKey: "achievement.battle_warrior.description",
    category: "battle",
    metricKey: "battles_won",
    displayOrder: 5,
    tiers: [
      { tier: "bronze", threshold: 5, nameKey: "achievement.battle_warrior.bronze" },
      { tier: "silver", threshold: 25, nameKey: "achievement.battle_warrior.silver" },
      { tier: "gold", threshold: 100, nameKey: "achievement.battle_warrior.gold" },
      { tier: "platinum", threshold: 500, nameKey: "achievement.battle_warrior.platinum" },
    ],
  },
  {
    slug: "quiz-ace",
    nameKey: "achievement.quiz_ace.name",
    descriptionKey: "achievement.quiz_ace.description",
    category: "learning",
    metricKey: "quizzes_passed",
    displayOrder: 6,
    tiers: [
      { tier: "bronze", threshold: 5, nameKey: "achievement.quiz_ace.bronze" },
      { tier: "silver", threshold: 20, nameKey: "achievement.quiz_ace.silver" },
      { tier: "gold", threshold: 50, nameKey: "achievement.quiz_ace.gold" },
      { tier: "platinum", threshold: 150, nameKey: "achievement.quiz_ace.platinum" },
    ],
  },
  {
    slug: "review-diligent",
    nameKey: "achievement.review_diligent.name",
    descriptionKey: "achievement.review_diligent.description",
    category: "learning",
    metricKey: "reviews_done",
    displayOrder: 7,
    tiers: [
      { tier: "bronze", threshold: 100, nameKey: "achievement.review_diligent.bronze" },
      { tier: "silver", threshold: 500, nameKey: "achievement.review_diligent.silver" },
      { tier: "gold", threshold: 2000, nameKey: "achievement.review_diligent.gold" },
      { tier: "platinum", threshold: 5000, nameKey: "achievement.review_diligent.platinum" },
    ],
  },
  {
    slug: "daily-explorer",
    nameKey: "achievement.daily_explorer.name",
    descriptionKey: "achievement.daily_explorer.description",
    category: "social",
    metricKey: "daily_sessions_completed",
    displayOrder: 8,
    tiers: [
      { tier: "bronze", threshold: 7, nameKey: "achievement.daily_explorer.bronze" },
      { tier: "silver", threshold: 30, nameKey: "achievement.daily_explorer.silver" },
      { tier: "gold", threshold: 90, nameKey: "achievement.daily_explorer.gold" },
      { tier: "platinum", threshold: 365, nameKey: "achievement.daily_explorer.platinum" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Streak Configs                                                      */
/* ------------------------------------------------------------------ */

interface StreakConfigSeed {
  name: string;
  activityType: string;
  minActionsPerDay: number;
  freezesAllowed: number;
}

const STREAK_CONFIGS: StreakConfigSeed[] = [
  { name: "Daily Review Streak", activityType: "review", minActionsPerDay: 5, freezesAllowed: 2 },
  { name: "Daily Exercise Streak", activityType: "exercise", minActionsPerDay: 3, freezesAllowed: 1 },
  { name: "Daily Quiz Streak", activityType: "quiz", minActionsPerDay: 1, freezesAllowed: 1 },
  { name: "Daily Study Streak", activityType: "any", minActionsPerDay: 1, freezesAllowed: 3 },
];

/* ------------------------------------------------------------------ */
/* Leaderboard Configs                                                 */
/* ------------------------------------------------------------------ */

interface LeaderboardSeed {
  name: string;
  nameKey: string;
  metricType: string;
  period: string;
  maxEntries: number;
}

const LEADERBOARDS: LeaderboardSeed[] = [
  { name: "Weekly XP Ranking", nameKey: "leaderboard.weekly_xp.name", metricType: "points", period: "weekly", maxEntries: 100 },
  { name: "Weekly Battle Champions", nameKey: "leaderboard.weekly_battles.name", metricType: "battles_won", period: "weekly", maxEntries: 50 },
  { name: "Monthly Review Stars", nameKey: "leaderboard.monthly_reviews.name", metricType: "reviews_done", period: "monthly", maxEntries: 100 },
  { name: "All-Time Streak Legends", nameKey: "leaderboard.alltime_streak.name", metricType: "streak", period: "all_time", maxEntries: 50 },
];

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  console.log("🏆 Seeding gamification data...\n");

  // 1. Achievements
  console.log("🎖️  Seeding achievement definitions...");
  for (const ach of ACHIEVEMENTS) {
    const def = await prisma.achievementDefinition.upsert({
      where: { slug: ach.slug },
      update: {
        nameKey: ach.nameKey,
        descriptionKey: ach.descriptionKey,
        category: ach.category,
        metricKey: ach.metricKey,
        displayOrder: ach.displayOrder,
        enabled: true,
        createdBy: seedActorId,
        updatedBy: seedActorId,
      },
      create: {
        slug: ach.slug,
        nameKey: ach.nameKey,
        descriptionKey: ach.descriptionKey,
        category: ach.category,
        metricKey: ach.metricKey,
        displayOrder: ach.displayOrder,
        enabled: true,
        createdBy: seedActorId,
        updatedBy: seedActorId,
      },
    });

    for (const t of ach.tiers) {
      await prisma.achievementTier.upsert({
        where: {
          achievementId_tier: { achievementId: def.id, tier: t.tier },
        },
        update: { threshold: t.threshold, nameKey: t.nameKey },
        create: {
          achievementId: def.id,
          tier: t.tier,
          threshold: t.threshold,
          nameKey: t.nameKey,
          rewardType: "badge_icon",
          rewardValue: `${ach.slug}_${t.tier}`,
        },
      });
    }
  }
  console.log(`  ✅ ${ACHIEVEMENTS.length} achievements (${ACHIEVEMENTS.length * 4} tiers) upserted`);

  // 2. Streak Configs
  console.log("🔥 Seeding streak configs...");
  for (const sc of STREAK_CONFIGS) {
    const existing = await prisma.streakConfig.findFirst({
      where: { activityType: sc.activityType },
    });
    if (existing) {
      await prisma.streakConfig.update({
        where: { id: existing.id },
        data: {
          name: sc.name,
          minActionsPerDay: sc.minActionsPerDay,
          freezesAllowed: sc.freezesAllowed,
          enabled: true,
          updatedBy: seedActorId,
        },
      });
    } else {
      await prisma.streakConfig.create({
        data: {
          name: sc.name,
          activityType: sc.activityType,
          minActionsPerDay: sc.minActionsPerDay,
          freezesAllowed: sc.freezesAllowed,
          enabled: true,
          createdBy: seedActorId,
          updatedBy: seedActorId,
        },
      });
    }
  }
  console.log(`  ✅ ${STREAK_CONFIGS.length} streak configs upserted`);

  // 3. Leaderboards
  console.log("📊 Seeding leaderboard configs...");
  for (const lb of LEADERBOARDS) {
    const existing = await prisma.leaderboardConfig.findFirst({
      where: { metricType: lb.metricType, period: lb.period },
    });
    if (existing) {
      await prisma.leaderboardConfig.update({
        where: { id: existing.id },
        data: {
          name: lb.name,
          nameKey: lb.nameKey,
          maxEntries: lb.maxEntries,
          enabled: true,
          updatedBy: seedActorId,
        },
      });
    } else {
      await prisma.leaderboardConfig.create({
        data: {
          name: lb.name,
          nameKey: lb.nameKey,
          metricType: lb.metricType,
          period: lb.period,
          maxEntries: lb.maxEntries,
          enabled: true,
          createdBy: seedActorId,
          updatedBy: seedActorId,
        },
      });
    }
  }
  console.log(`  ✅ ${LEADERBOARDS.length} leaderboard configs upserted`);

  // 4. Audit log
  await prisma.adminAuditLog.create({
    data: {
      actorId: seedActorId,
      action: "seed_gamification",
      targetType: "gamification",
      targetId: "gamification-seed-v1",
      after: {
        achievements: ACHIEVEMENTS.length,
        tiers: ACHIEVEMENTS.length * 4,
        streaks: STREAK_CONFIGS.length,
        leaderboards: LEADERBOARDS.length,
      },
    },
  });

  console.log("\n✅ Gamification seed complete!");
  console.log(`  🎖️  ${ACHIEVEMENTS.length} achievements (${ACHIEVEMENTS.length * 4} tiers)`);
  console.log(`  🔥 ${STREAK_CONFIGS.length} streak configs`);
  console.log(`  📊 ${LEADERBOARDS.length} leaderboard configs`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
