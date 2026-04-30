"use client";

import {
  ActionCard,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  LearningFeedback,
  ProgressCard,
  SectionHeader,
  SkillChip,
  TodayPlanCard
} from "@nihongo-bjt/ui";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { useKeycloakAuth } from "../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch, learnerApiFetchOptional } from "../../../lib/learner-api";

interface DailyLabels {
  addCards: string;
  cardsCreated: string;
  lifeDisclaimerLabel: string;
  lifeLearningObjectiveLabel: string;
  lifeRemediationLabel: string;
  lifeSourceLabel: string;
  dueReviews: string;
  empty: string;
  error: string;
  inputLabel: string;
  load: string;
  markUseful: string;
  placeholder: string;
  quickQuiz: string;
  quickQuizChoose: string;
  quickQuizCorrect: string;
  quickQuizWrong: string;
  sampleBusinessBody: string;
  sampleBusinessTitle: string;
  sampleSeasonalBody: string;
  sampleSeasonalTitle: string;
  sampleWeatherBody: string;
  sampleWeatherTitle: string;
  sampleWidgetBadge: string;
  today: string;
  widgetActionError: string;
  widgetsTitle: string;
}

interface DashboardLabels {
  commandCenterDescription: string;
  commandCenterEyebrow: string;
  commandCenterTitle: string;
  actionsSectionTitle: string;
  comebackDueLabel: string;
  comebackEvidenceDescription: string;
  comebackEvidenceTitle: string;
  comebackInWindow: string;
  comebackLeechedLabel: string;
  comebackNoRecent: string;
  comebackRatingAgain: string;
  comebackRatingEasy: string;
  comebackRatingGood: string;
  comebackRatingHard: string;
  comebackReviewEntry: string;
  bjtAccuracyLabel: string;
  bjtMiniDescription: string;
  bjtMiniTitle: string;
  bjtSessionsLabel: string;
  compactBrand: string;
  compactHeaderTitle: string;
  continueDescription: string;
  continueTitle: string;
  dailyHubDescription: string;
  dailyHubTitle: string;
  dailyJapaneseTitle: string;
  demoStatAccuracy: string;
  demoStatReviews: string;
  demoStatSessions: string;
  demoStatSkill: string;
  demoStatsCaption: string;
  demoDueCount: string;
  demoFlashcardFront: string;
  dueReviewsLine: string;
  emptyAnalyticsDescription: string;
  emptyAnalyticsTitle: string;
  emptyDueDescription: string;
  emptyDueTitle: string;
  fallbackGreetingTitle: string;
  flashcardCta: string;
  flashcardDueDescription: string;
  flashcardDueTitle: string;
  flashcardPreviewEmpty: string;
  flashcardPreviewLabel: string;
  insightLabel: string;
  kindBusiness: string;
  kindSeasonal: string;
  kindWeather: string;
  metaDate: string;
  primaryCta: string;
  primaryShortcutsTitle: string;
  progressCardDescription: string;
  progressSectionTitle: string;
  recommendationFallback: string;
  reviewDescription: string;
  reviewTitle: string;
  searchDescription: string;
  searchPlaceholder: string;
  searchSubmit: string;
  searchTitle: string;
  signInForProgressDescription: string;
  signInForProgressTitle: string;
  sessionHint: string;
  streakDays: string;
  streakLabel: string;
  subtitle: string;
  todayPlanTitle: string;
  totalReviewsLabel: string;
  weakSkillLabel: string;
  weakSkillValue: string;
}

interface DailyHubPayload {
  dueReviews: number;
  greeting: { japanese: string; reading: string };
  today: string;
  widgets: DailyWidget[];
}

interface DailyWidget {
  config: { id: string; widgetKind: string };
  item: DailyContentItem | null;
}

interface DailyContentItem {
  explanationText: string | null;
  id: string;
  japaneseText: string | null;
  learningSafeguard?: {
    learningObjective: string;
    remediationLinks: Array<{ href: string; label: string }>;
    riskDisclaimer: string;
    sourceDate: string | null;
    sourceTitle: string | null;
    sourceUrl: string | null;
  };
  readingText: string | null;
  title: string;
  widgetKind: string;
}

