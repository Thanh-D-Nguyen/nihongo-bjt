"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  SectionHeader
} from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../lib/learner-api";
import { ActivityBarChart } from "./_components/activity-bar-chart";
import { ActivityHeatmap } from "./_components/activity-heatmap";
import { RadialProgress } from "./_components/radial-progress";
import { TrendMetricCard } from "./_components/trend-metric-card";

/* ─────────────────────────── Types ─────────────────────────── */

export interface AnalyticsLabels {
  accuracy: string;
  activityColDateUtc: string;
  activityDescription: string;
  activityEmpty: string;
  activityTableCaption: string;
  activityQuizShort: string;
  activityReviewsShort: string;
  activitySessionsShort: string;
  activityTitle: string;
  completedSessions: string;
  dataRangeHint: string;
  dueCardsLabel: string;
  empty: string;
  emptyCtaFlashcards: string;
  emptyCtaQuiz: string;
  emptyDescription: string;
  emptyTitle: string;
  error: string;
  eyebrow: string;
  heatmapLabel: string;
  insight: string;
  learningPathsCta: string;
  learningPathsDescription: string;
  learningPathsEmpty: string;
  learningPathsLevel: string;
  learningPathsTitle: string;
  load: string;
  metricsTitle: string;
  nudgeCalm: string;
  nudgeDue: string;
  nudgeStreak: string;
  nudgeTitle: string;
  nudgeWeak: string;
  periodDays30: string;
  periodDays7: string;
  periodDays90: string;
  periodFilterAria: string;
  periodLabel: string;
  periodLabelDynamic: string;
  primaryCtaFlashcards: string;
  primaryCtaQuiz: string;
  primaryHintFlashcardsDue: string;
  primaryHintMaintain: string;
  primaryHintQuizAccuracy: string;
  primaryHintQuizSkills: string;
  primaryStepTitle: string;
  refresh: string;
  refreshing: string;
  reviews: string;
  shareProgress: string;
  streak: string;
  subtitle: string;
  summaryTitle: string;
  summaryTitleDynamic: string;
  title: string;
  trendVsPrevious: string;
  weakSkillChip: string;
  weakSkillsColAttempts: string;
  weakSkillsColMiss: string;
  weakSkillsColSkill: string;
  weakSkillsEmpty: string;
  weakSkillsHint: string;
  weakSkillsTableCaption: string;
  weakSkillsTitle: string;
  viewAchievements?: string;
}

interface DailyActivityPoint {
  date: string;
  quizAnswers: number;
  quizSessionsCompleted: number;
  reviews: number;
}

interface LearningPathRow {
  descriptionJa: string | null;
  descriptionVi: string | null;
  id: string;
  slug: string;
  targetLevel: string | null;
  titleJa: string | null;
  titleVi: string;
}

interface PreviousTotals {
  bjtAccuracyPct: number;
  completedBjtSessions: number;
  reviewCount: number;
}

