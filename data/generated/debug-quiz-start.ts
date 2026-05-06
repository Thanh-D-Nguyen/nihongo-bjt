import { createPrismaClient, Prisma } from "../../packages/database/src/index.js";

const prisma = createPrismaClient();
const userId = "f365c1a2-1a53-41aa-be47-6f3da42ab570";
const testId = "3b907a19-3ac3-4a7f-8107-bc48bd895beb"; // J5

async function main() {
  console.log("=== Simulating quiz start ===\n");

  // Step 1: Check test exists
  const test = await prisma.bjtMockTest.findFirst({
    include: {
      sections: {
        include: { questions: { select: { id: true } } },
      },
    },
    where: { id: testId, status: "published" },
  });
  console.log("Test found:", test ? `${test.slug} (${test.sections.length} sections)` : "NOT FOUND");

  if (!test) {
    console.log("FAIL: Test not found");
    return;
  }

  const totalQuestions = test.sections.reduce(
    (count, section) => count + section.questions.length,
    0
  );
  console.log("Total questions:", totalQuestions);

  // Step 2: Check plan resolution
  const sub = await prisma.userSubscription.findFirst({
    include: {
      plan: {
        include: {
          entitlements: { include: { entitlement: true } },
          planQuotas: { include: { quotaPolicy: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    where: {
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
      status: { in: ["active", "trialing"] },
      userId,
    },
  });
  console.log("Subscription:", sub ? sub.plan.slug : "NONE");

  const free = await prisma.plan.findFirst({
    include: {
      entitlements: { include: { entitlement: true } },
      planQuotas: { include: { quotaPolicy: true } },
    },
    where: { slug: "free", status: "active" },
  });
  console.log("Free plan:", free ? "EXISTS" : "MISSING");
  if (free) {
    console.log("  Quotas:", free.planQuotas.map((q) => `${q.quotaPolicy.key}=${q.limitValue}`));
    console.log("  Has quiz.bjt.start:", free.planQuotas.some((q) => q.quotaPolicy.key === "quiz.bjt.start"));
  }

  // Step 3: Try creating session in transaction
  try {
    const session = await prisma.$transaction(
      async (tx) => {
        const s = await tx.quizSession.create({
          data: { testId, totalQuestions, userId },
        });
        console.log("Session created:", s.id);

        await tx.analyticsEvent.create({
          data: {
            eventName: "quiz_session_started",
            payload: { sessionId: s.id, testId, totalQuestions },
            source: "api",
            userId,
          },
        });
        console.log("Analytics event created");

        // Simulate quota consumption
        const quotaKey = "quiz.bjt.start";
        const limit = 3; // fallback
        const windowKey = new Date().toISOString().slice(0, 10);

        console.log("Checking quota:", { quotaKey, limit, windowKey });

        const updated = await tx.usageCounter.updateMany({
          data: { value: { increment: 1 } },
          where: { quotaKey, userId, value: { lt: limit }, windowKey },
        });
        console.log("Updated existing counter:", updated.count);

        if (updated.count === 0) {
          try {
            await tx.usageCounter.create({
              data: { quotaKey, userId, value: 1, windowKey },
            });
            console.log("Created new counter");
          } catch (e) {
            console.log("Counter create failed (race condition expected):", (e as Error).message?.slice(0, 100));
          }
        }

        return s;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    console.log("\n✓ Session started successfully:", session.id);
  } catch (e) {
    console.error("\n✗ Transaction failed:", (e as Error).message);
    console.error("Full error:", e);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
