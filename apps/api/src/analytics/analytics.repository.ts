import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { coachingInsight, percentage } from "@nihongo-bjt/shared";
import { Injectable } from "@nestjs/common";

const MET = {
  activeLearner: "learner.active_users",
  reviews: "flashcards.reviews",
  sessions: "assessment.sessions_completed",
  search: "content.search_events"
} as const;

export type AdminExecutiveOptions = {
  filterLocale: "all" | "vi" | "ja";
  planSlug?: string;
  segment: "all" | "new" | "returning";
  includeMonetization: boolean;
};

function startOfUtcDay(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addUtcDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function dayKeysBetweenInclusive(start: Date, end: Date) {
  const out: string[] = [];
  const cur = startOfUtcDay(start);
  const last = startOfUtcDay(end);
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function sumMetricName(rows: { metricName: string; value: number }[], name: string) {
  return rows.filter((m) => m.metricName === name).reduce((s, m) => s + m.value, 0);
}

function keyMetricMapByDate(
  rows: { metricName: string; value: number; metricDate: Date }[],
  dayKeys: string[]
) {
  const byDay: Record<string, Record<string, number>> = {};
  for (const k of dayKeys) {
    byDay[k] = {};
  }
  for (const row of rows) {
    const k = row.metricDate.toISOString().slice(0, 10);
    if (!byDay[k]) {
      continue;
    }
    byDay[k][row.metricName] = (byDay[k][row.metricName] ?? 0) + row.value;
  }
  return byDay;
}

function kpiModel(input: {
  value: number | null;
  previous: number | null;
  available: boolean;
  unavailableCode?: string;
  format: "int" | "percent" | "time";
  sparkline?: (number | null)[] | null;
}): {
  value: number | null;
  previous: number | null;
  deltaRatio: number | null;
  available: boolean;
  unavailableCode?: string;
  format: "int" | "percent" | "time";
  sparkline?: (number | null)[] | null;
} {
  const { value, previous, available, unavailableCode, format, sparkline } = input;
  let deltaRatio: number | null = null;
  if (
    available &&
    value != null &&
    previous != null &&
    Number.isFinite(value) &&
    Number.isFinite(previous) &&
    previous !== 0
  ) {
    deltaRatio = (value - previous) / previous;
  } else if (
    available &&
    value != null &&
    previous != null &&
    previous === 0 &&
    value > 0
  ) {
    deltaRatio = 1;
  }
  return { available, deltaRatio, format, previous, sparkline: sparkline ?? null, unavailableCode, value };
}

/**
 * **Raw events** (`analytics_event`) are append-only facts; **rollups** (`analytics_daily_metric`, pipeline
 * `analytics_rollup_run`) are derived for dashboards. Do not treat metrics tables as a second source of truth
 * for domain actions — prefer rebuilding rollups from events/logs when in doubt.
 */
@Injectable()
export class AnalyticsRepository {
  private readonly prisma = createPrismaClient();

  /** Ingests a single product/analytics event (learner, admin, or API). */
  ingest(input: {
    anonymousId?: string;
    eventName: string;
    payload: Record<string, unknown>;
    sessionId?: string;
    source: "learner_web" | "admin_web" | "api";
    userId?: string;
  }) {
    return this.prisma.analyticsEvent.create({
      data: {
        anonymousId: input.anonymousId,
        eventName: input.eventName,
        payload: input.payload as Prisma.InputJsonValue,
        sessionId: input.sessionId,
        source: input.source,
        userId: input.userId
      }
    });
  }

  async learner(days: number, userId: string | undefined) {
    const { end, start } = this.range(days);
    const [reviews, answers, sessions, answersBySkill] = await Promise.all([
      this.prisma.reviewEvent.findMany({
        select: { rating: true, reviewedAt: true },
        where: { reviewedAt: { gte: start, lt: end }, ...(userId ? { userId } : {}) }
      }),
      this.prisma.quizAnswer.findMany({
        select: { answeredAt: true, isCorrect: true },
        where: {
          answeredAt: { gte: start, lt: end },
          ...(userId ? { session: { userId } } : {})
        }
      }),
      this.prisma.quizSession.findMany({
        select: { completedAt: true, estimatedBjtBand: true, estimatedScore: true, status: true },
        where: { startedAt: { gte: start, lt: end }, ...(userId ? { userId } : {}) }
      }),
      this.prisma.quizAnswer.findMany({
        select: {
          isCorrect: true,
          question: {
            select: {
              skillTag: true
            }
          }
        },
        where: {
          answeredAt: { gte: start, lt: end },
          ...(userId ? { session: { userId } } : {})
        }
      })
    ]);

    const correctAnswers = answers.filter((answer) => answer.isCorrect).length;
    const streakDays = this.streakDays(reviews.map((review) => review.reviewedAt));
    const bjtAccuracyPct = percentage(correctAnswers, answers.length);
    const weakSkills = this.weakSkillsFromAnswers(answersBySkill);

    return {
      insight: coachingInsight({ bjtAccuracyPct, reviewCount: reviews.length, streakDays }),
      range: { days, end, start },
      totals: {
        bjtAccuracyPct,
        bjtSessions: sessions.length,
        completedBjtSessions: sessions.filter((session) => session.status === "completed").length,
        correctAnswers,
        reviewCount: reviews.length,
        streakDays
      },
      weakSkills
    };
  }

  private weakSkillsFromAnswers(
    answers: Array<{ isCorrect: boolean; question: { skillTag: string } }>
  ) {
    const bySkill = new Map<string, { attempts: number; incorrect: number }>();
    for (const answer of answers) {
      const tag = answer.question.skillTag;
      const current = bySkill.get(tag) ?? { attempts: 0, incorrect: 0 };
      current.attempts += 1;
      if (!answer.isCorrect) {
        current.incorrect += 1;
      }
      bySkill.set(tag, current);
    }

    return Array.from(bySkill.entries())
      .map(([skillTag, stats]) => ({
        attempts: stats.attempts,
        failureRate: percentage(stats.incorrect, stats.attempts),
        incorrect: stats.incorrect,
        skillTag
      }))
      .filter((skill) => skill.attempts >= 3 && skill.failureRate >= 60)
      .sort((a, b) => b.failureRate - a.failureRate)
      .slice(0, 6);
  }

  /** Admin dashboard: combines pre-aggregated daily metrics, rollup job status, and raw event counts. */
  async adminExecutive(days: number, options: Partial<AdminExecutiveOptions> = {}) {
    const o: AdminExecutiveOptions = {
      filterLocale: options.filterLocale ?? "all",
      includeMonetization: options.includeMonetization ?? false,
      planSlug: options.planSlug,
      segment: options.segment ?? "all"
    };
    const { end, start } = this.range(days);
    const windowMs = end.getTime() - start.getTime();
    const previousEnd = new Date(start.getTime());
    const previousStart = new Date(start.getTime() - windowMs);
    const metricStartKey = start.toISOString().slice(0, 10);
    const metricEndKey = end.toISOString().slice(0, 10);
    const prevStartKey = previousStart.toISOString().slice(0, 10);
    const prevEndKey = previousEnd.toISOString().slice(0, 10);

    const filtersActive = o.filterLocale !== "all" || (o.planSlug && o.planSlug.length > 0) || o.segment !== "all";
    const rollupRespectsFilter = !filtersActive;
    const segmentUnsupported = o.segment !== "all";

    const [currentAndPrev, latestRun, rawEvents, userProfiles, activeContent, freePlan] = await Promise.all([
      this.prisma.analyticsDailyMetric.findMany({
        orderBy: [{ metricDate: "asc" }, { metricName: "asc" }],
        where: {
          metricDate: { gte: new Date(`${prevStartKey}T00:00:00.000Z`), lte: new Date(`${metricEndKey}T00:00:00.000Z`) }
        }
      }),
      this.prisma.analyticsRollupRun.findFirst({ orderBy: { startedAt: "desc" } }),
      this.prisma.analyticsEvent.count({ where: { createdAt: { gte: start, lt: end } } }),
      this.prisma.userProfile.count({ where: { createdAt: { lt: end }, status: "active" } }),
      Promise.all([
        this.prisma.lexeme.count({ where: { status: "active" } }),
        this.prisma.kanji.count({ where: { status: "active" } }),
        this.prisma.grammarPoint.count({ where: { status: "active" } }),
        this.prisma.exampleSentence.count({ where: { status: "active" } })
      ]),
      this.prisma.plan.findFirst({ where: { slug: "free" } })
    ]);
    const currentMetrics = currentAndPrev.filter((metric) => {
      const key = metric.metricDate.toISOString().slice(0, 10);
      return key >= metricStartKey && key <= metricEndKey;
    });
    const previousMetrics = currentAndPrev.filter((metric) => {
      const key = metric.metricDate.toISOString().slice(0, 10);
      return key >= prevStartKey && key <= prevEndKey;
    });

    const metricTotals = this.reduceMetrics(currentMetrics);
    const previousMetricTotals = this.reduceMetrics(previousMetrics);
    const dayKeys = dayKeysBetweenInclusive(new Date(`${metricStartKey}T00:00:00.000Z`), new Date(`${metricEndKey}T00:00:00.000Z`));
    const byDay = keyMetricMapByDate(
      currentMetrics as { metricName: string; value: number; metricDate: Date }[],
      dayKeys
    );
    const activeSpark = dayKeys.map((d) => byDay[d]?.[MET.activeLearner] ?? 0);
    const reviewSpark = dayKeys.map((d) => byDay[d]?.[MET.reviews] ?? 0);
    const quizSpark = dayKeys.map((d) => byDay[d]?.[MET.sessions] ?? 0);

    const byDaySeries = dayKeys.map((d) => ({
      bjtCompletions: byDay[d]?.[MET.sessions] ?? 0,
      dau: byDay[d]?.[MET.activeLearner] ?? 0,
      day: d,
      reviews: byDay[d]?.[MET.reviews] ?? 0,
      searchEventsRollup: byDay[d]?.[MET.search] ?? 0
    }));

    const now = new Date();
    const startToday = startOfUtcDay(now);
    const endToday = addUtcDays(startToday, 1);
    const startY = addUtcDays(startToday, -1);
    const endY = startToday;

    const newUserWhere = (r: { gte: Date; lt: Date }): Prisma.UserProfileWhereInput => ({
      status: "active",
      createdAt: r,
      ...(o.filterLocale !== "all" ? { uiLocale: o.filterLocale } : {}),
      ...(o.planSlug
        ? { userSubscriptions: { some: { plan: { slug: o.planSlug }, status: { in: ["active", "trialing"] } } } }
        : {})
    });

    const newUsersInRange = await this.prisma.userProfile.count({ where: newUserWhere({ gte: start, lt: end }) });
    const newUsersPrevious = await this.prisma.userProfile.count({
      where: newUserWhere({ gte: previousStart, lt: previousEnd })
    });

    const matchingUserIds: string[] | null =
      o.filterLocale === "all" && !o.planSlug
        ? null
        : (
            await this.prisma.userProfile.findMany({
              select: { id: true },
              where: {
                status: "active",
                ...(o.filterLocale !== "all" ? { uiLocale: o.filterLocale } : {}),
                ...(o.planSlug
                  ? {
                      userSubscriptions: { some: { plan: { slug: o.planSlug }, status: { in: ["active", "trialing"] } } }
                    }
                  : {})
              }
            })
          ).map((x) => x.id);

    const reviewWhere = (t0: Date, t1: Date): Prisma.ReviewEventWhereInput => {
      if (matchingUserIds && matchingUserIds.length === 0) {
        return { reviewedAt: { gte: t0, lt: t1 }, userId: { in: [] } };
      }
      return {
        reviewedAt: { gte: t0, lt: t1 },
        ...(matchingUserIds ? { userId: { in: matchingUserIds } } : {})
      };
    };

    const distinctUsers = async (t0: Date, t1: Date) => {
      const rows = await this.prisma.reviewEvent.findMany({
        select: { userId: true },
        where: reviewWhere(t0, t1)
      });
      return new Set(rows.map((e) => e.userId)).size;
    };

    const wauStart = new Date(start.getTime() - 6 * 24 * 60 * 60 * 1000);
    const wauPrev = new Date(previousStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    const wau = await distinctUsers(wauStart, end);
    const wauPrevious = await distinctUsers(wauPrev, previousEnd);

    const mauStart = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const mauPStart = new Date(previousEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    const mau = await distinctUsers(mauStart, end);
    const mauPrevious = await distinctUsers(mauPStart, previousEnd);

    const dauUsersToday = await distinctUsers(startToday, endToday);
    const dauUsersYesterday = await distinctUsers(startY, endY);
    const filterNoMatch = Boolean(matchingUserIds && matchingUserIds.length === 0);

    const d7CohortStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d7CohortEnd = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d7 = await this.d7Retention(this.prisma, { cohortEnd: d7CohortEnd, cohortStart: d7CohortStart }, o);
    const pD7CohortStart = new Date(previousStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pD7CohortEnd = new Date(previousEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d7Prev = await this.d7Retention(this.prisma, { cohortEnd: pD7CohortEnd, cohortStart: pD7CohortStart }, o);

    const searchDaily = await this.searchSuccessByDay(
      this.prisma,
      { end, start, previousEnd, previousStart }
    );
    const sCur = this.totalsSearchSuccess(searchDaily.current);
    const sPrev = this.totalsSearchSuccess(searchDaily.previous);
    const searchSuccessSpark = dayKeys.map((d) => {
      const r = searchDaily.current.find((x) => x.d === d);
      return r == null || r.total === 0 ? null : 1 - r.zero / r.total;
    });

    const cohort = await this.weeklyCohort(this.prisma, end, 4, o);
    const insights = this.buildInsights(
      { current: metricTotals, previous: previousMetricTotals, search: { c: sCur, p: sPrev } },
      latestRun
    );

    let monetization: Record<string, unknown> = { visible: false, reason: "revenue_gated" };
    if (o.includeMonetization) {
      const byPlan = await this.prisma.userSubscription.groupBy({ by: ["planId", "status"], _count: { _all: true } });
      const planIds = await this.prisma.plan.findMany({ select: { id: true, slug: true, nameKey: true } });
      const slugById = new Map(planIds.map((p) => [p.id, p] as const));
      const dist = byPlan.map((r) => ({
        count: r._count._all,
        planSlug: slugById.get(r.planId)?.slug ?? r.planId
      }));
      const paid = freePlan
        ? await this.prisma.userSubscription.count({ where: { planId: { not: freePlan.id }, status: { in: ["active", "trialing"] } } })
        : 0;
      const freeOnFree = freePlan
        ? await this.prisma.userSubscription.count({ where: { planId: freePlan.id, status: { in: ["active", "trialing"] } } })
        : 0;
      const paidConversion =
        paid + freeOnFree > 0 ? Math.round((10000 * paid) / (paid + freeOnFree)) / 100 : null;
      monetization = { conversionPercent: paidConversion, paidSubscribers: paid, planDistribution: dist, visible: true };
    }

    const studyMinutesUnavailable: { available: false; code: "minutes_not_aggregated" } = {
      available: false,
      code: "minutes_not_aggregated"
    };

    const baseReturn = {
      activeContentCount: activeContent.reduce((sum, n) => sum + n, 0),
      executive: {
        cohort,
        compareLabel: { days, key: "vs_previous" },
        filters: { applied: { locale: o.filterLocale !== "all", plan: Boolean(o.planSlug), segment: o.segment !== "all" } },
        globalRollup: { searchByDay: searchDaily.current, studyMinutes: studyMinutesUnavailable },
        insights: { ...insights, searchZeroShare: sCur && sCur.total > 0 ? sCur.zero / sCur.total : null },
        kpi: {
          activeToday: kpiModel({
            available: !filterNoMatch,
            format: "int",
            previous: filterNoMatch ? null : dauUsersYesterday,
            sparkline: activeSpark,
            unavailableCode: filterNoMatch ? "no_users_match_filters" : undefined,
            value: filterNoMatch ? null : dauUsersToday
          }),
          bjtCompletions: kpiModel({
            available: true,
            format: "int",
            previous: sumMetricName(previousMetrics, MET.sessions),
            sparkline: quizSpark,
            value: sumMetricName(currentMetrics, MET.sessions)
          }),
          d7: kpiModel({
            available: d7.retentionPercent != null,
            format: "percent",
            previous: d7Prev.retentionPercent,
            sparkline: null,
            unavailableCode: d7.unavailableCode ?? undefined,
            value: d7.retentionPercent
          }),
          dataFreshness: {
            available: true,
            completedAt: latestRun?.completedAt ? latestRun.completedAt.toISOString() : null,
            format: "time",
            runStatus: latestRun?.status ?? null
          },
          flashcardReviews: kpiModel({
            available: true,
            format: "int",
            previous: sumMetricName(previousMetrics, MET.reviews),
            sparkline: reviewSpark,
            value: sumMetricName(currentMetrics, MET.reviews)
          }),
          mau: kpiModel({
            available: !filterNoMatch,
            format: "int",
            previous: filterNoMatch ? null : mauPrevious,
            sparkline: null,
            unavailableCode: filterNoMatch ? "no_users_match_filters" : undefined,
            value: filterNoMatch ? null : mau
          }),
          monetization: monetization as Record<string, unknown>,
          newUsers: kpiModel({
            available: true,
            format: "int",
            previous: newUsersPrevious,
            sparkline: null,
            value: newUsersInRange
          }),
          searchSuccessRate: kpiModel({
            available: sCur != null && sCur.total > 0,
            format: "percent",
            previous: sPrev && sPrev.total > 0 ? 1 - sPrev.zero / sPrev.total : null,
            sparkline: searchSuccessSpark,
            unavailableCode: sCur && sCur.total > 0 ? undefined : "no_search_events",
            value: sCur && sCur.total > 0 ? 1 - sCur.zero / sCur.total : null
          }),
          wau: kpiModel({
            available: !filterNoMatch,
            format: "int",
            previous: filterNoMatch ? null : wauPrevious,
            sparkline: null,
            unavailableCode: filterNoMatch ? "no_users_match_filters" : undefined,
            value: filterNoMatch ? null : wau
          })
        },
        lastRollup: latestRun
          ? { completedAt: latestRun.completedAt?.toISOString() ?? null, status: latestRun.status }
          : null,
        mauDauWau: { byDay: byDaySeries, noteKey: "rollup_learner_active_is_flashcard" },
        previousMetricTotals,
        previousRange: { end: previousEnd, start: previousStart },
        search: sCur
          ? { current: sCur, previous: sPrev, seriesByDay: searchDaily.current }
          : { current: { total: 0, zero: 0 }, previous: sPrev, seriesByDay: searchDaily.current },
        segment: { newReturningSupported: false, value: o.segment, warningKey: segmentUnsupported ? "segment_ignored" : null },
        studyMinutes: studyMinutesUnavailable
      },
      latestRun,
      metrics: currentMetrics,
      metricTotals,
      range: { days, end, start },
      rawEvents,
      rollupAlignment: { rawMetricKeysRespectUserFilters: filtersActive, respectsFilters: rollupRespectsFilter },
      userProfiles
    };

    return baseReturn;
  }

  private reduceMetrics(metrics: { metricName: string; value: number }[]) {
    return metrics.reduce<Record<string, number>>((totals, metric) => {
      totals[metric.metricName] = (totals[metric.metricName] ?? 0) + metric.value;
      return totals;
    }, {});
  }

  private async d7Retention(
    prisma: PrismaClient,
    range: { cohortStart: Date; cohortEnd: Date },
    o: AdminExecutiveOptions
  ): Promise<{
    retentionPercent: number | null;
    unavailableCode: "segment_unsupported" | "d7_cohort_empty" | null;
  }> {
    if (o.segment !== "all") {
      return { retentionPercent: null, unavailableCode: "segment_unsupported" };
    }
    const locale = o.filterLocale === "all" ? null : o.filterLocale;
    const plan = o.planSlug;
    const rows = await prisma.$queryRaw<[{ c: bigint; r: bigint }]>`
      with cohort as (
        select p.id, p.created_at
        from profile.user_profile p
        where p.status = 'active'
        and p.created_at >= ${range.cohortStart}
        and p.created_at < ${range.cohortEnd}
        ${locale ? Prisma.sql`and p.ui_locale = ${locale}` : Prisma.empty}
        ${
          plan
            ? Prisma.sql`and exists (
            select 1 from monetization.user_subscription s
            join monetization.plan pl on pl.id = s.plan_id
            where s.user_id = p.id
            and s.status in ('active','trialing')
            and pl.slug = ${plan}
          )`
            : Prisma.empty
        }
      )
      select
        (select count(*)::bigint from cohort) as c,
        (select count(*)::bigint from cohort c0
         where exists (
           select 1 from learning.review_event r
           where r.user_id = c0.id
           and (r.reviewed_at at time zone 'UTC')::date = ((c0.created_at at time zone 'UTC')::date + interval '7 day')::date
         )) as r
    `;
    const c = Number(rows[0]?.c ?? 0n);
    const r = Number(rows[0]?.r ?? 0n);
    if (c === 0) {
      return { retentionPercent: null, unavailableCode: "d7_cohort_empty" };
    }
    return { retentionPercent: r / c, unavailableCode: null };
  }

  private async searchSuccessByDay(
    prisma: PrismaClient,
    range: { start: Date; end: Date; previousStart: Date; previousEnd: Date }
  ) {
    const [current, previous] = await Promise.all([
      prisma.$queryRaw<
        { d: string; t: bigint; z: bigint }[]
      >`select
          (e.created_at at time zone 'UTC')::date::text as d,
          count(*)::bigint as t,
          count(*) filter (
            where coalesce((e.payload->>'resultCount')::int, 0) = 0
          )::bigint as z
        from analytics.analytics_event e
        where e.event_name = 'content_search_submitted'
        and e.created_at >= ${range.start} and e.created_at < ${range.end}
        group by 1
        order by 1`,
      prisma.$queryRaw<
        { d: string; t: bigint; z: bigint }[]
      >`select
          (e.created_at at time zone 'UTC')::date::text as d,
          count(*)::bigint as t,
          count(*) filter (
            where coalesce((e.payload->>'resultCount')::int, 0) = 0
          )::bigint as z
        from analytics.analytics_event e
        where e.event_name = 'content_search_submitted'
        and e.created_at >= ${range.previousStart} and e.created_at < ${range.previousEnd}
        group by 1
        order by 1`
    ]);
    return {
      current: current.map((row) => ({ d: row.d, total: Number(row.t), zero: Number(row.z) })),
      previous: previous.map((row) => ({ d: row.d, total: Number(row.t), zero: Number(row.z) }))
    };
  }

  private totalsSearchSuccess(
    days: { d: string; total: number; zero: number }[] | null | undefined
  ): { total: number; zero: number } {
    if (!days) {
      return { total: 0, zero: 0 };
    }
    return days.reduce(
      (acc, x) => ({ total: acc.total + x.total, zero: acc.zero + x.zero }),
      { total: 0, zero: 0 }
    );
  }

  private async weeklyCohort(
    prisma: PrismaClient,
    end: Date,
    weeks: number,
    o: AdminExecutiveOptions
  ) {
    if (o.filterLocale !== "all" || o.planSlug || o.segment !== "all") {
      return { available: false, reason: "cohort_not_filtered_yet" as const, weeks: [] as { w1: number; label: string; signups: number }[] };
    }
    const out: { w1: number; label: string; signups: number }[] = [];
    for (let i = 0; i < weeks; i++) {
      const weekEnd = new Date(end.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      const su = await prisma.userProfile.count({ where: { createdAt: { gte: weekStart, lt: weekEnd }, status: "active" } });
      const w1c = su
        ? await prisma.$queryRaw<[{ c: bigint }]>`
        select count(*)::bigint as c
        from profile.user_profile p
        where p.status = 'active'
        and p.created_at >= ${weekStart}
        and p.created_at < ${weekEnd}
        and exists (
          select 1 from learning.review_event r
          where r.user_id = p.id
          and r.reviewed_at >= ${weekEnd}
          and r.reviewed_at < ${new Date(weekEnd.getTime() + 7 * 24 * 60 * 60 * 1000)}
        )
      `
        : [{ c: 0n }];
      const c = Number(w1c[0]?.c ?? 0n);
      out.push({
        label: weekStart.toISOString().slice(0, 10),
        signups: su,
        w1: su ? c / su : 0
      });
    }
    return { available: true, reason: null, weeks: out };
  }

  private buildInsights(
    input: { current: Record<string, number>; previous: Record<string, number>; search: { c: { total: number; zero: number } | null; p: { total: number; zero: number } | null } },
    latestRun: { completedAt: Date | null; status: string } | null
  ) {
    const keys = new Set([...Object.keys(input.current), ...Object.keys(input.previous)]);
    let best: { k: string; d: number } | null = null;
    let worst: { k: string; d: number } | null = null;
    for (const k of keys) {
      const a = input.current[k] ?? 0;
      const b = input.previous[k] ?? 0;
      if (b === 0 && a === 0) {
        continue;
      }
      const d = b === 0 ? (a > 0 ? 1 : 0) : (a - b) / b;
      if (best == null || d > best.d) {
        best = { d, k };
      }
      if (worst == null || d < worst.d) {
        worst = { d, k };
      }
    }
    const fresh = latestRun?.completedAt;
    const stale = fresh
      ? Date.now() - fresh.getTime() > 26 * 60 * 60 * 1000
      : true;
    return {
      anomalyKey: !fresh ? "rollup_missing" : null,
      biggestNegative: worst,
      biggestPositive: best,
      freshnessStale: stale,
      recommendedKey: worst && worst.d < -0.15 ? "review_drop" : stale ? "check_rollup" : null
    };
  }

  private range(days: number) {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - days);
    return { end, start };
  }

  private streakDays(dates: Date[]) {
    const dayKeys = new Set(dates.map((date) => date.toISOString().slice(0, 10)));
    let streak = 0;
    const cursor = new Date();
    while (dayKeys.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
  }
}
