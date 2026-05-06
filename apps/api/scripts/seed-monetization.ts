import { parseServerEnv } from "@nihongo-bjt/config";
import { createPrismaClient } from "@nihongo-bjt/database";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);

async function main() {
  const eBasic = await prisma.entitlementDefinition.upsert({
    create: { key: "learner.basic" },
    update: {},
    where: { key: "learner.basic" }
  });
  const eDeckCreate = await prisma.entitlementDefinition.upsert({
    create: { key: "flashcard.deck.create" },
    update: {},
    where: { key: "flashcard.deck.create" }
  });
  const eQuizStart = await prisma.entitlementDefinition.upsert({
    create: { key: "quiz.bjt.start" },
    update: {},
    where: { key: "quiz.bjt.start" }
  });
  const eQuizOfficialSimulation = await prisma.entitlementDefinition.upsert({
    create: {
      category: "bjt",
      description: "Access paid official-format BJT simulation templates.",
      key: "quiz.official_simulation"
    },
    update: {
      category: "bjt",
      description: "Access paid official-format BJT simulation templates."
    },
    where: { key: "quiz.official_simulation" }
  });
  const eAdsRemove = await prisma.entitlementDefinition.upsert({
    create: { key: "ads.remove" },
    update: {},
    where: { key: "ads.remove" }
  });
  const eAds = await prisma.entitlementDefinition.upsert({
    create: { key: "ads.reduced" },
    update: {},
    where: { key: "ads.reduced" }
  });
  const qFlash = await prisma.quotaPolicy.upsert({
    create: { key: "flashcard_reviews_per_day", windowCode: "day" },
    update: {},
    where: { key: "flashcard_reviews_per_day" }
  });
  const free = await prisma.plan.upsert({
    create: { nameKey: "plan.free.name", slug: "free" },
    update: { status: "active" },
    where: { slug: "free" }
  });
  const plus = await prisma.plan.upsert({
    create: { nameKey: "plan.plus.name", slug: "plus", sortOrder: 10 },
    update: { status: "active" },
    where: { slug: "plus" }
  });
  const standard = await prisma.plan.upsert({
    create: { nameKey: "plan.standard.name", slug: "standard", sortOrder: 20 },
    update: { status: "active" },
    where: { slug: "standard" }
  });
  await prisma.planEntitlement.upsert({
    create: { entitlementId: eBasic.id, planId: free.id },
    update: {},
    where: { planId_entitlementId: { entitlementId: eBasic.id, planId: free.id } }
  });
  for (const entitlement of [eDeckCreate, eQuizStart]) {
    await prisma.planEntitlement.upsert({
      create: { entitlementId: entitlement.id, planId: free.id },
      update: {},
      where: { planId_entitlementId: { entitlementId: entitlement.id, planId: free.id } }
    });
  }
  await prisma.planEntitlement.upsert({
    create: { entitlementId: eBasic.id, planId: plus.id },
    update: {},
    where: { planId_entitlementId: { entitlementId: eBasic.id, planId: plus.id } }
  });
  await prisma.planEntitlement.upsert({
    create: { entitlementId: eAds.id, planId: plus.id },
    update: {},
    where: { planId_entitlementId: { entitlementId: eAds.id, planId: plus.id } }
  });
  for (const entitlement of [
    eBasic,
    eDeckCreate,
    eQuizStart,
    eQuizOfficialSimulation,
    eAds,
    eAdsRemove
  ]) {
    await prisma.planEntitlement.upsert({
      create: { entitlementId: entitlement.id, planId: standard.id },
      update: {},
      where: { planId_entitlementId: { entitlementId: entitlement.id, planId: standard.id } }
    });
  }
  await prisma.planQuota.upsert({
    create: { limitValue: 20, planId: free.id, quotaPolicyId: qFlash.id },
    update: { limitValue: 20 },
    where: { planId_quotaPolicyId: { planId: free.id, quotaPolicyId: qFlash.id } }
  });
  await prisma.planQuota.upsert({
    create: { limitValue: 200, planId: plus.id, quotaPolicyId: qFlash.id },
    update: { limitValue: 200 },
    where: { planId_quotaPolicyId: { planId: plus.id, quotaPolicyId: qFlash.id } }
  });
  await prisma.planQuota.upsert({
    create: { limitValue: 500, planId: standard.id, quotaPolicyId: qFlash.id },
    update: { limitValue: 500 },
    where: { planId_quotaPolicyId: { planId: standard.id, quotaPolicyId: qFlash.id } }
  });
  await prisma.adPlacement.upsert({
    create: {
      code: "home_feed_banner",
      config: { format: "banner" },
      labelKey: "ad.placement.homeFeedBanner"
    },
    update: { active: true },
    where: { code: "home_feed_banner" }
  });
  console.log(
    "Monetization seed done (free/plus/standard plans, entitlements, quotas, sample ad placement)."
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
