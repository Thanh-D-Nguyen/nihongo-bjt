import { Injectable } from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";

const BJT_LEVELS = ["BJT-J5", "BJT-J4", "BJT-J3", "BJT-J2", "BJT-J1"] as const;
const PASS_RATIO = 0.7; // ≥70% correct counts as a pass for the dashboard.
const RECENT_DAYS = 30;
const TOP_TOPICS_LIMIT = 5;
const UPCOMING_LIMIT = 5;
const PASS_RATE_BUCKET_DAYS = 7; // weekly buckets over last 12 weeks

export type BjtDashboardSummary = {
  generatedAt: string;
  range: { recentDays: number };
  kpis: {
    learnersTotal: number;
    learnersByLevel: { level: string; count: number }[];
    publishedMockExams: number;
    sessionsRecent: number;
    sessionsCompletedRecent: number;
    passRateRecent: number | null;
    avgScoreRecent: number | null;
  };
  passRateByLevelRecent: { level: string; sessions: number; passes: number; passRate: number | null }[];
  passRateTimeseries: { weekStart: string; sessions: number; passes: number; passRate: number | null }[];
  topTopicsRecent: { skillTag: string; attempts: number; correct: number; accuracy: number | null }[];
  upcomingMockExams: {
    id: string;
    slug: string;
    titleVi: string;
    titleJa: string | null;
    level: string | null;
    type: string;
    status: string;
    scheduledAt: string | null;
    timeLimitSeconds: number | null;
  }[];
  dropOffSections: {
    sectionCode: string;
    sectionTitleVi: string;
    testTitleVi: string;
    answeredQuestions: number;
    accuracy: number | null;
  }[];
  freshness: {
    lastSessionAt: string | null;
    lastQuestionAt: string | null;
  };
};

