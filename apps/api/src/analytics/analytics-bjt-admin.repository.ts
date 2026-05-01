import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

import {
  type AnalyticsBreakdownRow,
  type AnalyticsCommonFilter,
  type AnalyticsKpi,
  type AnalyticsTimeseriesPoint,
  buildKpi,
  dayBucketsBetween,
  resolveAnalyticsRange
} from "./analytics-admin.shared.js";

const DOMAIN = "bjt";
const PASS_THRESHOLD = 70;

export type BjtAnalyticsSummary = {
  domain: typeof DOMAIN;
  range: { from: string; to: string; days: number };
  filtersApplied: { level: boolean };
  kpis: AnalyticsKpi[];
  freshness: { lastRollupAt: string | null; status: string | null; sourceTable: string };
};

@Injectable()
export class AnalyticsBjtAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async summary(filter: AnalyticsCommonFilter): Promise<BjtAnalyticsSummary> {
    const r = resolveAnalyticsRange(filter);
    const where = this.sessionWhere(filter);

    const [sessions, sessionsPrev, completed, completedPrev, scoreAgg, scoreAggPrev, durationAgg, durationAggPrev, latestRun] =
      await Promise.all([
        this.prisma.quizSession.count({ where: { ...where, startedAt: { gte: r.from, lt: r.to } } }),
        this.prisma.quizSession.count({
          where: { ...where, startedAt: { gte: r.previousFrom, lt: r.previousTo } }
        }),
        this.prisma.quizSession.count({
          where: { ...where, completedAt: { gte: r.from, lt: r.to }, status: "completed" }
        }),
        this.prisma.quizSession.count({
          where: {
            ...where,
            completedAt: { gte: r.previousFrom, lt: r.previousTo },
            status: "completed"
          }
        }),
        this.scoreStats(r.from, r.to, where),
        this.scoreStats(r.previousFrom, r.previousTo, where),
        this.durationStats(r.from, r.to, where),
        this.durationStats(r.previousFrom, r.previousTo, where),
        this.prisma.analyticsRollupRun.findFirst({ orderBy: { startedAt: "desc" } })
      ]);

