import { createPrismaClient } from "../../packages/database/src/index.js";

const prisma = createPrismaClient();

async function main() {
  const userId = "f365c1a2-1a53-41aa-be47-6f3da42ab570";

  // Reset usage counters for this user
  const deleted = await prisma.usageCounter.deleteMany({
    where: { userId, quotaKey: "quiz.bjt.start" },
  });
  console.log("Deleted quiz start counters:", deleted.count);

  // Also add quiz.bjt.start quota to free plan if missing
  const freePlan = await prisma.plan.findFirst({
    where: { slug: "free", status: "active" },
    include: { planQuotas: { include: { quotaPolicy: true } } },
  });

  if (!freePlan) {
    console.log("ERROR: No free plan!");
    return;
  }

  const hasQuizQuota = freePlan.planQuotas.some(
    (q) => q.quotaPolicy.key === "quiz.bjt.start"
  );

  if (!hasQuizQuota) {
    console.log("Adding quiz.bjt.start quota policy to free plan...");

    // Find or create quota policy
    let policy = await prisma.quotaPolicy.findFirst({
      where: { key: "quiz.bjt.start" },
    });

    if (!policy) {
      policy = await prisma.quotaPolicy.create({
        data: {
          key: "quiz.bjt.start",
          description: "Maximum BJT quiz starts per day",
          windowCode: "daily",
        },
      });
      console.log("Created quota policy:", policy.id);
    }

    // Link to free plan with limit 5
    await prisma.planQuota.create({
      data: {
        planId: freePlan.id,
        quotaPolicyId: policy.id,
        limitValue: 5,
      },
    });
    console.log("Added quiz.bjt.start=5 to free plan");

    // Also add to plus/standard plans with higher limits
    const otherPlans = await prisma.plan.findMany({
      where: { slug: { in: ["plus", "standard"] }, status: "active" },
    });

    for (const plan of otherPlans) {
      await prisma.planQuota.create({
        data: {
          planId: plan.id,
          quotaPolicyId: policy.id,
          limitValue: plan.slug === "standard" ? 50 : 20,
        },
      });
      console.log(`Added quiz.bjt.start=${plan.slug === "standard" ? 50 : 20} to ${plan.slug} plan`);
    }
  } else {
    console.log("quiz.bjt.start quota already exists on free plan");
  }

  // Verify
  const updated = await prisma.plan.findFirst({
    where: { slug: "free", status: "active" },
    include: { planQuotas: { include: { quotaPolicy: true } } },
  });
  console.log(
    "Free plan quotas:",
    updated?.planQuotas.map((q) => `${q.quotaPolicy.key}=${q.limitValue}`)
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