@Injectable()
export class BjtDashboardAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async summary(): Promise<BjtDashboardSummary> {
    const now = new Date();
    const recentSince = new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000);
    const weeksAgo = new Date(now.getTime() - PASS_RATE_BUCKET_DAYS * 12 * 24 * 60 * 60 * 1000);

    const [
      learnerLevels,
      publishedMockExams,
      sessionsRecent,
      sessionsCompletedRecent,
      completedSessionsForPass,
      completedSessionsForBuckets,
      sectionsForTopics,
      upcoming,
      sectionAggregate,
      lastSession,
      lastQuestion
    ] = await Promise.all([
      this.prisma.userProfile.groupBy({
        by: ["targetBjtBand"],
        _count: { _all: true },
        where: {
          status: "active",
          targetBjtBand: { in: [...BJT_LEVELS] }
        }
      }),
      this.prisma.bjtMockTest.count({ where: { status: "published" } }),
      this.prisma.quizSession.count({ where: { startedAt: { gte: recentSince } } }),
      this.prisma.quizSession.count({
        where: { completedAt: { gte: recentSince }, status: "completed" }
      }),
      this.prisma.quizSession.findMany({
        select: {
          correctCount: true,
          totalQuestions: true,
          test: { select: { level: true } }
        },
        where: {
          completedAt: { gte: recentSince },
          status: "completed",
          totalQuestions: { gt: 0 }
        }
      }),
      this.prisma.quizSession.findMany({
        select: {
          completedAt: true,
          correctCount: true,
          totalQuestions: true
        },
        where: {
          completedAt: { gte: weeksAgo },
          status: "completed",
          totalQuestions: { gt: 0 }
        }
      }),
      this.prisma.quizAnswer.findMany({
        select: { isCorrect: true, question: { select: { skillTag: true } } },
        where: { answeredAt: { gte: recentSince } },
        take: 50_000
      }),
      this.prisma.bjtMockTest.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          slug: true,
          titleVi: true,
          titleJa: true,
          type: true,
          status: true,
          level: true,
          timeLimitSeconds: true,
          blueprintMeta: true,
          updatedAt: true
        },
        take: UPCOMING_LIMIT * 4,
        where: { status: { in: ["scheduled", "published", "draft"] } }
      }),
      this.prisma.quizAnswer.findMany({
        select: {
          isCorrect: true,
          question: {
            select: {
              section: {
                select: {
                  code: true,
                  titleVi: true,
                  test: { select: { titleVi: true } }
                }
              }
            }
          }
        },
        where: { answeredAt: { gte: recentSince } },
        take: 50_000
      }),
      this.prisma.quizSession.findFirst({
        orderBy: { startedAt: "desc" },
        select: { startedAt: true }
      }),
      this.prisma.quizAnswer.findFirst({
        orderBy: { answeredAt: "desc" },
        select: { answeredAt: true }
      })
    ]);

    /* ── learners by level ── */
    const learnerCounts = new Map<string, number>();
    for (const row of learnerLevels) {
      if (row.targetBjtBand) learnerCounts.set(row.targetBjtBand, row._count._all);
    }
    const learnersByLevel = BJT_LEVELS.map((level) => ({
      level,
      count: learnerCounts.get(level) ?? 0
    }));
    const learnersTotal = learnersByLevel.reduce((acc, e) => acc + e.count, 0);

    /* ── pass rate (recent) ── */
    let totalPassRecent = 0;
    let totalSessionsForPass = 0;
    let scoreSum = 0;
    const byLevel = new Map<string, { sessions: number; passes: number }>();
    for (const s of completedSessionsForPass) {
      if (s.totalQuestions <= 0) continue;
      const ratio = s.correctCount / s.totalQuestions;
      const passed = ratio >= PASS_RATIO;
      totalSessionsForPass += 1;
      scoreSum += ratio;
      if (passed) totalPassRecent += 1;
      const key = s.test?.level ?? "unspecified";
      const cur = byLevel.get(key) ?? { sessions: 0, passes: 0 };
      cur.sessions += 1;
      if (passed) cur.passes += 1;
      byLevel.set(key, cur);
    }
    const passRateRecent = totalSessionsForPass > 0 ? totalPassRecent / totalSessionsForPass : null;
    const avgScoreRecent = totalSessionsForPass > 0 ? scoreSum / totalSessionsForPass : null;

    const passRateByLevelRecent: BjtDashboardSummary["passRateByLevelRecent"] = [];
    for (const level of BJT_LEVELS) {
      const r = byLevel.get(level);
      passRateByLevelRecent.push({
        level,
        sessions: r?.sessions ?? 0,
        passes: r?.passes ?? 0,
        passRate: r && r.sessions > 0 ? r.passes / r.sessions : null
      });
    }
    if (byLevel.has("unspecified")) {
      const r = byLevel.get("unspecified")!;
      passRateByLevelRecent.push({
        level: "unspecified",
        sessions: r.sessions,
        passes: r.passes,
        passRate: r.sessions > 0 ? r.passes / r.sessions : null
      });
    }

    /* ── pass rate timeseries (weekly buckets) ── */
    const buckets = new Map<string, { sessions: number; passes: number }>();
    for (const s of completedSessionsForBuckets) {
      if (!s.completedAt || s.totalQuestions <= 0) continue;
      const startMs = Math.floor(s.completedAt.getTime() / (PASS_RATE_BUCKET_DAYS * 24 * 60 * 60 * 1000)) *
        (PASS_RATE_BUCKET_DAYS * 24 * 60 * 60 * 1000);
      const key = new Date(startMs).toISOString().slice(0, 10);
      const cur = buckets.get(key) ?? { sessions: 0, passes: 0 };
      cur.sessions += 1;
      if (s.correctCount / s.totalQuestions >= PASS_RATIO) cur.passes += 1;
      buckets.set(key, cur);
    }
    const passRateTimeseries = Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([weekStart, b]) => ({
        weekStart,
        sessions: b.sessions,
        passes: b.passes,
        passRate: b.sessions > 0 ? b.passes / b.sessions : null
      }));

    /* ── top topics ── */
    const topicAgg = new Map<string, { attempts: number; correct: number }>();
    for (const a of sectionsForTopics) {
      const tag = a.question?.skillTag ?? "unknown";
      const cur = topicAgg.get(tag) ?? { attempts: 0, correct: 0 };
      cur.attempts += 1;
      if (a.isCorrect) cur.correct += 1;
      topicAgg.set(tag, cur);
    }
    const topTopicsRecent = Array.from(topicAgg.entries())
      .map(([skillTag, v]) => ({
        skillTag,
        attempts: v.attempts,
        correct: v.correct,
        accuracy: v.attempts > 0 ? v.correct / v.attempts : null
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, TOP_TOPICS_LIMIT);

    /* ── upcoming mock exams ── */
    const upcomingMockExams = upcoming
      .map((t) => {
        let scheduledAt: string | null = null;
        const meta = t.blueprintMeta as Record<string, unknown> | null;
        if (meta && typeof meta === "object") {
          const candidate = (meta["scheduledAt"] ?? meta["releaseAt"] ?? null) as unknown;
          if (typeof candidate === "string") scheduledAt = candidate;
        }
        return {
          id: t.id,
          slug: t.slug,
          titleVi: t.titleVi,
          titleJa: t.titleJa,
          level: t.level,
          type: t.type,
          status: t.status,
          scheduledAt,
          timeLimitSeconds: t.timeLimitSeconds
        };
      })
      .filter((t) => {
        if (!t.scheduledAt) return t.status === "scheduled" || t.status === "published";
        return new Date(t.scheduledAt).getTime() >= now.getTime();
      })
      .slice(0, UPCOMING_LIMIT);

    /* ── drop-off sections (lowest accuracy among recently active sections) ── */
    const sectionAgg = new Map<
      string,
      { sectionCode: string; sectionTitleVi: string; testTitleVi: string; answered: number; correct: number }
    >();
    for (const a of sectionAggregate) {
      const sec = a.question?.section;
      if (!sec) continue;
      const code = sec.code ?? "";
      const testTitle = sec.test?.titleVi ?? "";
      const key = `${testTitle}::${code}`;
      const cur = sectionAgg.get(key) ?? {
        sectionCode: code,
        sectionTitleVi: sec.titleVi ?? code,
        testTitleVi: testTitle,
        answered: 0,
        correct: 0
      };
      cur.answered += 1;
      if (a.isCorrect) cur.correct += 1;
      sectionAgg.set(key, cur);
    }
    const dropOffSections = Array.from(sectionAgg.values())
      .filter((r) => r.answered >= 10)
      .map((r) => ({
        sectionCode: r.sectionCode,
        sectionTitleVi: r.sectionTitleVi,
        testTitleVi: r.testTitleVi,
        answeredQuestions: r.answered,
        accuracy: r.answered > 0 ? r.correct / r.answered : null
      }))
      .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))
      .slice(0, 5);

    return {
      generatedAt: now.toISOString(),
      range: { recentDays: RECENT_DAYS },
      kpis: {
        learnersTotal,
        learnersByLevel,
        publishedMockExams,
        sessionsRecent,
        sessionsCompletedRecent,
        passRateRecent,
        avgScoreRecent
      },
      passRateByLevelRecent,
      passRateTimeseries,
      topTopicsRecent,
      upcomingMockExams,
      dropOffSections,
      freshness: {
        lastSessionAt: lastSession?.startedAt?.toISOString() ?? null,
        lastQuestionAt: lastQuestion?.answeredAt?.toISOString() ?? null
      }
    };
  }
}