interface LearnerAnalyticsPayload {
  dailyActivity: DailyActivityPoint[];
  dueFlashcards: number | null;
  insight: string;
  learningPaths: LearningPathRow[];
  previousTotals: PreviousTotals | null;
  range: { days: number; end: string; start: string };
  totals: {
    bjtAccuracyPct: number;
    completedBjtSessions: number;
    reviewCount: number;
    streakDays: number;
  };
  weakSkills: Array<{
    attempts: number;
    failureRate: number;
    incorrect: number;
    skillTag: string;
  }>;
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function normalizeLearnerAnalyticsPayload(raw: unknown): LearnerAnalyticsPayload {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const totalsRaw =
    r.totals && typeof r.totals === "object" ? (r.totals as Record<string, unknown>) : {};
  const rangeRaw =
    r.range && typeof r.range === "object" ? (r.range as Record<string, unknown>) : {};

  const dailyActivity = Array.isArray(r.dailyActivity) ? r.dailyActivity : [];
  const weakSkills = Array.isArray(r.weakSkills) ? r.weakSkills : [];
  const learningPaths = Array.isArray(r.learningPaths) ? r.learningPaths : [];

  const n = (v: unknown, fallback: number) =>
    typeof v === "number" && !Number.isNaN(v) ? v : fallback;

  const prevRaw = r.previousTotals && typeof r.previousTotals === "object"
    ? (r.previousTotals as Record<string, unknown>)
    : null;

  return {
    dailyActivity: dailyActivity as DailyActivityPoint[],
    dueFlashcards:
      r.dueFlashcards === undefined || r.dueFlashcards === null
        ? null
        : typeof r.dueFlashcards === "number" && !Number.isNaN(r.dueFlashcards)
          ? r.dueFlashcards
          : null,
    insight: typeof r.insight === "string" ? r.insight : "",
    learningPaths: learningPaths as LearningPathRow[],
    previousTotals: prevRaw
      ? {
          bjtAccuracyPct: n(prevRaw.bjtAccuracyPct, 0),
          completedBjtSessions: n(prevRaw.completedBjtSessions, 0),
          reviewCount: n(prevRaw.reviewCount, 0)
        }
      : null,
    range: {
      days: n(rangeRaw.days, 7),
      end: typeof rangeRaw.end === "string" ? rangeRaw.end : "",
      start: typeof rangeRaw.start === "string" ? rangeRaw.start : ""
    },
    totals: {
      bjtAccuracyPct: n(totalsRaw.bjtAccuracyPct, 0),
      completedBjtSessions: n(totalsRaw.completedBjtSessions, 0),
      reviewCount: n(totalsRaw.reviewCount, 0),
      streakDays: n(totalsRaw.streakDays, 0)
    },
    weakSkills: weakSkills as LearnerAnalyticsPayload["weakSkills"]
  };
}

const PERIOD_OPTIONS = [7, 30, 90] as const;

function formatUtcRangeLabel(dateIso: string, locale: string): string {
  const raw = dateIso.includes("T") ? dateIso : `${dateIso}T00:00:00.000Z`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return dateIso.slice(0, 10);
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "vi-VN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(d);
}

function pickPrimaryAction(input: {
  dueFlashcards: number;
  weakCount: number;
  accuracyPct: number;
  reviewCount: number;
  completedSessions: number;
}): "flashcards" | "quiz" {
  const { accuracyPct, completedSessions, dueFlashcards, reviewCount, weakCount } = input;
  const activity = reviewCount + completedSessions;
  if (dueFlashcards >= 4) return "flashcards";
  if (weakCount >= 1 && dueFlashcards <= 2) return "quiz";
  if (accuracyPct < 62 && activity >= 4) return "quiz";
  if (dueFlashcards >= 1) return "flashcards";
  return activity < 2 ? "flashcards" : "quiz";
}

function pickNudgeMessage(
  labels: AnalyticsLabels,
  input: { due: number; streak: number; weakCount: number }
): string {
  if (input.due > 0) return labels.nudgeDue.replace("{n}", String(input.due));
  if (input.weakCount > 0) return labels.nudgeWeak;
  if (input.streak >= 2) return labels.nudgeStreak.replace("{n}", String(input.streak));
  return labels.nudgeCalm;
}

/* ─────────────────────────── Main Component ─────────────────────────── */

export function LearnerAnalyticsClient({
  labels,
  locale
}: {
  labels: AnalyticsLabels;
  locale: string;
}) {
  const [analytics, setAnalytics] = useState<LearnerAnalyticsPayload | null>(null);
  const [days, setDays] = useState<(typeof PERIOD_OPTIONS)[number]>(7);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const { userId } = useKeycloakAuth();

  const loadAnalytics = useCallback(async () => {
    const uid = userId;
    if (!uid) return;
    setLoading(true);
    setError(false);
    try {
      const response = await learnerApiFetch(
        `/api/analytics/learner?days=${days}&userId=${encodeURIComponent(uid)}&locale=${locale}`
      );
      if (!response.ok) throw new Error("Learner analytics request failed");
      setAnalytics(normalizeLearnerAnalyticsPayload(await response.json()));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId, locale, days]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const hasData = analytics
    ? (analytics.totals?.reviewCount ?? 0) + (analytics.totals?.completedBjtSessions ?? 0) > 0
    : false;

  const primaryKind = useMemo(() => {
    if (!analytics?.totals || analytics.dueFlashcards == null) return "flashcards" as const;
    return pickPrimaryAction({
      accuracyPct: analytics.totals.bjtAccuracyPct,
      completedSessions: analytics.totals.completedBjtSessions,
      dueFlashcards: analytics.dueFlashcards,
      reviewCount: analytics.totals.reviewCount,
      weakCount: analytics.weakSkills.length
    });
  }, [analytics]);

  const primaryHint = useMemo(() => {
    if (!analytics?.totals || analytics.dueFlashcards == null) return labels.primaryHintMaintain;
    if (primaryKind === "flashcards") {
      if (analytics.dueFlashcards > 0)
        return labels.primaryHintFlashcardsDue.replace("{n}", String(analytics.dueFlashcards));
      return labels.primaryHintMaintain;
    }
    if (analytics.weakSkills.length > 0) return labels.primaryHintQuizSkills;
    if (analytics.totals.bjtAccuracyPct < 70) return labels.primaryHintQuizAccuracy;
    return labels.primaryHintMaintain;
  }, [analytics, labels, primaryKind]);

  const nudgeLine = useMemo(() => {
    if (!analytics?.totals || analytics.dueFlashcards == null) return "";
    return pickNudgeMessage(labels, {
      due: analytics.dueFlashcards,
      streak: analytics.totals.streakDays,
      weakCount: analytics.weakSkills.length
    });
  }, [analytics, labels]);

  const rangeHint =
    analytics?.range?.start && analytics?.range?.end
      ? labels.dataRangeHint
          .replace("{start}", formatUtcRangeLabel(analytics.range.start, locale))
          .replace("{end}", formatUtcRangeLabel(analytics.range.end, locale))
      : "";

  return (
    <main className="w-full space-y-6 pb-12">
      {/* ─── Header ─── */}
      <PageHeader
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <fieldset
              aria-label={labels.periodFilterAria}
              className="flex items-center gap-1 rounded-full border border-ink/10 bg-paper p-1 dark:border-ink/20 dark:bg-gray-800/50"
            >
              {PERIOD_OPTIONS.map((d) => (
                <button
                  key={d}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold outline-none ring-offset-2 transition-all focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-45 ${
                    days === d
                      ? "bg-accent text-white shadow-sm shadow-accent/25"
                      : "text-muted hover:bg-ink/5 dark:hover:bg-ink/10"
                  }`}
                  disabled={loading || !userId}
                  type="button"
                  onClick={() => setDays(d)}
                >
                  {d === 7 ? labels.periodDays7 : d === 30 ? labels.periodDays30 : labels.periodDays90}
                </button>
              ))}
            </fieldset>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/12 bg-surface px-4 text-sm font-bold text-ink outline-none ring-offset-2 transition hover:bg-paper hover:shadow-sm focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 dark:border-ink/20 dark:bg-gray-800/50 dark:hover:bg-gray-700/50"
              disabled={loading || !userId}
              type="button"
              onClick={() => void loadAnalytics()}
            >
              {loading ? labels.refreshing : labels.refresh}
            </button>
          </div>
        }
        description={labels.subtitle}
        eyebrow={labels.eyebrow}
        title={labels.title}
      />

      {/* ─── Period hint ─── */}
      <p className="text-xs font-semibold text-muted">
        {labels.periodLabelDynamic.replace("{n}", String(days))}
        {rangeHint ? ` · ${rangeHint}` : ""}
      </p>

      {/* ─── Error ─── */}
      {error && <ErrorState className="py-5" title={labels.error} />}

      {/* ─── Loading skeleton ─── */}
      {loading && !analytics && (
        <div className="space-y-4" aria-busy>
          <LoadingSkeleton className="h-36 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <LoadingSkeleton className="h-28 rounded-2xl" key={i} />
            ))}
          </div>
          <LoadingSkeleton className="h-48 rounded-2xl" />
        </div>
      )}

      {/* ─── Primary Action Card ─── */}
      {analytics && hasData && (
        <section
          aria-labelledby="analytics-primary-step"
          className="relative overflow-hidden rounded-2xl border border-accent/15 bg-gradient-to-br from-accent/5 via-surface to-accent/3 p-5 shadow-sm dark:border-accent/25 dark:from-accent/10 dark:via-gray-900 dark:to-accent/5"
        >
          <div className="absolute -right-4 -top-4 size-24 rounded-full bg-accent/5 blur-2xl" aria-hidden />
          <h2 className="text-base font-semibold text-ink" id="analytics-primary-step">
            {labels.primaryStepTitle}
          </h2>
          <p className="mt-1 text-sm text-muted leading-relaxed">{primaryHint}</p>
          <div className="mt-4">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-6 text-sm font-bold text-white shadow-sm shadow-accent/20 outline-none ring-offset-2 transition-all hover:bg-accent-hover hover:shadow-md hover:shadow-accent/25 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
              href={
                primaryKind === "flashcards"
                  ? `/${locale}/flashcards?tab=review`
                  : `/${locale}/quiz`
              }
            >
              {primaryKind === "flashcards" ? labels.primaryCtaFlashcards : labels.primaryCtaQuiz}
            </Link>
          </div>
        </section>
      )}

      {/* ─── Nudge Card ─── */}
      {analytics && hasData && nudgeLine && (
        <div className="rounded-2xl border border-emerald-200/40 bg-gradient-to-r from-emerald-50/80 to-emerald-50/40 p-4 dark:border-emerald-700/30 dark:from-emerald-950/30 dark:to-emerald-950/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400/80">
            {labels.nudgeTitle}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">{nudgeLine}</p>
        </div>
      )}

      {/* ─── Main Analytics Content ─── */}
      {analytics && (
        <Card className="overflow-hidden border-ink/8 shadow-sm dark:border-ink/15">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-base font-semibold text-ink">
              {labels.summaryTitleDynamic.replace("{n}", String(days))}
            </CardTitle>
            {!hasData && <CardDescription>{labels.emptyTitle}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-8 pt-2">
            {!hasData ? (
              <EmptyState
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link
                      className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm outline-none ring-offset-2 transition-all hover:bg-emerald-700 hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
                      href={`/${locale}/flashcards`}
                    >
                      {labels.emptyCtaFlashcards}
                    </Link>
                    <Link
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/12 bg-surface px-5 text-sm font-bold text-ink outline-none ring-offset-2 transition hover:bg-paper hover:shadow-sm focus-visible:ring-2 focus-visible:ring-accent dark:border-ink/20"
                      href={`/${locale}/quiz`}
                    >
                      {labels.emptyCtaQuiz}
                    </Link>
                  </div>
                }
                description={labels.emptyDescription}
                title={labels.emptyTitle}
              />
            ) : (
              <>
                {/* ─── Bento Metric Cards ─── */}
                <section>
                  <SectionHeader heading="h3" title={labels.metricsTitle} variant="overline" />
                  {analytics.previousTotals && (
                    <p className="mb-3 text-[10px] font-medium text-muted">
                      {labels.trendVsPrevious.replace("{n}", String(days))}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <TrendMetricCard
                      label={labels.reviews}
                      value={analytics.totals.reviewCount}
                      previousValue={analytics.previousTotals?.reviewCount}
                      icon={<span>📝</span>}
                      accentClass="from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/10"
                    />
                    <div className="col-span-1 flex items-center justify-center rounded-2xl border border-ink/8 bg-gradient-to-br from-blue-500/5 to-blue-500/3 p-4 shadow-sm dark:border-ink/15 dark:from-blue-500/15 dark:to-blue-500/5">
                      <RadialProgress
                        value={analytics.totals.bjtAccuracyPct}
                        label={labels.accuracy}
                        colorClass="stroke-blue-500 dark:stroke-blue-400"
                      />
                    </div>
                    <TrendMetricCard
                      label={labels.completedSessions}
                      value={analytics.totals.completedBjtSessions}
                      previousValue={analytics.previousTotals?.completedBjtSessions}
                      icon={<span>🎯</span>}
                      accentClass="from-amber-500/10 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/10"
                    />
                    <TrendMetricCard
                      label={labels.streak}
                      value={analytics.totals.streakDays}
                      icon={<span>🔥</span>}
                      accentClass="from-orange-500/10 to-orange-500/5 dark:from-orange-500/20 dark:to-orange-500/10"
                    />
                    {analytics.dueFlashcards != null && analytics.dueFlashcards > 0 && (
                      <TrendMetricCard
                        label={labels.dueCardsLabel}
                        value={analytics.dueFlashcards}
                        icon={<span>📚</span>}
                        accentClass="from-purple-500/10 to-purple-500/5 dark:from-purple-500/20 dark:to-purple-500/10"
                      />
                    )}
                  </div>
                </section>

                {/* ─── Activity Heatmap ─── */}
                <section className="rounded-2xl border border-ink/8 bg-paper/50 p-4 dark:border-ink/15 dark:bg-gray-800/30">
                  <ActivityHeatmap
                    dailyActivity={analytics.dailyActivity}
                    label={labels.heatmapLabel}
                  />
                </section>

                {/* ─── Daily Activity Chart ─── */}
                <section className="rounded-2xl border border-ink/8 bg-paper/50 p-5 dark:border-ink/15 dark:bg-gray-800/30">
                  <SectionHeader heading="h3" title={labels.activityTitle} variant="overline" />
                  <p className="mb-5 text-xs text-muted">{labels.activityDescription}</p>
                  {analytics.dailyActivity.length === 0 ||
                  analytics.dailyActivity.every(
                    (p) => p.reviews + p.quizAnswers + p.quizSessionsCompleted === 0
                  ) ? (
                    <p className="text-sm text-muted">{labels.activityEmpty}</p>
                  ) : (
                    <>
                      <ActivityBarChart
                        data={analytics.dailyActivity}
                        labels={{
                          reviews: labels.activityReviewsShort,
                          quiz: labels.activityQuizShort,
                          sessions: labels.activitySessionsShort
                        }}
                      />

                      {/* Collapsible table */}
                      <details className="mt-4">
                        <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-ink transition">
                          {labels.activityTableCaption}
                        </summary>
                        <div className="mt-2 overflow-x-auto rounded-lg border border-ink/8 dark:border-ink/15">
                          <table className="w-full min-w-[320px] text-left text-xs sm:text-sm">
                            <thead>
                              <tr className="border-b border-ink/10 bg-surface dark:bg-gray-800/50">
                                <th className="px-3 py-2 font-semibold text-ink" scope="col">
                                  {labels.activityColDateUtc}
                                </th>
                                <th className="px-3 py-2 font-semibold text-ink" scope="col">
                                  {labels.activityReviewsShort}
                                </th>
                                <th className="px-3 py-2 font-semibold text-ink" scope="col">
                                  {labels.activityQuizShort}
                                </th>
                                <th className="px-3 py-2 font-semibold text-ink" scope="col">
                                  {labels.activitySessionsShort}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {analytics.dailyActivity.map((p) => (
                                <tr className="border-b border-ink/5 dark:border-ink/10" key={p.date}>
                                  <td className="px-3 py-2 tabular-nums text-muted">{p.date}</td>
                                  <td className="px-3 py-2 tabular-nums">{p.reviews}</td>
                                  <td className="px-3 py-2 tabular-nums">{p.quizAnswers}</td>
                                  <td className="px-3 py-2 tabular-nums">{p.quizSessionsCompleted}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </>
                  )}
                </section>

                {/* ─── Coaching Insight ─── */}
                <section className="rounded-2xl border border-amber-200/40 bg-gradient-to-r from-amber-50/60 to-amber-50/30 p-5 dark:border-amber-700/30 dark:from-amber-950/20 dark:to-amber-950/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700/70 dark:text-amber-400/80">
                    {labels.insight}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink">{analytics.insight}</p>
                </section>

                {/* ─── Weak Skills ─── */}
                <section className="rounded-2xl border border-ink/8 bg-surface p-5 dark:border-ink/15 dark:bg-gray-800/40">
                  <SectionHeader
                    description={labels.weakSkillsHint}
                    heading="h3"
                    title={labels.weakSkillsTitle}
                  />
                  {analytics.weakSkills.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">{labels.weakSkillsEmpty}</p>
                  ) : (
                    <>
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {analytics.weakSkills.map((skill) => (
                          <li key={skill.skillTag}>
                            <Link
                              className="inline-flex min-h-9 items-center rounded-xl border border-red-200/50 bg-red-50/50 px-3 text-xs font-bold text-red-700 outline-none ring-offset-2 transition-all hover:border-red-300 hover:bg-red-100/60 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:border-red-700 dark:hover:bg-red-950/50"
                              href={`/${locale}/flashcards?source=analytics&skill=${encodeURIComponent(skill.skillTag)}`}
                            >
                              {labels.weakSkillChip
                                .replace("{tag}", skill.skillTag)
                                .replace("{rate}", String(skill.failureRate))}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 overflow-x-auto rounded-lg border border-ink/8 dark:border-ink/15">
                        <table className="w-full min-w-[280px] text-left text-xs sm:text-sm">
                          <caption className="px-3 py-2 text-left text-xs font-semibold text-muted">
                            {labels.weakSkillsTableCaption}
                          </caption>
                          <thead>
                            <tr className="border-b border-ink/10 bg-paper/80 dark:bg-gray-800/50">
                              <th className="px-3 py-2 font-semibold text-ink" scope="col">
                                {labels.weakSkillsColSkill}
                              </th>
                              <th className="px-3 py-2 font-semibold text-ink" scope="col">
                                {labels.weakSkillsColAttempts}
                              </th>
                              <th className="px-3 py-2 font-semibold text-ink" scope="col">
                                {labels.weakSkillsColMiss}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.weakSkills.map((skill) => (
                              <tr className="border-b border-ink/5 dark:border-ink/10" key={`row-${skill.skillTag}`}>
                                <td className="px-3 py-2 font-medium text-ink">{skill.skillTag}</td>
                                <td className="px-3 py-2 tabular-nums">{skill.attempts}</td>
                                <td className="px-3 py-2 tabular-nums text-red-600 dark:text-red-400">
                                  {skill.failureRate}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </section>

                {/* ─── Learning Paths ─── */}
                <LearningPathsPanel labels={labels} locale={locale} paths={analytics.learningPaths} />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Cross-navigation ─── */}
      {analytics && hasData && (
        <div className="flex justify-center">
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-5 text-sm font-semibold text-muted transition-all hover:border-ink/20 hover:bg-paper hover:text-ink hover:shadow-sm"
            href={`/${locale}/achievements`}
          >
            <span>🏆</span>
            {labels.viewAchievements ?? "View achievements"}
          </Link>
        </div>
      )}

      {/* ─── Share Button (sticky mobile) ─── */}
      {analytics && hasData && (
        <div className="fixed bottom-20 right-4 z-40 sm:static sm:flex sm:justify-end">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] dark:bg-white dark:text-gray-900"
            type="button"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: labels.title,
                  text: `${labels.streak}: ${analytics.totals.streakDays} · ${labels.accuracy}: ${analytics.totals.bjtAccuracyPct}%`
                }).catch(() => {/* user cancelled */});
              } else {
                navigator.clipboard.writeText(
                  `${labels.title}\n${labels.streak}: ${analytics.totals.streakDays}\n${labels.accuracy}: ${analytics.totals.bjtAccuracyPct}%\n${labels.reviews}: ${analytics.totals.reviewCount}`
                ).catch(() => {/* ignore */});
              }
            }}
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {labels.shareProgress}
          </button>
        </div>
      )}
    </main>
  );
}

/* ─────────────────────────── Sub-components ─────────────────────────── */

function LearningPathsPanel({
  labels,
  locale,
  paths
}: {
  labels: AnalyticsLabels;
  locale: string;
  paths: LearningPathRow[] | undefined;
}) {
  const list = paths ?? [];
  return (
    <section className="rounded-2xl border border-ink/8 bg-paper/40 p-5 dark:border-ink/15 dark:bg-gray-800/20">
      <SectionHeader
        description={labels.learningPathsDescription}
        heading="h3"
        title={labels.learningPathsTitle}
      />
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{labels.learningPathsEmpty}</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {list.map((path) => {
            const title = locale === "ja" && path.titleJa?.trim() ? path.titleJa : path.titleVi;
            const desc =
              locale === "ja" && path.descriptionJa?.trim()
                ? path.descriptionJa
                : path.descriptionVi;
            return (
              <li
                className="group rounded-xl border border-ink/8 bg-surface p-4 shadow-sm transition-all hover:border-accent/20 hover:shadow-md dark:border-ink/15 dark:bg-gray-800/40 dark:hover:border-accent/30"
                key={path.id}
              >
                <p className="text-sm font-semibold text-ink group-hover:text-accent transition-colors">
                  {title}
                </p>
                {path.targetLevel && (
                  <p className="mt-0.5 text-xs text-muted">
                    {(labels.learningPathsLevel ?? "").replace("{level}", path.targetLevel)}
                  </p>
                )}
                {desc && (
                  <p className="mt-2 text-xs leading-relaxed text-muted line-clamp-2">{desc}</p>
                )}
                <div className="mt-3">
                  <Link
                    className="inline-flex min-h-8 items-center justify-center rounded-lg border border-ink/12 bg-paper px-3 text-xs font-bold text-ink transition hover:bg-ink/5 dark:border-ink/20 dark:bg-gray-700/50 dark:hover:bg-gray-700"
                    href={`/${locale}/quiz`}
                  >
                    {labels.learningPathsCta}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