interface ActiveQuickQuiz {
  itemId: string;
  options: string[];
  prompt: string;
}

interface LearnerAnalytics {
  insight: string;
  totals: {
    bjtAccuracyPct: number;
    completedBjtSessions: number;
    reviewCount: number;
    streakDays: number;
  };
}

interface DueCardRow {
  card: { backText: string; frontText: string; id: string; reading: string | null };
  cardId: string;
  comebackMode?: boolean;
  id: string;
  leeched?: boolean;
}

interface ComebackSummary {
  activeComebackCards: number;
  dueComebackCards: number;
  leechedCards: number;
  range: { days: number; since: string; until: string };
  recentComebackReviews: Array<{
    cardId: string;
    cardPreview: string;
    nextDueAt: string;
    rating: string;
    reviewedAt: string;
    sourceType: string;
    userFlashcardId: string;
  }>;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const FEATURED_KINDS = ["weather", "business_phrase", "seasonal_word"] as const;

function labelForKind(kind: string, d: DashboardLabels) {
  if (kind === "weather") {
    return d.kindWeather;
  }
  if (kind === "business_phrase") {
    return d.kindBusiness;
  }
  if (kind === "seasonal_word") {
    return d.kindSeasonal;
  }
  return kind;
}

function labelForRating(rating: string, d: DashboardLabels) {
  if (rating === "again") {
    return d.comebackRatingAgain;
  }
  if (rating === "hard") {
    return d.comebackRatingHard;
  }
  if (rating === "good") {
    return d.comebackRatingGood;
  }
  if (rating === "easy") {
    return d.comebackRatingEasy;
  }
  return rating;
}

export function DailyHubClient({
  dailyLabels,
  dashboardLabels,
  locale
}: {
  dailyLabels: DailyLabels;
  dashboardLabels: DashboardLabels;
  locale: "vi" | "ja";
}) {
  const [actionMessage, setActionMessage] = useState("");
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuickQuiz | null>(null);
  const [analytics, setAnalytics] = useState<LearnerAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [comebackSummary, setComebackSummary] = useState<ComebackSummary | null>(null);
  const [comebackSummaryError, setComebackSummaryError] = useState(false);
  const [comebackSummaryLoading, setComebackSummaryLoading] = useState(false);
  const [dueCards, setDueCards] = useState<DueCardRow[]>([]);
  const [dueError, setDueError] = useState(false);
  const [dueLoading, setDueLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hub, setHub] = useState<DailyHubPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [quizText, setQuizText] = useState("");
  const auth = useKeycloakAuth();
  const effectiveUserId = auth.userId ?? "";

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const query = `locale=${locale}${
        effectiveUserId ? `&userId=${encodeURIComponent(effectiveUserId)}` : ""
      }`;
      const response = await learnerApiFetchOptional(`/api/daily/home?${query}`);
      if (!response.ok) {
        throw new Error("Daily hub request failed");
      }
      setHub((await response.json()) as DailyHubPayload);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, locale]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  useEffect(() => {
    let cancelled = false;
    async function loadAnalytics() {
      if (!effectiveUserId) {
        setAnalytics(null);
        setAnalyticsLoading(false);
        return;
      }
      setAnalyticsError(false);
      setAnalyticsLoading(true);
      try {
        const response = await learnerApiFetchOptional(
          `/api/analytics/learner?days=7&userId=${encodeURIComponent(effectiveUserId)}`
        );
        if (!response.ok) {
          throw new Error("failed");
        }
        const data = (await response.json()) as LearnerAnalytics;
        if (!cancelled) {
          setAnalytics(data);
        }
      } catch {
        if (!cancelled) {
          setAnalyticsError(true);
          setAnalytics(null);
        }
      } finally {
        if (!cancelled) {
          setAnalyticsLoading(false);
        }
      }
    }
    void loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId]);

