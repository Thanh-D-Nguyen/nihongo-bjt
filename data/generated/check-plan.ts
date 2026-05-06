import { createPrismaClient } from "../../packages/database/src/index.js";

const prisma = createPrismaClient();

async function main() {
  const plan = await prisma.plan.findFirst({
    where: { slug: "free", status: "active" },
    include: { planQuotas: { include: { quotaPolicy: true } } },
  });
  console.log("Free plan:", plan ? "EXISTS" : "MISSING");
  if (plan) {
    console.log(
      "Quotas:",
      plan.planQuotas.map((q) => `${q.quotaPolicy.key}=${q.limitValue}`).join(", ")
    );
  }

  const allPlans = await prisma.plan.findMany({
    select: { slug: true, status: true },
  });
  console.log("All plans:", allPlans);

  // Check user subscription
  const userId = "f365c1a2-1a53-41aa-be47-6f3da42ab570";
  const sub = await prisma.userSubscription.findFirst({
    where: { userId, status: { in: ["active", "trialing"] } },
    select: { id: true, status: true, plan: { select: { slug: true } } },
  });
  console.log("User subscription:", sub ?? "NONE");
}

main().catch((e) => console.error(e.message)).finally(() => prisma.$disconnect());
