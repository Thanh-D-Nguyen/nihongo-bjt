import { parseServerEnv } from "@nihongo-bjt/config";
import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

const defaultPlacements: Array<{
  code: string;
  config: Prisma.InputJsonValue;
  labelKey: string;
}> = [
  {
    code: "home_feed_inline",
    config: {
      allowedPlanSlugs: ["free", "basic", "standard", "premium"],
      learningSafe: true,
      location: "inline",
      maxPerDay: 12,
      providerKey: "local",
      surface: "home"
    },
    labelKey: "ads.placement.home_feed_inline"
  },
  {
    code: "dictionary_result_inline",
    config: {
      allowedPlanSlugs: ["free", "basic", "standard", "premium"],
      learningSafe: true,
      location: "inline",
      maxPerDay: 20,
      providerKey: "local",
      surface: "dictionary"
    },
    labelKey: "ads.placement.dictionary_result_inline"
  },
  {
    code: "dictionary_detail_bottom",
    config: {
      allowedPlanSlugs: ["free", "basic", "standard", "premium"],
      learningSafe: true,
      location: "bottom",
      maxPerDay: 20,
      providerKey: "local",
      surface: "dictionary"
    },
    labelKey: "ads.placement.dictionary_detail_bottom"
  },
  {
    code: "daily_life_hub_inline",
    config: {
      allowedPlanSlugs: ["free", "basic", "standard", "premium"],
      learningSafe: true,
      location: "inline",
      maxPerDay: 12,
      providerKey: "local",
      surface: "daily"
    },
    labelKey: "ads.placement.daily_life_hub_inline"
  },
  {
    code: "quiz_result_bottom",
    config: {
      allowedPlanSlugs: ["free", "basic", "standard", "premium"],
      learningSafe: true,
      location: "bottom",
      maxPerDay: 8,
      providerKey: "local",
      surface: "quiz"
    },
    labelKey: "ads.placement.quiz_result_bottom"
  },
  {
    code: "flashcard_session_end",
    config: {
      allowedPlanSlugs: ["free", "basic", "standard", "premium"],
      learningSafe: true,
      location: "end",
      maxPerDay: 4,
      providerKey: "local",
      surface: "flashcards"
    },
    labelKey: "ads.placement.flashcard_session_end"
  },
  {
    code: "free_user_upgrade_panel",
    config: {
      allowedPlanSlugs: ["free"],
      learningSafe: true,
      location: "panel",
      maxPerDay: 6,
      providerKey: "local",
      surface: "upgrade"
    },
    labelKey: "ads.placement.free_user_upgrade_panel"
  }
];

async function main() {
  await prisma.adProviderConfig.upsert({
    create: {
      config: { label: "local_dev" },
      enabled: true,
      key: "local",
      status: "ok",
      type: "local"
    },
    update: { enabled: true, status: "ok", type: "local" },
    where: { key: "local" }
  });

  await prisma.adSafetyRule.upsert({
    create: {
      config: { sessionKinds: ["flashcard_review", "bjt_timed", "quiz_active"] },
      enabled: true,
      ruleKey: "learning_session_blocks"
    },
    update: {},
    where: { ruleKey: "learning_session_blocks" }
  });

  await prisma.adSafetyRule.upsert({
    create: {
      config: { required: false },
      enabled: true,
      ruleKey: "require_personalized_ads_opt_in"
    },
    update: {},
    where: { ruleKey: "require_personalized_ads_opt_in" }
  });

  for (const p of defaultPlacements) {
    const existing = await prisma.adPlacement.findFirst({ where: { code: p.code } });
    if (existing) {
      continue;
    }
    await prisma.adPlacement.create({
      data: { active: true, code: p.code, config: p.config, labelKey: p.labelKey }
    });
  }
  // eslint-disable-next-line no-console
  console.log("Seeded ad provider, safety rules, and default placements (missing only).");
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