  useEffect(() => {
    let cancelled = false;
    async function loadComebackSummary() {
      if (!effectiveUserId) {
        setComebackSummary(null);
        setComebackSummaryLoading(false);
        return;
      }
      setComebackSummaryError(false);
      setComebackSummaryLoading(true);
      try {
        const response = await learnerApiFetch(
          `/api/flashcards/reviews/comeback-summary?userId=${encodeURIComponent(effectiveUserId)}&days=14`
        );
        if (!response.ok) {
          throw new Error("failed");
        }
        const data = (await response.json()) as ComebackSummary;
        if (!cancelled) {
          setComebackSummary(data);
        }
      } catch {
        if (!cancelled) {
          setComebackSummaryError(true);
          setComebackSummary(null);
        }
      } finally {
        if (!cancelled) {
          setComebackSummaryLoading(false);
        }
      }
    }
    void loadComebackSummary();
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId, hub?.dueReviews]);

  useEffect(() => {
    let cancelled = false;
    async function loadDue() {
      if (!effectiveUserId) {
        setDueCards([]);
        setDueLoading(false);
        return;
      }
      setDueError(false);
      setDueLoading(true);
      try {
        const response = await learnerApiFetch(
          `/api/flashcards/reviews/due?userId=${encodeURIComponent(effectiveUserId)}&limit=10`
        );
        if (!response.ok) {
          throw new Error("failed");
        }
        const data = (await response.json()) as DueCardRow[];
        if (!cancelled) {
          setDueCards(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setDueError(true);
          setDueCards([]);
        }
      } finally {
        if (!cancelled) {
          setDueLoading(false);
        }
      }
    }
    void loadDue();
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId, hub?.dueReviews]);

  async function postAction(
    itemId: string,
    action: "generate-flashcards" | "quick-quiz" | "mark-useful"
  ) {
    setActionMessage("");
    setQuizText("");
    setActiveQuiz(null);
    try {
      const response = await learnerApiFetch(`/api/daily/items/${itemId}/${action}`, {
        body: JSON.stringify({ userId: effectiveUserId || undefined }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("Daily action failed");
      }
      const data = (await response.json()) as {
        cardCount?: number;
        prompt?: string;
        options?: string[];
      };
      if (action === "generate-flashcards") {
        setActionMessage(`${dailyLabels.cardsCreated}: ${data.cardCount ?? 0}`);
      }
      if (action === "quick-quiz") {
        if (
          typeof data.prompt === "string" &&
          Array.isArray(data.options) &&
          data.options.length > 0
        ) {
          setActiveQuiz({ itemId, options: data.options, prompt: data.prompt });
        } else {
          setQuizText(dailyLabels.quickQuiz);
        }
      }
      if (action === "mark-useful") {
        setActionMessage(dailyLabels.markUseful);
      }
    } catch {
      setActionMessage(dailyLabels.widgetActionError);
    }
  }

  async function completeQuickQuiz(itemId: string, selectedIndex: number) {
    setActionMessage("");
    try {
      const response = await learnerApiFetch(`/api/daily/items/${itemId}/quick-quiz/complete`, {
        body: JSON.stringify({ selectedIndex, userId: effectiveUserId || undefined }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("Complete quick quiz failed");
      }
      const data = (await response.json()) as { correctAnswer: string; isCorrect: boolean };
      setActiveQuiz(null);
      setActionMessage(
        data.isCorrect
          ? dailyLabels.quickQuizCorrect
          : dailyLabels.quickQuizWrong.replace("{answer}", data.correctAnswer)
      );
    } catch {
      setActionMessage(dailyLabels.widgetActionError);
    }
  }

  const base = `/${locale}`;
  const dueCount = effectiveUserId
    ? dueCards.length > 0
      ? dueCards.length
      : (hub?.dueReviews ?? 0)
    : null;
  const streakDays = analytics?.totals.streakDays ?? null;
  const streakDisplay =
    streakDays !== null && streakDays > 0
      ? dashboardLabels.streakDays.replace("{n}", String(streakDays))
      : "—";
  const reviewFormatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "vi-VN", {
    month: "2-digit",
    day: "2-digit"
  });

  const orderedFeatured: DailyWidget[] = hub
    ? FEATURED_KINDS.map((kind) => hub.widgets.find((w) => w.config.widgetKind === kind)).filter(
        (w): w is DailyWidget => Boolean(w)
      )
    : [];
  const otherWidgets =
    hub?.widgets.filter(
      (w) => !FEATURED_KINDS.includes(w.config.widgetKind as (typeof FEATURED_KINDS)[number])
    ) ?? [];

  const primaryCta = (
    <a
      className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-surface shadow-sm transition hover:bg-accent-mid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mid"
      href={`${base}/flashcards`}
    >
      {dashboardLabels.primaryCta}
    </a>
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const raw = String(formData.get("q") ?? "").trim();
    if (raw) {
      window.location.href = `${base}/search?q=${encodeURIComponent(raw)}`;
    }
  }

  const sampleFeatured = [
    {
      body: dailyLabels.sampleWeatherBody,
      title: dailyLabels.sampleWeatherTitle
    },
    {
      body: dailyLabels.sampleBusinessBody,
      title: dailyLabels.sampleBusinessTitle
    },
    {
      body: dailyLabels.sampleSeasonalBody,
      title: dailyLabels.sampleSeasonalTitle
    }
  ] as const;

  return (
    <div className="w-full pb-8">
      <section className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-[0_12px_40px_rgba(23,33,31,0.06)] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-end">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-leaf">
              {dashboardLabels.commandCenterEyebrow}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {dashboardLabels.commandCenterTitle}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              {dashboardLabels.commandCenterDescription}
            </p>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch}>
              <label className="sr-only" htmlFor="home-search">
                {dashboardLabels.searchTitle}
              </label>
              <input
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-ink/12 bg-paper px-4 text-sm text-ink shadow-inner placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mid"
                id="home-search"
                name="q"
                placeholder={dashboardLabels.searchPlaceholder}
                type="search"
              />
              <button
                className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-surface hover:bg-ink/90"
                type="submit"
              >
                {dashboardLabels.searchSubmit}
              </button>
            </form>
          </div>
          <button
            className="rounded-xl border border-ink/15 bg-paper px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
            disabled={loading}
            type="button"
            onClick={() => void loadHub()}
          >
            {dailyLabels.load}
          </button>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-12 gap-4 md:gap-6">
        {/* Greeting — compact, not a hero */}
        <div className="col-span-12">
          <Card className="border-ink/10 shadow-sm">
            <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-baseline sm:justify-between sm:p-5">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-muted">{dashboardLabels.compactBrand}</p>
                <p className="text-base font-semibold text-ink">
                  {hub?.greeting.japanese ?? dashboardLabels.fallbackGreetingTitle}
                </p>
                <p className="jp-text text-sm text-muted">{hub?.greeting.reading}</p>
              </div>
              <p className="text-xs text-muted sm:max-w-xs sm:text-right">
                {dashboardLabels.subtitle}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Today plan — main focus */}
        <div className="col-span-12 lg:col-span-8">
          <TodayPlanCard
            className="h-full border-indigo-200/60 shadow-[0_12px_40px_rgba(79,70,229,0.07)]"
            cta={primaryCta}
            metaLine={
              hub
                ? `${dashboardLabels.metaDate.replace("{date}", hub.today)} · ${dashboardLabels.dueReviewsLine.replace("{count}", String(hub.dueReviews))}`
                : loading
                  ? dailyLabels.load
                  : undefined
            }
            streakLabel={dashboardLabels.streakLabel}
            streakValue={streakDisplay}
            title={dashboardLabels.todayPlanTitle}
          >
            <p className="max-w-xl text-sm leading-relaxed text-muted">
              {dashboardLabels.recommendationFallback}
            </p>
          </TodayPlanCard>
        </div>

        {/* Progress + stats — right column */}
        <aside className="col-span-12 flex flex-col gap-4 lg:col-span-4 lg:sticky lg:top-6 lg:self-start">
          <ProgressCard
            description={dashboardLabels.progressCardDescription}
            footer={
              analytics?.insight ? (
                <span>
                  <strong className="text-ink">{dashboardLabels.insightLabel}: </strong>
                  {analytics.insight}
                </span>
              ) : (
                <span className="text-muted">{dashboardLabels.recommendationFallback}</span>
              )
            }
            title={dashboardLabels.progressSectionTitle}
          >
            {!effectiveUserId ? (
              <EmptyState
                className="border-ink/10 bg-paper/60 py-6"
                description={dashboardLabels.signInForProgressDescription}
                title={dashboardLabels.signInForProgressTitle}
              />
            ) : null}
            {effectiveUserId && analyticsError ? (
              <EmptyState
                className="border-0 bg-transparent p-2"
                description={dashboardLabels.emptyAnalyticsDescription}
                title={dashboardLabels.emptyAnalyticsTitle}
              />
            ) : null}
            {effectiveUserId && analytics ? (
              <>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-ink/8 bg-paper/80 p-3">
                    <dt className="text-xs text-muted">{dashboardLabels.totalReviewsLabel}</dt>
                    <dd className="mt-1 font-semibold tabular-nums text-ink">
                      {analytics.totals.reviewCount.toLocaleString()}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-ink/8 bg-paper/80 p-3">
                    <dt className="text-xs text-muted">{dashboardLabels.bjtAccuracyLabel}</dt>
                    <dd className="mt-1 font-semibold tabular-nums text-ink">
                      {analytics.totals.bjtAccuracyPct}%
                    </dd>
                  </div>
                  <div className="rounded-xl border border-ink/8 bg-paper/80 p-3">
                    <dt className="text-xs text-muted">{dashboardLabels.bjtSessionsLabel}</dt>
                    <dd className="mt-1 font-semibold tabular-nums text-ink">
                      {analytics.totals.completedBjtSessions}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-ink/8 bg-paper/80 p-3">
                    <dt className="text-xs text-muted">{dashboardLabels.weakSkillLabel}</dt>
                    <dd className="mt-1 text-ink">{dashboardLabels.weakSkillValue}</dd>
                  </div>
                </dl>

                <div className="space-y-2 rounded-xl border border-emerald-900/12 bg-emerald-50/20 p-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-900/80">
                      {dashboardLabels.comebackEvidenceTitle}
                    </p>
                    <p className="text-xs text-muted">{dashboardLabels.comebackEvidenceDescription}</p>
                  </div>
                  {comebackSummaryError ? (
                    <p className="text-xs text-muted">{dashboardLabels.emptyAnalyticsDescription}</p>
                  ) : null}
                    {comebackSummaryLoading ? (
                      <div className="space-y-2">
                        <div className="h-9 animate-pulse rounded-lg bg-ink/10" />
                        <div className="h-9 animate-pulse rounded-lg bg-ink/10" />
                      </div>
                    ) : null}
                  {comebackSummary ? (
                    <>
                      <dl className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg border border-ink/8 bg-paper/70 p-2">
                          <dt className="text-muted">{dashboardLabels.comebackInWindow}</dt>
                          <dd className="mt-1 font-semibold tabular-nums text-ink">
                            {comebackSummary.activeComebackCards}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-ink/8 bg-paper/70 p-2">
                          <dt className="text-muted">{dashboardLabels.comebackDueLabel}</dt>
                          <dd className="mt-1 font-semibold tabular-nums text-ink">
                            {comebackSummary.dueComebackCards}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-ink/8 bg-paper/70 p-2">
                          <dt className="text-muted">{dashboardLabels.comebackLeechedLabel}</dt>
                          <dd className="mt-1 font-semibold tabular-nums text-ink">
                            {comebackSummary.leechedCards}
                          </dd>
                        </div>
                      </dl>
                      {comebackSummary.recentComebackReviews.length > 0 ? (
                        <ul className="space-y-1 text-xs text-muted">
                          {comebackSummary.recentComebackReviews.slice(0, 2).map((entry) => (
                            <li className="line-clamp-2" key={entry.userFlashcardId}>
                              {dashboardLabels.comebackReviewEntry
                                .replace("{date}", reviewFormatter.format(new Date(entry.reviewedAt)))
                                .replace("{rating}", labelForRating(entry.rating, dashboardLabels))
                                .replace("{card}", entry.cardPreview)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted">{dashboardLabels.comebackNoRecent}</p>
                      )}
                        {comebackSummary.dueComebackCards > 0 ? (
                          <a
                            className="inline-flex items-center justify-center rounded-lg border border-emerald-800/20 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                            href={`${base}/flashcards?source=comeback`}
                          >
                            {dashboardLabels.flashcardCta}
                          </a>
                        ) : null}
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
            {effectiveUserId && !analytics && !analyticsError ? (
                <p className="text-sm text-muted">{analyticsLoading ? dailyLabels.load : ""}</p>
            ) : null}
          </ProgressCard>

          <Card className="border-ink/10 shadow-[0_8px_28px_rgba(23,33,31,0.05)]">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {dashboardLabels.flashcardDueTitle}
                </p>
                <p className="text-xs text-muted">{dashboardLabels.flashcardDueDescription}</p>
              </div>
              {!effectiveUserId ? (
                <div className="rounded-xl border border-dashed border-indigo-200/80 bg-indigo-50/20 p-4">
                  <p className="text-xs font-medium text-indigo-900/75">
                    {dashboardLabels.demoStatsCaption}
                  </p>
                  <p className="jp-text mt-2 text-xl font-semibold tabular-nums text-accent">
                    {dashboardLabels.demoDueCount}
                  </p>
                  <p className="mt-1 text-xs text-muted">{dashboardLabels.flashcardPreviewLabel}</p>
                  <p className="jp-text mt-1 line-clamp-2 text-sm text-ink">
                    {dashboardLabels.demoFlashcardFront}
                  </p>
                  <a
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-accent/25 bg-accent/10 py-2 text-sm font-semibold text-accent hover:bg-accent/15"
                    href={`${base}/flashcards`}
                  >
                    {dashboardLabels.flashcardCta}
                  </a>
                </div>
              ) : null}
              {effectiveUserId && dueError ? (
                <EmptyState
                  className="border-ink/10 bg-paper/50 py-6"
                  description={dashboardLabels.emptyDueDescription}
                  title={dashboardLabels.emptyDueTitle}
                />
              ) : null}
              {effectiveUserId && !dueError ? (
                <>
                  {dueLoading ? (
                    <div className="space-y-2">
                      <div className="h-7 w-16 animate-pulse rounded bg-ink/10" />
                      <div className="h-4 w-full animate-pulse rounded bg-ink/10" />
                      <div className="h-4 w-3/4 animate-pulse rounded bg-ink/10" />
                    </div>
                  ) : (
                    <>
                      <p className="text-xl font-semibold tabular-nums text-accent">
                        {dueCount !== null ? String(dueCount) : "0"}
                      </p>
                      <p className="text-xs font-medium text-muted">
                        {dashboardLabels.flashcardPreviewLabel}
                      </p>
                      <p className="jp-text line-clamp-3 text-sm text-ink">
                        {dueCards[0]?.card.frontText ?? dashboardLabels.flashcardPreviewEmpty}
                      </p>
                      <a
                        className="inline-flex w-full items-center justify-center rounded-xl border border-accent/30 bg-accent/10 py-2 text-sm font-semibold text-accent hover:bg-accent/15"
                        href={`${base}/flashcards`}
                      >
                        {dashboardLabels.flashcardCta}
                      </a>
                    </>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        </aside>

        {/* Primary shortcuts — max 5, card wrapper */}
        <div className="col-span-12">
          <Card className="border-ink/10 shadow-[0_8px_28px_rgba(23,33,31,0.05)]">
            <CardContent className="space-y-4 pt-5">
              <SectionHeader
                description={dashboardLabels.actionsSectionTitle}
                heading="h3"
                title={dashboardLabels.primaryShortcutsTitle}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
                <ActionCard
                  className="min-w-0"
                  description={dashboardLabels.reviewDescription}
                  href={`${base}/flashcards`}
                  title={dashboardLabels.reviewTitle}
                />
                <ActionCard
                  className="min-w-0"
                  description={dashboardLabels.continueDescription}
                  href={`${base}/onboarding`}
                  title={dashboardLabels.continueTitle}
                />
                <ActionCard
                  className="min-w-0"
                  description={dashboardLabels.dailyHubDescription}
                  href={`${base}#daily-japanese`}
                  title={dashboardLabels.dailyHubTitle}
                />
                <ActionCard
                  className="min-w-0"
                  description={dashboardLabels.bjtMiniDescription}
                  href={`${base}/quiz`}
                  title={dashboardLabels.bjtMiniTitle}
                />
                <ActionCard
                  className="min-w-0 sm:col-span-2 lg:col-span-1"
                  description={dashboardLabels.searchDescription}
                  href={`${base}/search`}
                  title={dashboardLabels.searchTitle}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Supporting: Daily Japanese */}
        <section className="col-span-12 scroll-mt-24" id="daily-japanese">
          <Card className="border-ink/10 shadow-[0_8px_28px_rgba(23,33,31,0.05)]">
            <CardHeader>
              <CardTitle>{dashboardLabels.dailyJapaneseTitle}</CardTitle>
              <CardDescription>{dailyLabels.widgetsTitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {loading ? (
                  <div className="grid gap-3 md:grid-cols-3 md:gap-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Card className="border-ink/8 shadow-sm" key={`daily-loading-${index}`}>
                        <CardContent className="space-y-2 pt-5">
                          <div className="h-5 w-24 animate-pulse rounded bg-ink/10" />
                          <div className="h-6 w-full animate-pulse rounded bg-ink/10" />
                          <div className="h-4 w-2/3 animate-pulse rounded bg-ink/10" />
                          <div className="h-4 w-3/4 animate-pulse rounded bg-ink/10" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : null}
              {error ? (
                <p className="text-sm text-sakura" role="alert">
                  {dailyLabels.error}
                </p>
              ) : null}

              {hub && hub.widgets.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {dailyLabels.sampleWidgetBadge}
                  </p>
                  <div className="grid gap-3 md:grid-cols-3">
                    {sampleFeatured.map((s) => (
                      <Card className="border-emerald-900/10 bg-emerald-50/20" key={s.title}>
                        <CardContent className="space-y-2 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">
                            {s.title}
                          </p>
                          <p className="jp-text font-medium text-ink">{s.body}</p>
                          <p className="text-xs text-muted">{dailyLabels.empty}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null}

              {hub && orderedFeatured.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-3 md:gap-4">
                  {orderedFeatured.map((widget) => (
                    <Card className="border-ink/8 shadow-sm" key={widget.config.id}>
                      <CardContent className="space-y-2 pt-5">
                        <SkillChip className="text-emerald-900">
                          {labelForKind(widget.config.widgetKind, dashboardLabels)}
                        </SkillChip>
                        <p className="jp-text font-medium text-ink">
                          {widget.item?.japaneseText ?? "—"}
                        </p>
                        <p className="text-xs text-muted">{widget.item?.readingText}</p>
                        <p className="text-sm text-muted">{widget.item?.title}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}

              {actionMessage ? (
                <LearningFeedback tone="success">{actionMessage}</LearningFeedback>
              ) : null}
              {quizText ? <LearningFeedback tone="info">{quizText}</LearningFeedback> : null}

              {hub && otherWidgets.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted">{dailyLabels.widgetsTitle}</h3>
                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                    {otherWidgets.map((widget) => (
                      <DailyWidgetCard
                        key={widget.config.id}
                        activeQuiz={activeQuiz}
                        completeQuickQuiz={completeQuickQuiz}
                        labels={dailyLabels}
                        userId={effectiveUserId}
                        widget={widget}
                        onAction={postAction}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function DailyWidgetCard({
  activeQuiz,
  completeQuickQuiz,
  labels,
  onAction,
  userId,
  widget
}: {
  activeQuiz: ActiveQuickQuiz | null;
  completeQuickQuiz: (itemId: string, selectedIndex: number) => Promise<void>;
  labels: DailyLabels;
  onAction: (
    itemId: string,
    action: "generate-flashcards" | "quick-quiz" | "mark-useful"
  ) => Promise<void>;
  userId: string;
  widget: DailyWidget;
}) {
  const item = widget.item;
  const ref = useRef<HTMLElement | null>(null);
  const seenRef = useRef(false);

  useEffect(() => {
    seenRef.current = false;
  }, [item?.id]);

  useEffect(() => {
    if (!item?.id || !ref.current) {
      return;
    }
    if (seenRef.current) {
      return;
    }
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }
        if (seenRef.current) {
          return;
        }
        seenRef.current = true;
        observer.disconnect();
        void fetch(`${apiBaseUrl}/api/analytics/events`, {
          body: JSON.stringify({
            eventName: "daily_widget_viewed",
            payload: { itemId: item.id, widgetKind: item.widgetKind },
            source: "learner_web",
            ...(userId ? { userId } : {})
          }),
          headers: { "content-type": "application/json" },
          method: "POST"
        }).catch(() => {});
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [item?.id, item?.widgetKind, userId]);

  const showActiveQuiz = item && activeQuiz?.itemId === item.id;

  return (
    <article className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm" ref={ref}>
      <SkillChip className="mb-2 text-muted">{widget.config.widgetKind}</SkillChip>
      <h3 className="text-base font-semibold text-ink">
        {item?.title ?? widget.config.widgetKind}
      </h3>
      {item?.japaneseText ? (
        <strong className="jp-text mt-2 block text-base font-semibold text-ink">
          {item.japaneseText}
        </strong>
      ) : null}
      {item?.readingText ? <span className="text-sm text-muted">{item.readingText}</span> : null}
      {item?.explanationText ? (
        <p className="mt-2 text-sm text-muted">{item.explanationText}</p>
      ) : null}
      {item?.learningSafeguard ? (
        <div className="mt-3 space-y-2 rounded-xl border border-amber-800/20 bg-amber-50/50 p-3">
          <p className="text-xs text-amber-950">
            <strong>{labels.lifeLearningObjectiveLabel}: </strong>
            {item.learningSafeguard.learningObjective}
          </p>
          <p className="text-xs text-amber-950">
            <strong>{labels.lifeDisclaimerLabel}: </strong>
            {item.learningSafeguard.riskDisclaimer}
          </p>
          {item.learningSafeguard.sourceTitle || item.learningSafeguard.sourceUrl ? (
            <p className="text-xs text-amber-900">
              <strong>{labels.lifeSourceLabel}: </strong>
              {item.learningSafeguard.sourceTitle ?? item.learningSafeguard.sourceUrl}
              {item.learningSafeguard.sourceDate ? ` (${item.learningSafeguard.sourceDate})` : ""}
              {item.learningSafeguard.sourceUrl ? (
                <>
                  {" "}
                  <a
                    className="underline underline-offset-2"
                    href={item.learningSafeguard.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {item.learningSafeguard.sourceUrl}
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          {item.learningSafeguard.remediationLinks.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-900">{labels.lifeRemediationLabel}</p>
              <ul className="space-y-1">
                {item.learningSafeguard.remediationLinks.slice(0, 3).map((link) => (
                  <li key={`${item.id}-${link.href}`}>
                    <a
                      className="text-xs text-amber-900 underline underline-offset-2"
                      href={link.href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {item ? (
        <div className="mt-3 flex flex-wrap gap-3 border-t border-ink/8 pt-3">
          <button
            className="rounded-lg border border-ink/12 bg-paper/80 px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
            type="button"
            onClick={() => void onAction(item.id, "generate-flashcards")}
          >
            {labels.addCards}
          </button>
          <button
            className="rounded-lg border border-ink/12 bg-paper/80 px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
            type="button"
            onClick={() => void onAction(item.id, "quick-quiz")}
          >
            {labels.quickQuiz}
          </button>
          <button
            className="rounded-lg border border-ink/12 bg-paper/80 px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
            type="button"
            onClick={() => void onAction(item.id, "mark-useful")}
          >
            {labels.markUseful}
          </button>
        </div>
      ) : null}
      {showActiveQuiz && activeQuiz ? (
        <div className="mt-4 rounded-xl border border-ink/10 bg-paper/60 p-3">
          <p className="text-sm text-ink">{activeQuiz.prompt}</p>
          <p className="mt-1 text-xs text-muted">{labels.quickQuizChoose}</p>
          <div className="mt-2 flex flex-col gap-2">
            {activeQuiz.options.map((opt, i) => (
              <button
                className="rounded-lg border border-ink/12 px-3 py-2 text-left text-sm text-ink hover:bg-surface"
                key={`${i}-${opt.slice(0, 16)}`}
                type="button"
                onClick={() => void completeQuickQuiz(activeQuiz.itemId, i)}
              >
                {String.fromCharCode(65 + i)}. {opt}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
