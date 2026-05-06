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
  streak: string;
  subtitle: string;
  summaryTitle: string;
  summaryTitleDynamic: string;
  title: string;
  weakSkillChip: string;
  weakSkillsColAttempts: string;
  weakSkillsColMiss: string;
  weakSkillsColSkill: string;
  weakSkillsEmpty: string;
  weakSkillsHint: string;
  weakSkillsTableCaption: string;
  weakSkillsTitle: string;
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

interface LearnerAnalyticsPayload {
  dailyActivity: DailyActivityPoint[];
  dueFlashcards: number | null;
  insight: string;
  learningPaths: LearningPathRow[];
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
  if (Number.isNaN(d.getTime())) {
    return dateIso.slice(0, 10);
  }
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
  if (dueFlashcards >= 4) {
    return "flashcards";
  }
  if (weakCount >= 1 && dueFlashcards <= 2) {
    return "quiz";
  }
  if (accuracyPct < 62 && activity >= 4) {
    return "quiz";
  }
  if (dueFlashcards >= 1) {
    return "flashcards";
  }
  return activity < 2 ? "flashcards" : "quiz";
}

function pickNudgeMessage(
  labels: AnalyticsLabels,
  input: { due: number; streak: number; weakCount: number }
): string {
  if (input.due > 0) {
    return labels.nudgeDue.replace("{n}", String(input.due));
  }
  if (input.weakCount > 0) {
    return labels.nudgeWeak;
  }
  if (input.streak >= 2) {
    return labels.nudgeStreak.replace("{n}", String(input.streak));
  }
  return labels.nudgeCalm;
}

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
    if (!uid) {
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const response = await learnerApiFetch(
        `/api/analytics/learner?days=${days}&userId=${encodeURIComponent(uid)}&locale=${locale}`
      );
      if (!response.ok) {
        throw new Error("Learner analytics request failed");
      }
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
    if (!analytics?.totals || analytics.dueFlashcards == null) {
      return "flashcards" as const;
    }
    return pickPrimaryAction({
      accuracyPct: analytics.totals.bjtAccuracyPct,
      completedSessions: analytics.totals.completedBjtSessions,
      dueFlashcards: analytics.dueFlashcards,
      reviewCount: analytics.totals.reviewCount,
      weakCount: analytics.weakSkills.length
    });
  }, [analytics]);

  const primaryHint = useMemo(() => {
    if (!analytics?.totals || analytics.dueFlashcards == null) {
      return labels.primaryHintMaintain;
    }
    if (primaryKind === "flashcards") {
      if (analytics.dueFlashcards > 0) {
        return labels.primaryHintFlashcardsDue.replace("{n}", String(analytics.dueFlashcards));
      }
      return labels.primaryHintMaintain;
    }
    if (analytics.weakSkills.length > 0) {
      return labels.primaryHintQuizSkills;
    }
    if (analytics.totals.bjtAccuracyPct < 70) {
      return labels.primaryHintQuizAccuracy;
    }
    return labels.primaryHintMaintain;
  }, [analytics, labels, primaryKind]);

  const nudgeLine = useMemo(() => {
    if (!analytics?.totals || analytics.dueFlashcards == null) {
      return "";
    }
    return pickNudgeMessage(labels, {
      due: analytics.dueFlashcards,
      streak: analytics.totals.streakDays,
      weakCount: analytics.weakSkills.length
    });
  }, [analytics, labels]);

  const activityMax = useMemo(() => {
    if (!analytics?.dailyActivity?.length) {
      return 1;
    }
    return Math.max(
      1,
      ...analytics.dailyActivity.map((p) => p.reviews + p.quizAnswers + p.quizSessionsCompleted)
    );
  }, [analytics]);

  const rangeHint =
    analytics?.range?.start && analytics?.range?.end
      ? labels.dataRangeHint
          .replace("{start}", formatUtcRangeLabel(analytics.range.start, locale))
          .replace("{end}", formatUtcRangeLabel(analytics.range.end, locale))
      : "";

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <fieldset
              aria-label={labels.periodFilterAria}
              className="flex flex-wrap items-center gap-1 rounded-full border border-ink/10 bg-paper p-1"
            >
              {PERIOD_OPTIONS.map((d) => (
                <button
                  key={d}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-45 ${
                    days === d ? "bg-accent text-white" : "text-muted hover:bg-ink/5"
                  }`}
                  disabled={loading || !userId}
                  type="button"
                  onClick={() => setDays(d)}
                >
                  {d === 7
                    ? labels.periodDays7
                    : d === 30
                      ? labels.periodDays30
                      : labels.periodDays90}
                </button>
              ))}
            </fieldset>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/12 bg-surface px-4 text-sm font-bold text-ink outline-none ring-offset-2 hover:bg-paper focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
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

      <p className="text-xs font-semibold text-muted">
        {labels.periodLabelDynamic.replace("{n}", String(days))}
        {rangeHint ? ` · ${rangeHint}` : ""}
      </p>

      {error ? <ErrorState className="py-5" title={labels.error} /> : null}

      {loading && !analytics ? (
        <div className="space-y-4" aria-busy>
          <LoadingSkeleton className="h-36" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <LoadingSkeleton className="h-24" key={i} />
            ))}
          </div>
        </div>
      ) : null}

      {analytics && hasData ? (
        <section
          aria-labelledby="analytics-primary-step"
          className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm sm:p-5"
        >
          <h2 className="text-base font-semibold text-ink" id="analytics-primary-step">
            {labels.primaryStepTitle}
          </h2>
          <p className="mt-1 text-sm text-muted">{primaryHint}</p>
          <div className="mt-4">
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-5 text-sm font-bold text-white outline-none ring-offset-2 hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent sm:w-auto"
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
      ) : null}

      {analytics && hasData && nudgeLine ? (
        <div className="rounded-2xl border border-leaf/25 bg-leaf/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {labels.nudgeTitle}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">{nudgeLine}</p>
        </div>
      ) : null}

      {analytics ? (
        <Card className="border-ink/10 shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-base font-semibold text-ink">
              {labels.summaryTitleDynamic.replace("{n}", String(days))}
            </CardTitle>
            {!hasData ? <CardDescription>{labels.emptyTitle}</CardDescription> : null}
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            {!hasData ? (
              <EmptyState
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link
                      className="inline-flex min-h-10 items-center justify-center rounded-xl bg-leaf px-4 text-sm font-bold text-white outline-none ring-offset-2 hover:bg-leaf/90 focus-visible:ring-2 focus-visible:ring-accent"
                      href={`/${locale}/flashcards`}
                    >
                      {labels.emptyCtaFlashcards}
                    </Link>
                    <Link
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/12 bg-surface px-4 text-sm font-bold text-ink outline-none ring-offset-2 hover:bg-paper focus-visible:ring-2 focus-visible:ring-accent"
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
                <SectionHeader heading="h3" title={labels.metricsTitle} variant="overline" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Metric label={labels.reviews} value={analytics.totals.reviewCount} />
                  <Metric label={labels.accuracy} value={`${analytics.totals.bjtAccuracyPct}%`} />
                  <Metric
                    label={labels.completedSessions}
                    value={analytics.totals.completedBjtSessions}
                  />
                  <Metric label={labels.streak} value={analytics.totals.streakDays} />
                  {analytics.dueFlashcards != null && analytics.dueFlashcards > 0 ? (
                    <Metric label={labels.dueCardsLabel} value={analytics.dueFlashcards} />
                  ) : null}
                </div>

                <div className="rounded-xl border border-ink/10 bg-paper/60 p-4">
                  <SectionHeader heading="h3" title={labels.activityTitle} variant="overline" />
                  <p className="mb-4 text-xs text-muted">{labels.activityDescription}</p>
                  {analytics.dailyActivity.length === 0 ||
                  analytics.dailyActivity.every(
                    (p) => p.reviews + p.quizAnswers + p.quizSessionsCompleted === 0
                  ) ? (
                    <p className="text-sm text-muted">{labels.activityEmpty}</p>
                  ) : (
                    <>
                      <div aria-hidden className="mb-4 flex h-32 items-end gap-1 sm:gap-1.5">
                        {analytics.dailyActivity.map((p) => {
                          const total = p.reviews + p.quizAnswers + p.quizSessionsCompleted;
                          const barPx = Math.max(
                            total === 0 ? 0 : 4,
                            Math.round((total / activityMax) * 120)
                          );
                          return (
                            <div
                              className="flex min-w-0 flex-1 flex-col items-center gap-1"
                              key={p.date}
                              title={`${p.date}: SRS ${p.reviews}, BJT ${p.quizAnswers}, ${p.quizSessionsCompleted}`}
                            >
                              <div
                                className="flex w-full max-w-[16px] flex-col justify-end sm:max-w-[20px]"
                                style={{ height: 120 }}
                              >
                                {total === 0 ? (
                                  <div className="h-1 w-full rounded-sm bg-ink/10" />
                                ) : (
                                  <div
                                    className="flex w-full flex-col justify-end overflow-hidden rounded-md bg-ink/5"
                                    style={{ height: barPx }}
                                  >
                                    {p.reviews > 0 ? (
                                      <div
                                        className="w-full min-h-[2px] bg-leaf/85"
                                        style={{ flexGrow: p.reviews }}
                                      />
                                    ) : null}
                                    {p.quizAnswers > 0 ? (
                                      <div
                                        className="w-full min-h-[2px] bg-accent/80"
                                        style={{ flexGrow: p.quizAnswers }}
                                      />
                                    ) : null}
                                    {p.quizSessionsCompleted > 0 ? (
                                      <div
                                        className="w-full min-h-[2px] bg-amber-500/75"
                                        style={{ flexGrow: p.quizSessionsCompleted }}
                                      />
                                    ) : null}
                                  </div>
                                )}
                              </div>
                              <span className="max-w-full truncate text-[9px] font-medium text-muted tabular-nums sm:text-[10px]">
                                {p.date.slice(5)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mb-3 flex flex-wrap gap-3 text-[10px] text-muted sm:text-xs">
                        <span className="inline-flex items-center gap-1">
                          <span aria-hidden className="inline-block size-2 rounded-sm bg-leaf/85" />
                          {labels.activityReviewsShort}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            aria-hidden
                            className="inline-block size-2 rounded-sm bg-accent/80"
                          />
                          {labels.activityQuizShort}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            aria-hidden
                            className="inline-block size-2 rounded-sm bg-amber-500/75"
                          />
                          {labels.activitySessionsShort}
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-ink/8">
                        <table className="w-full min-w-[320px] text-left text-xs sm:text-sm">
                          <caption className="px-2 py-2 text-left text-xs font-semibold text-muted">
                            {labels.activityTableCaption}
                          </caption>
                          <thead>
                            <tr className="border-b border-ink/10 bg-surface">
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
                              <tr className="border-b border-ink/5" key={p.date}>
                                <td className="px-3 py-2 tabular-nums text-muted">{p.date}</td>
                                <td className="px-3 py-2 tabular-nums">{p.reviews}</td>
                                <td className="px-3 py-2 tabular-nums">{p.quizAnswers}</td>
                                <td className="px-3 py-2 tabular-nums">
                                  {p.quizSessionsCompleted}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-amber-200/50 bg-amber-soft/35 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    {labels.insight}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink">{analytics.insight}</p>
                </div>

                <div className="rounded-xl border border-ink/10 bg-surface p-4">
                  <SectionHeader
                    description={labels.weakSkillsHint}
                    heading="h3"
                    title={labels.weakSkillsTitle}
                  />
                  {analytics.weakSkills.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">{labels.weakSkillsEmpty}</p>
                  ) : (
                    <>
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {analytics.weakSkills.map((skill) => (
                          <li key={skill.skillTag}>
                            <Link
                              className="inline-flex min-h-9 items-center rounded-xl border border-ink/12 bg-paper/80 px-3 text-xs font-bold text-ink outline-none ring-offset-2 hover:border-accent/30 hover:bg-accent-soft/40 focus-visible:ring-2 focus-visible:ring-accent"
                              href={`/${locale}/flashcards?source=analytics&skill=${encodeURIComponent(skill.skillTag)}`}
                            >
                              {labels.weakSkillChip
                                .replace("{tag}", skill.skillTag)
                                .replace("{rate}", String(skill.failureRate))}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 overflow-x-auto rounded-lg border border-ink/8">
                        <table className="w-full min-w-[280px] text-left text-xs sm:text-sm">
                          <caption className="px-2 py-2 text-left text-xs font-semibold text-muted">
                            {labels.weakSkillsTableCaption}
                          </caption>
                          <thead>
                            <tr className="border-b border-ink/10 bg-paper/80">
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
                              <tr className="border-b border-ink/5" key={`row-${skill.skillTag}`}>
                                <td className="px-3 py-2 font-medium text-ink">{skill.skillTag}</td>
                                <td className="px-3 py-2 tabular-nums">{skill.attempts}</td>
                                <td className="px-3 py-2 tabular-nums">{skill.failureRate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            <LearningPathsPanel labels={labels} locale={locale} paths={analytics.learningPaths} />
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

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
    <div className="rounded-xl border border-ink/10 bg-paper/50 p-4">
      <SectionHeader
        description={labels.learningPathsDescription}
        heading="h3"
        title={labels.learningPathsTitle}
      />
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{labels.learningPathsEmpty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {list.map((path) => {
            const title = locale === "ja" && path.titleJa?.trim() ? path.titleJa : path.titleVi;
            const desc =
              locale === "ja" && path.descriptionJa?.trim()
                ? path.descriptionJa
                : path.descriptionVi;
            return (
              <li className="rounded-xl border border-ink/8 bg-surface p-3 shadow-sm" key={path.id}>
                <p className="text-sm font-semibold text-ink">{title}</p>
                {path.targetLevel ? (
                  <p className="mt-0.5 text-xs text-muted">
                    {(labels.learningPathsLevel ?? "").replace("{level}", path.targetLevel)}
                  </p>
                ) : null}
                {desc ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted line-clamp-3">{desc}</p>
                ) : null}
                <div className="mt-3">
                  <Link
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-ink/12 bg-paper px-3 text-xs font-bold text-ink hover:bg-ink/5"
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
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}
