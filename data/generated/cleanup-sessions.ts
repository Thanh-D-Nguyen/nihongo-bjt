import { createPrismaClient } from "../../packages/database/src/index.js";

const prisma = createPrismaClient();

async function main() {
  // Clean up active sessions from debug
  const userId = "f365c1a2-1a53-41aa-be47-6f3da42ab570";
  
  const sessions = await prisma.quizSession.findMany({
    where: { userId, status: "in_progress" },
    select: { id: true, testId: true, startedAt: true },
  });
  console.log("Active sessions:", sessions.length);
  
  if (sessions.length > 0) {
    // Mark them as completed so they don't interfere
    const result = await prisma.quizSession.updateMany({
      where: { userId, status: "in_progress" },
      data: { status: "completed", completedAt: new Date() },
    });
    console.log("Cleaned up:", result.count, "sessions");
  }

  // Check usage counters
  const counters = await prisma.usageCounter.findMany({
    where: { userId },
    select: { quotaKey: true, windowKey: true, value: true },
  });
  console.log("Usage counters:", counters);
}

main().catch(console.error).finally(() => prisma.$disconnect());
