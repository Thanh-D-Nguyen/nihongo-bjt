import { parseServerEnv } from "@nihongo-bjt/config";
import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { percentage } from "@nihongo-bjt/shared";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const env = parseServerEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);
const requestedDate = process.argv.find((arg) => arg.startsWith("--date="))?.split("=")[1];

interface MetricInput {
  dimensionKey?: string;
  dimensionType?: string;
  metricName: string;
  value: number;
}

function dayWindow(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { end, start };
}

async function main() {
  const dateKey = requestedDate ?? new Date().toISOString().slice(0, 10);
  const { end, start } = dayWindow(dateKey);
  const run = await prisma.analyticsRollupRun.create({
    data: { name: "daily_core_metrics", windowEnd: end, windowStart: start }
  });

  try {
    const [reviews, answers, correctAnswers, completedSessions, auditWrites, searchEvents] =
      await Promise.all([
        prisma.reviewEvent.findMany({
          select: { rating: true, userId: true },
          where: { reviewedAt: { gte: start, lt: end } }
        }),
        prisma.quizAnswer.count({ where: { answeredAt: { gte: start, lt: end } } }),
        prisma.quizAnswer.count({
          where: { answeredAt: { gte: start, lt: end }, isCorrect: true }
        }),
        prisma.quizSession.count({
          where: { completedAt: { gte: start, lt: end }, status: "completed" }
        }),
        prisma.adminAuditLog.count({ where: { createdAt: { gte: start, lt: end } } }),
        prisma.analyticsEvent.count({
          where: { createdAt: { gte: start, lt: end }, eventName: "content_search_submitted" }
        })
      ]);

    const activeUsers = new Set(reviews.map((review) => review.userId)).size;
    const metrics: MetricInput[] = [
      { metricName: "learner.active_users", value: activeUsers },
      { metricName: "flashcards.reviews", value: reviews.length },
      {
        metricName: "flashcards.rating.again",
        value: reviews.filter((item) => item.rating === "again").length
      },
      {
        metricName: "flashcards.rating.hard",
        value: reviews.filter((item) => item.rating === "hard").length
      },
      {
        metricName: "flashcards.rating.good",
        value: reviews.filter((item) => item.rating === "good").length
      },
      { metricName: "assessment.answers", value: answers },
      { metricName: "assessment.correct_answers", value: correctAnswers },
      { metricName: "assessment.accuracy_pct", value: percentage(correctAnswers, answers) },
      { metricName: "assessment.sessions_completed", value: completedSessions },
      { metricName: "content.search_events", value: searchEvents },
      { metricName: "ops.admin_writes", value: auditWrites }
    ];

    await prisma.$transaction([
      prisma.analyticsDailyMetric.deleteMany({ where: { metricDate: start } }),
      ...metrics.map((metric) =>
        prisma.analyticsDailyMetric.create({
          data: {
            dimensionKey: metric.dimensionKey ?? "all",
            dimensionType: metric.dimensionType ?? "global",
            metricDate: start,
            metricName: metric.metricName,
            value: metric.value
          }
        })
      )
    ]);

    await prisma.analyticsRollupRun.update({
      data: {
        completedAt: new Date(),
        details: { dateKey } as Prisma.InputJsonValue,
        metrics: metrics.length,
        status: "completed"
      },
      where: { id: run.id }
    });

    console.log(`Rolled up ${metrics.length} analytics metrics for ${dateKey}`);
  } catch (error) {
    await prisma.analyticsRollupRun.update({
      data: { completedAt: new Date(), details: { error: String(error) }, status: "failed" },
      where: { id: run.id }
    });
    throw error;
  }
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
