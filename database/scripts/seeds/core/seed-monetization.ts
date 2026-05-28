import { parseServerEnv } from "../../../../packages/config/src/index.js";
import { createPrismaClient } from "../../../../packages/database/src/index.js";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

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
  const eSuggestCards = await prisma.entitlementDefinition.upsert({
    create: {
      key: "flashcard.suggest_cards",
      description: "AI-powered card suggestions for deck composition"
    },
    update: { description: "AI-powered card suggestions for deck composition" },
    where: { key: "flashcard.suggest_cards" }
  });
  const eAdaptiveGen = await prisma.entitlementDefinition.upsert({
    create: {
      key: "flashcard.adaptive_gen",
      description: "Adaptive flashcard generation based on learning history"
    },
    update: { description: "Adaptive flashcard generation based on learning history" },
    where: { key: "flashcard.adaptive_gen" }
  });
  const qFlash = await prisma.quotaPolicy.upsert({
    create: { key: "flashcard_reviews_per_day", windowCode: "day" },
    update: {},
    where: { key: "flashcard_reviews_per_day" }
  });
  const qImageSearch = await prisma.quotaPolicy.upsert({
    create: { key: "image_search_daily", windowCode: "day" },
    update: {},
    where: { key: "image_search_daily" }
  });
  const free = await prisma.plan.upsert({
    create: {
      config: {
        displayName: "Free",
        displayNameVi: "Miễn phí",
        displayNameJa: "無料",
        price: 0,
        billingInterval: "month"
      },
      nameKey: "plan.free.name",
      slug: "free"
    },
    update: {
      config: {
        displayName: "Free",
        displayNameVi: "Miễn phí",
        displayNameJa: "無料",
        price: 0,
        billingInterval: "month"
      },
      status: "active"
    },
    where: { slug: "free" }
  });
  const plus = await prisma.plan.upsert({
    create: {
      config: {
        displayName: "Plus",
        displayNameVi: "Plus",
        displayNameJa: "プラス",
        price: 79000,
        billingInterval: "month",
        recommended: true
      },
      nameKey: "plan.plus.name",
      slug: "plus",
      sortOrder: 10
    },
    update: {
      config: {
        displayName: "Plus",
        displayNameVi: "Plus",
        displayNameJa: "プラス",
        price: 79000,
        billingInterval: "month",
        recommended: true
      },
      status: "active"
    },
    where: { slug: "plus" }
  });
  const standard = await prisma.plan.upsert({
    create: {
      config: {
        displayName: "Standard",
        displayNameVi: "Standard",
        displayNameJa: "スタンダード",
        price: 149000,
        billingInterval: "month"
      },
      nameKey: "plan.standard.name",
      slug: "standard",
      sortOrder: 20
    },
    update: {
      config: {
        displayName: "Standard",
        displayNameVi: "Standard",
        displayNameJa: "スタンダード",
        price: 149000,
        billingInterval: "month"
      },
      status: "active"
    },
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
  await prisma.planEntitlement.upsert({
    create: { entitlementId: eSuggestCards.id, planId: plus.id },
    update: {},
    where: { planId_entitlementId: { entitlementId: eSuggestCards.id, planId: plus.id } }
  });
  for (const entitlement of [
    eBasic,
    eDeckCreate,
    eQuizStart,
    eQuizOfficialSimulation,
    eAds,
    eAdsRemove,
    eSuggestCards,
    eAdaptiveGen
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
    create: { limitValue: 5, planId: free.id, quotaPolicyId: qImageSearch.id },
    update: { limitValue: 5 },
    where: { planId_quotaPolicyId: { planId: free.id, quotaPolicyId: qImageSearch.id } }
  });
  await prisma.planQuota.upsert({
    create: { limitValue: 200, planId: plus.id, quotaPolicyId: qFlash.id },
    update: { limitValue: 200 },
    where: { planId_quotaPolicyId: { planId: plus.id, quotaPolicyId: qFlash.id } }
  });
  await prisma.planQuota.upsert({
    create: { limitValue: 50, planId: plus.id, quotaPolicyId: qImageSearch.id },
    update: { limitValue: 50 },
    where: { planId_quotaPolicyId: { planId: plus.id, quotaPolicyId: qImageSearch.id } }
  });
  const eFlashcardStyles = await prisma.entitlementDefinition.upsert({
    create: {
      key: "flashcard.premium_styles",
      description: "Access to premium and exclusive flashcard visual styles",
      category: "flashcard"
    },
    update: {
      description: "Access to premium and exclusive flashcard visual styles",
      category: "flashcard"
    },
    where: { key: "flashcard.premium_styles" }
  });
  await prisma.planQuota.upsert({
    create: { limitValue: 500, planId: standard.id, quotaPolicyId: qFlash.id },
    update: { limitValue: 500 },
    where: { planId_quotaPolicyId: { planId: standard.id, quotaPolicyId: qFlash.id } }
  });
  await prisma.planQuota.upsert({
    create: { limitValue: 200, planId: standard.id, quotaPolicyId: qImageSearch.id },
    update: { limitValue: 200 },
    where: { planId_quotaPolicyId: { planId: standard.id, quotaPolicyId: qImageSearch.id } }
  });
  // Link premium styles entitlement to plus and standard plans
  for (const plan of [plus, standard]) {
    await prisma.planEntitlement.upsert({
      create: { entitlementId: eFlashcardStyles.id, planId: plan.id },
      update: {},
      where: { planId_entitlementId: { entitlementId: eFlashcardStyles.id, planId: plan.id } }
    });
  }
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