    return {
      domain: DOMAIN,
      filtersApplied: { level: Boolean(filter.level) },
      freshness: {
        lastRollupAt: latestRun?.completedAt?.toISOString() ?? null,
        sourceTable: "assessment.quiz_session",
        status: latestRun?.status ?? null
      },
      kpis: [
        buildKpi({ format: "int", id: "mockExamsAttempted", previous: sessionsPrev, value: sessions }),
        buildKpi({ format: "int", id: "mockExamsCompleted", previous: completedPrev, value: completed }),
        buildKpi({
          available: scoreAgg.count > 0,
          format: "percent",
          id: "averageScore",
          previous: scoreAggPrev.count > 0 ? scoreAggPrev.avg : null,
          unavailableCode: scoreAgg.count === 0 ? "no_completed_sessions" : undefined,
          value: scoreAgg.count > 0 ? scoreAgg.avg : null
        }),
        buildKpi({
          available: scoreAgg.count > 0,
          format: "percent",
          id: "passRate",
          previous: scoreAggPrev.count > 0 ? scoreAggPrev.passRate : null,
          unavailableCode: scoreAgg.count === 0 ? "no_completed_sessions" : undefined,
          value: scoreAgg.count > 0 ? scoreAgg.passRate : null
        }),
        buildKpi({
          available: durationAgg.count > 0,
          format: "duration_ms",
          id: "averageTimeOnTaskMs",
          previous: durationAggPrev.count > 0 ? durationAggPrev.avgMs : null,
          unavailableCode: durationAgg.count === 0 ? "no_completed_sessions" : undefined,
          value: durationAgg.count > 0 ? durationAgg.avgMs : null
        })
      ],
      range: { days: r.days, from: r.from.toISOString(), to: r.to.toISOString() }
    };
  }

  async timeseries(filter: AnalyticsCommonFilter & { metric: string; granularity: "day" | "hour" }) {
    const r = resolveAnalyticsRange(filter);
    if (filter.granularity !== "day") {
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        notice: "granularity_not_supported",
        series: [] as AnalyticsTimeseriesPoint[]
      };
    }
    const days = dayBucketsBetween(r.from, r.to);
    const where = this.sessionWhere(filter);
    if (filter.metric === "attempts") {
      const sessions = await this.prisma.quizSession.findMany({
        select: { startedAt: true },
        where: { ...where, startedAt: { gte: r.from, lt: r.to } }
      });
      const m = new Map<string, number>();
      for (const s of sessions) {
        const k = s.startedAt.toISOString().slice(0, 10);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        range: { days: r.days, from: r.from.toISOString(), to: r.to.toISOString() },
        series: days.map((d) => ({ t: d, value: m.get(d) ?? 0 }))
      };
    }
    if (filter.metric === "pass_rate") {
      const sessions = await this.prisma.quizSession.findMany({
        select: { completedAt: true, estimatedScore: true },
        where: {
          ...where,
          completedAt: { gte: r.from, lt: r.to, not: null },
          estimatedScore: { not: null },
          status: "completed"
        }
      });
      const map = new Map<string, { total: number; passed: number }>();
      for (const s of sessions) {
        if (!s.completedAt) continue;
        const k = s.completedAt.toISOString().slice(0, 10);
        const v = map.get(k) ?? { passed: 0, total: 0 };
        v.total += 1;
        if ((s.estimatedScore ?? 0) >= PASS_THRESHOLD) v.passed += 1;
        map.set(k, v);
      }
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        range: { days: r.days, from: r.from.toISOString(), to: r.to.toISOString() },
        series: days.map((d) => {
          const v = map.get(d);
          return { t: d, value: v && v.total > 0 ? v.passed / v.total : 0 };
        })
      };
    }
    return {
      domain: DOMAIN,
      granularity: filter.granularity,
      metric: filter.metric,
      notice: "unknown_metric",
      series: [] as AnalyticsTimeseriesPoint[]
    };
  }

  async breakdown(filter: AnalyticsCommonFilter & { dimension: string; page: number; pageSize: number }) {
    const r = resolveAnalyticsRange(filter);
    const where = this.sessionWhere(filter);
    if (filter.dimension === "by_test") {
      const sessions = await this.prisma.quizSession.findMany({
        select: {
          completedAt: true,
          estimatedScore: true,
          test: { select: { id: true, slug: true, titleVi: true } },
          testId: true
        },
        where: {
          ...where,
          completedAt: { gte: r.from, lt: r.to, not: null },
          estimatedScore: { not: null },
          status: "completed"
        }
      });
      const byTest = new Map<string, { id: string; label: string; total: number; passed: number; sumScore: number }>();
      for (const s of sessions) {
        const id = s.testId;
        const label = s.test?.titleVi ?? s.test?.slug ?? id;
        const v = byTest.get(id) ?? { id, label, passed: 0, sumScore: 0, total: 0 };
        v.total += 1;
        v.sumScore += s.estimatedScore ?? 0;
        if ((s.estimatedScore ?? 0) >= PASS_THRESHOLD) v.passed += 1;
        byTest.set(id, v);
      }
      const list = Array.from(byTest.values())
        .sort((a, b) => b.total - a.total)
        .slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize);
      const rows: AnalyticsBreakdownRow[] = list.map((v) => ({
        attempts: v.total,
        averageScore: v.total > 0 ? v.sumScore / v.total : 0,
        passRate: v.total > 0 ? v.passed / v.total : 0,
        testId: v.id,
        testLabel: v.label
      }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: filter.page,
        pageSize: filter.pageSize,
        rows,
        total: byTest.size
      };
    }
    // by_section: aggregate quiz answers by question.skillTag
    const answers = await this.prisma.quizAnswer.findMany({
      select: {
        isCorrect: true,
        question: { select: { skillTag: true } }
      },
      where: { answeredAt: { gte: r.from, lt: r.to } }
    });
    const m = new Map<string, { tag: string; total: number; correct: number }>();
    for (const a of answers) {
      const tag = a.question.skillTag || "(unknown)";
      const v = m.get(tag) ?? { correct: 0, tag, total: 0 };
      v.total += 1;
      if (a.isCorrect) v.correct += 1;
      m.set(tag, v);
    }
    const list = Array.from(m.values())
      .sort((a, b) => b.total - a.total)
      .slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize);
    const rows: AnalyticsBreakdownRow[] = list.map((v) => ({
      accuracy: v.total > 0 ? v.correct / v.total : 0,
      attempts: v.total,
      correct: v.correct,
      difficulty: v.total > 0 ? 1 - v.correct / v.total : 0,
      skillTag: v.tag
    }));
    return {
      dimension: filter.dimension || "by_section",
      domain: DOMAIN,
      page: filter.page,
      pageSize: filter.pageSize,
      rows,
      total: m.size
    };
  }

  private sessionWhere(filter: AnalyticsCommonFilter): Prisma.QuizSessionWhereInput {
    const where: Prisma.QuizSessionWhereInput = {};
    if (filter.level) where.estimatedBjtBand = filter.level;
    if (filter.configId) where.testId = filter.configId; // reuse configId param for testId filter
    return where;
  }

  private async scoreStats(from: Date, to: Date, w: Prisma.QuizSessionWhereInput) {
    const rows = await this.prisma.quizSession.findMany({
      select: { estimatedScore: true },
      where: {
        ...w,
        completedAt: { gte: from, lt: to, not: null },
        estimatedScore: { not: null },
        status: "completed"
      }
    });
    if (rows.length === 0) return { avg: 0, count: 0, passRate: 0 };
    const total = rows.reduce((a, r) => a + (r.estimatedScore ?? 0), 0);
    const passed = rows.filter((r) => (r.estimatedScore ?? 0) >= PASS_THRESHOLD).length;
    return { avg: total / rows.length / 100, count: rows.length, passRate: passed / rows.length };
  }

  private async durationStats(from: Date, to: Date, w: Prisma.QuizSessionWhereInput) {
    const rows = await this.prisma.quizSession.findMany({
      select: { completedAt: true, startedAt: true },
      where: {
        ...w,
        completedAt: { gte: from, lt: to, not: null },
        status: "completed"
      }
    });
    if (rows.length === 0) return { avgMs: 0, count: 0 };
    const total = rows.reduce((a, r) => a + ((r.completedAt as Date).getTime() - r.startedAt.getTime()), 0);
    return { avgMs: Math.round(total / rows.length), count: rows.length };
  }
}
