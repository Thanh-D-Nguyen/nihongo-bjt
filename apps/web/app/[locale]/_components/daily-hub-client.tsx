"use client";

import {
  LearningFeedback
} from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useKeycloakAuth } from "../../../components/auth/keycloak-auth-provider";
import { ScrollStrip } from "../../_components/scroll-strip";
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
  kindLifeBanking: string;
  kindLifeHousing: string;
  kindLifeSituation: string;
  kindLifeTax: string;
  kindNhkNews: string;
  kindTimeGreeting: string;
  load: string;
  markUseful: string;
  noContentYet: string;
  placeholder: string;
  quickQuiz: string;
  quickQuizChoose: string;
  quickQuizCorrect: string;
  quickQuizWrong: string;
  readMore: string;
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
  battleTitle: string;
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
  lifeInJapanTitle: string;
  lifeInJapanSubtitle: string;
  metaDate: string;
  primaryCta: string;
  primaryShortcutsTitle: string;
  progressCardDescription: string;
  progressSectionTitle: string;
  quickBattleDesc: string;
  quickBjtDesc: string;
  quickFlashcardDesc: string;
  quickSearchDesc: string;
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
  streakEmpty: string;
  streakLabel: string;
  subtitle: string;
  todayPlanTitle: string;
  totalReviewsLabel: string;
  weakSkillLabel: string;
  weakSkillValue: string;
  recentBattleTitle: string;
  recentBattleEmpty: string;
  recentBattleWin: string;
  recentBattleLoss: string;
  recentBattleDraw: string;
  recentBattleVsBot: string;
  recentBattleScore: string;
  weakSkillsTitle: string;
  weakSkillsEmpty: string;
  weakSkillAttempts: string;
  weakSkillErrors: string;
  availableTestsTitle: string;
  availableTestsEmpty: string;
  availableTestsSections: string;
  availableTestsStart: string;
  bookmarkCount: string;
  nhkNewsTitle: string;
  nhkNewsSubtitle: string;
  nhkNewsEmpty: string;
  nhkNewsDifficulty: string;
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
  imageUrl?: string | null;
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

interface NhkArticle {
  id: string;
  title: string;
  publishedAt: string;
  difficulty: string | null;
  url: string;
}

interface LearnerAnalytics {
  insight: string;
  totals: {
    bjtAccuracyPct: number;
    completedBjtSessions: number;
    reviewCount: number;
    streakDays: number;
  };
  weakSkills?: WeakSkill[];
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

interface BattleSession {
  botKey: string;
  completedAt: string | null;
  id: string;
  maxRounds: number;
  mode: string;
  opponentScore: number;
  roomCode: string;
  startedAt: string;
  status: string;
  userId: string;
  userScore: number;
}

interface QuizTemplate {
  id: string;
  createdAt: string;
  titleVi?: string;
  titleJa?: string;
  level?: string;
  _count: { sections: number; sessions: number };
}

interface WeakSkill {
  skillTag: string;
  attempts: number;
  incorrect: number;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const FEATURED_KINDS = ["weather", "business_phrase", "seasonal_word"] as const;
const LIFE_IN_JAPAN_KINDS = ["life_situation", "life_housing", "life_banking", "life_tax"] as const;

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

function labelForWidgetKind(kind: string, d: DailyLabels) {
  if (kind === "time_greeting") {
    return d.kindTimeGreeting;
  }
  if (kind === "life_situation") {
    return d.kindLifeSituation;
  }
  if (kind === "life_housing") {
    return d.kindLifeHousing;
  }
  if (kind === "life_banking") {
    return d.kindLifeBanking;
  }
  if (kind === "life_tax") {
    return d.kindLifeTax;
  }
  if (kind === "nhk_news") {
    return d.kindNhkNews;
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- read deferred until daily widget UI triggers
  const [_activeQuiz, setActiveQuiz] = useState<ActiveQuickQuiz | null>(null);
  const [analytics, setAnalytics] = useState<LearnerAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [comebackSummary, setComebackSummary] = useState<ComebackSummary | null>(null);
  const [dueCards, setDueCards] = useState<DueCardRow[]>([]);
  const [dueError, setDueError] = useState(false);
  const [dueLoading, setDueLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hub, setHub] = useState<DailyHubPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [quizText, setQuizText] = useState("");
  const [battleSessions, setBattleSessions] = useState<BattleSession[]>([]);
  const [quizTemplates, setQuizTemplates] = useState<QuizTemplate[]>([]);
  const [nhkArticles, setNhkArticles] = useState<NhkArticle[]>([]);
  const [nhkLoading, setNhkLoading] = useState(false);
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
          `/api/analytics/learner?days=7&userId=${encodeURIComponent(effectiveUserId)}&locale=${locale}`
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
        return;
      }
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
          setComebackSummary(null);
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

  /* Fetch recent battle sessions for authenticated user */
  useEffect(() => {
    let cancelled = false;
    async function loadBattles() {
      if (!effectiveUserId) { setBattleSessions([]); return; }
      try {
        const res = await learnerApiFetchOptional(`/api/battle/sessions/recent?userId=${encodeURIComponent(effectiveUserId)}&limit=3`);
        if (res.ok && !cancelled) {
          const data = (await res.json()) as BattleSession[];
          setBattleSessions(Array.isArray(data) ? data : []);
        }
      } catch { if (!cancelled) setBattleSessions([]); }
    }
    void loadBattles();
    return () => { cancelled = true; };
  }, [effectiveUserId]);

  /* Fetch published quiz/test templates (public) */
  useEffect(() => {
    let cancelled = false;
    async function loadTests() {
      try {
        const res = await learnerApiFetchOptional(`/api/quiz/templates`);
        if (res.ok && !cancelled) {
          const data = (await res.json()) as QuizTemplate[];
          setQuizTemplates(Array.isArray(data) ? data.filter((t) => !(t.titleVi ?? "").startsWith("[Seed]")).slice(0, 3) : []);
        }
      } catch { if (!cancelled) setQuizTemplates([]); }
    }
    void loadTests();
    return () => { cancelled = true; };
  }, []);

  /* Fetch NHK News articles */
  useEffect(() => {
    let cancelled = false;
    setNhkLoading(true);
    async function loadNhk() {
      try {
        const res = await learnerApiFetchOptional(`/api/nhk-news?limit=5`);
        if (res.ok && !cancelled) {
          const data = (await res.json()) as NhkArticle[];
          setNhkArticles(Array.isArray(data) ? data : []);
        }
      } catch { /* network/CORS — ignore */ }
      if (!cancelled) setNhkLoading(false);
    }
    void loadNhk();
    return () => { cancelled = true; };
  }, []);

  // Daily widget actions — wired but UI trigger not yet rendered
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      : dashboardLabels.streakEmpty;
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
      (w) =>
        !FEATURED_KINDS.includes(w.config.widgetKind as (typeof FEATURED_KINDS)[number]) &&
        !LIFE_IN_JAPAN_KINDS.includes(w.config.widgetKind as (typeof LIFE_IN_JAPAN_KINDS)[number])
    ) ?? [];
  const lifeWidgets =
    hub?.widgets.filter((w) =>
      LIFE_IN_JAPAN_KINDS.includes(w.config.widgetKind as (typeof LIFE_IN_JAPAN_KINDS)[number])
    ) ?? [];

  const sampleFeatured = [
    {
      body: dailyLabels.sampleWeatherBody,
      kanji: "天",
      title: dailyLabels.sampleWeatherTitle
    },
    {
      body: dailyLabels.sampleBusinessBody,
      kanji: "務",
      title: dailyLabels.sampleBusinessTitle
    },
    {
      body: dailyLabels.sampleSeasonalBody,
      kanji: "季",
      title: dailyLabels.sampleSeasonalTitle
    }
  ] as const;

  /* Whether Daily Japanese has any real content */
  const hasRealDailyContent = hub?.widgets.some((w) => w.item !== null) ?? false;

  const weakSkills = analytics?.weakSkills ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-16">
      {/* ── 1. Greeting Banner (navy gradient) ── */}
      <header className="relative overflow-hidden rounded-2xl px-5 py-5 sm:px-8 sm:py-6">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a2332] via-[#1e3a5f] to-[#1a2332]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
        {/* Seasonal decorative illustration — cherry blossom silhouette */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 bottom-0 h-28 w-28 text-white/[0.06] sm:h-36 sm:w-36"
          fill="currentColor"
          viewBox="0 0 120 120"
        >
          <circle cx="60" cy="52" r="8" />
          <ellipse cx="60" cy="36" rx="6" ry="14" />
          <ellipse cx="60" cy="68" rx="6" ry="14" />
          <ellipse cx="46" cy="44" rx="6" ry="14" transform="rotate(-60 46 44)" />
          <ellipse cx="74" cy="60" rx="6" ry="14" transform="rotate(-60 74 60)" />
          <ellipse cx="46" cy="60" rx="6" ry="14" transform="rotate(60 46 60)" />
          <ellipse cx="74" cy="44" rx="6" ry="14" transform="rotate(60 74 44)" />
          <circle cx="36" cy="88" r="5" />
          <ellipse cx="36" cy="78" rx="4" ry="9" />
          <ellipse cx="36" cy="98" rx="4" ry="9" />
          <ellipse cx="28" cy="82" rx="4" ry="9" transform="rotate(-60 28 82)" />
          <ellipse cx="44" cy="94" rx="4" ry="9" transform="rotate(-60 44 94)" />
          <ellipse cx="28" cy="94" rx="4" ry="9" transform="rotate(60 28 94)" />
          <ellipse cx="44" cy="82" rx="4" ry="9" transform="rotate(60 44 82)" />
          <path d="M60 72 c0 16 -10 30 -24 40" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        </svg>
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="jp-text text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {hub?.greeting.japanese ?? dashboardLabels.fallbackGreetingTitle}
            </h1>
            {hub?.greeting.reading ? (
              <p className="text-sm text-white/60">{hub.greeting.reading}</p>
            ) : null}
            <p className="max-w-md text-sm text-white/50">{dashboardLabels.subtitle}</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/60">
            {hub?.today ? <span>{hub.today}</span> : null}
            {effectiveUserId ? (
              <span className="rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white/90 border border-white/10 tabular-nums">
                {streakDisplay}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── 2. Primary Study Command Bar (glass panel + blue CTA) ── */}
      <section
        aria-label={dashboardLabels.todayPlanTitle}
        className="glass-panel overflow-hidden rounded-2xl"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink">
                {dashboardLabels.todayPlanTitle}
              </h2>
              {hub ? (
                <p className="mt-0.5 text-xs text-muted">
                  {dashboardLabels.dueReviewsLine.replace("{count}", String(hub.dueReviews))}
                </p>
              ) : loading ? (
                <div className="mt-1 h-3 w-40 animate-pulse rounded bg-ink/6" />
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-sm text-muted">
            {dashboardLabels.recommendationFallback}
          </p>
        </div>
        {/* CTA: OPAQUE blue — decisive action, not glass */}
        <a
          className="group flex min-h-[52px] w-full items-center gap-3 bg-accent px-5 py-3 text-white transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white active:bg-[#1e40af]"
          href={`${base}/flashcards`}
        >
          <span
            aria-hidden="true"
            className="jp-text flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 text-sm font-bold text-white"
          >
            復
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-bold tracking-wide">
              {dashboardLabels.primaryCta}
            </span>
            {dueCount !== null && dueCount > 0 ? (
              <span className="block text-xs text-white/60">
                {dueCount} {dashboardLabels.quickFlashcardDesc}
              </span>
            ) : null}
          </div>
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </section>

      {/* ── 3. Quick Study Paths (glass cards, keep grid for discoverability) ── */}
      <nav aria-label={dashboardLabels.actionsSectionTitle}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <a
            className="glass-card group flex items-center gap-2.5 rounded-xl p-3"
            href={`${base}/flashcards`}
          >
            <span className="jp-text flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-sm font-bold text-accent">
              復
            </span>
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-ink">{dashboardLabels.reviewTitle}</span>
              <span className="block text-[10px] leading-tight text-muted">{dueCount ? `${dueCount} ${dashboardLabels.quickFlashcardDesc}` : dashboardLabels.quickFlashcardDesc}</span>
            </div>
          </a>
          <a
            className="glass-card group flex items-center gap-2.5 rounded-xl p-3"
            href={`${base}/quiz`}
          >
            <span className="jp-text flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-leaf/10 text-sm font-bold text-leaf">
              試
            </span>
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-ink">{dashboardLabels.bjtMiniTitle}</span>
              <span className="block text-[10px] leading-tight text-muted">{dashboardLabels.quickBjtDesc}</span>
            </div>
          </a>
          <a
            className="glass-card group flex items-center gap-2.5 rounded-xl p-3"
            href={`${base}/battle`}
          >
            <span className="jp-text flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sakura/10 text-sm font-bold text-sakura">
              対
            </span>
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-ink">{dashboardLabels.battleTitle}</span>
              <span className="block text-[10px] leading-tight text-muted">{dashboardLabels.quickBattleDesc}</span>
            </div>
          </a>
          <a
            className="glass-card group flex items-center gap-2.5 rounded-xl p-3"
            href={`${base}/search`}
          >
            <span className="jp-text flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-sm font-bold text-ink/60">
              検
            </span>
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-ink">{dashboardLabels.searchTitle}</span>
              <span className="block text-[10px] leading-tight text-muted">{dashboardLabels.quickSearchDesc}</span>
            </div>
          </a>
        </div>
      </nav>

      {/* ── 4. Sign-in prompt (guest) OR Dashboard data grid (auth) ── */}
      {!effectiveUserId ? (
        <div className="rounded-2xl border border-ink/8 bg-white p-6 text-center">
          <p className="text-sm text-muted">
            {dashboardLabels.signInForProgressDescription}
          </p>
          <a
            className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-[#1e40af]"
            href={`${base}/login`}
          >
            {dashboardLabels.signInForProgressTitle}
            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Due flashcards — glass card */}
          <div className="glass-panel rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {dashboardLabels.flashcardDueTitle}
              </p>
              {dueCount !== null && dueCount > 0 ? (
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-accent">
                  {dueCount}
                </span>
              ) : null}
            </div>
            {dueLoading ? (
              <div className="mt-3 h-8 animate-pulse rounded bg-ink/5" />
            ) : dueError ? (
              <p className="mt-2 text-xs text-muted">{dashboardLabels.emptyDueDescription}</p>
            ) : dueCards.length > 0 ? (
              <div className="mt-3">
                <p className="jp-text line-clamp-2 text-sm font-medium text-ink">
                  {dueCards[0]?.card.frontText}
                </p>
                <p className="mt-1 text-[10px] text-subtle">{dashboardLabels.flashcardPreviewLabel}</p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">{dashboardLabels.flashcardPreviewEmpty}</p>
            )}
          </div>

          {/* Progress stats — glass card */}
          {analyticsLoading ? (
            <div className="glass-panel rounded-2xl p-4">
              <div className="h-3 w-20 animate-pulse rounded bg-ink/5" />
              <div className="mt-3 h-14 animate-pulse rounded bg-ink/5" />
            </div>
          ) : analytics ? (
            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{dashboardLabels.progressSectionTitle}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-[10px] text-subtle">{dashboardLabels.totalReviewsLabel}</dt>
                  <dd className="text-xl font-bold tabular-nums text-ink">
                    {analytics.totals.reviewCount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] text-subtle">{dashboardLabels.bjtAccuracyLabel}</dt>
                  <dd className="text-xl font-bold tabular-nums text-accent">
                    {analytics.totals.bjtAccuracyPct}%
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] text-subtle">{dashboardLabels.bjtSessionsLabel}</dt>
                  <dd className="text-xl font-bold tabular-nums text-ink">
                    {analytics.totals.completedBjtSessions}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] text-subtle">{dashboardLabels.streakLabel}</dt>
                  <dd className="text-sm font-bold tabular-nums text-muted">{streakDisplay}</dd>
                </div>
              </dl>
            </div>
          ) : analyticsError ? (
            <div className="glass-panel rounded-2xl p-4">
              <p className="text-xs text-muted">{dashboardLabels.emptyAnalyticsDescription}</p>
            </div>
          ) : null}

          {/* Weak skills — glass card */}
          {weakSkills.length > 0 ? (
            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{dashboardLabels.weakSkillsTitle}</p>
              <ul className="mt-3 space-y-2">
                {weakSkills.slice(0, 3).map((skill) => (
                  <li className="flex items-center justify-between text-sm" key={skill.skillTag}>
                    <span className="font-medium text-ink">{skill.skillTag}</span>
                    <span className="text-xs tabular-nums text-muted">
                      {dashboardLabels.weakSkillAttempts.replace("{n}", String(skill.attempts))} · {dashboardLabels.weakSkillErrors.replace("{n}", String(skill.incorrect))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : analytics ? (
            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{dashboardLabels.weakSkillsTitle}</p>
              <p className="mt-3 text-xs text-muted">{dashboardLabels.weakSkillsEmpty}</p>
            </div>
          ) : null}

          {/* Insight banner — leaf accent, full span */}
          {analytics?.insight ? (
            <div className="rounded-2xl border border-leaf/15 bg-leaf-soft/60 p-4 sm:col-span-2 lg:col-span-3">
              <p className="text-sm text-leaf">
                <strong>{dashboardLabels.insightLabel}:</strong> {analytics.insight}
              </p>
            </div>
          ) : null}

          {/* Recent battles */}
          {battleSessions.length > 0 ? (
            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{dashboardLabels.recentBattleTitle}</p>
              <ul className="mt-3 space-y-2">
                {battleSessions.slice(0, 3).map((b) => {
                  const result = b.userScore > b.opponentScore
                    ? dashboardLabels.recentBattleWin
                    : b.userScore < b.opponentScore
                      ? dashboardLabels.recentBattleLoss
                      : dashboardLabels.recentBattleDraw;
                  return (
                    <li className="flex items-center justify-between text-sm" key={b.id}>
                      <span className="text-muted">
                        {dashboardLabels.recentBattleVsBot.replace("{bot}", b.botKey || "Bot")}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-xs text-muted">
                          {dashboardLabels.recentBattleScore
                            .replace("{user}", String(b.userScore))
                            .replace("{opponent}", String(b.opponentScore))}
                        </span>
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${b.userScore > b.opponentScore ? "bg-leaf/10 text-leaf" : b.userScore < b.opponentScore ? "bg-sakura/10 text-sakura" : "bg-ink/5 text-muted"}`}>
                          {result}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {/* Comeback evidence */}
          {comebackSummary && comebackSummary.activeComebackCards > 0 ? (
            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {dashboardLabels.comebackEvidenceTitle}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted">{dashboardLabels.comebackInWindow}</dt>
                  <dd className="mt-0.5 text-sm font-bold tabular-nums text-ink">{comebackSummary.activeComebackCards}</dd>
                </div>
                <div>
                  <dt className="text-muted">{dashboardLabels.comebackDueLabel}</dt>
                  <dd className="mt-0.5 text-sm font-bold tabular-nums text-ink">{comebackSummary.dueComebackCards}</dd>
                </div>
                <div>
                  <dt className="text-muted">{dashboardLabels.comebackLeechedLabel}</dt>
                  <dd className="mt-0.5 text-sm font-bold tabular-nums text-ink">{comebackSummary.leechedCards}</dd>
                </div>
              </dl>
              {comebackSummary.recentComebackReviews.length > 0 ? (
                <ul className="mt-2 space-y-1 border-t border-ink/5 pt-2 text-[11px] text-muted">
                  {comebackSummary.recentComebackReviews.slice(0, 2).map((entry) => (
                    <li className="line-clamp-1" key={entry.userFlashcardId}>
                      {dashboardLabels.comebackReviewEntry
                        .replace("{date}", reviewFormatter.format(new Date(entry.reviewedAt)))
                        .replace("{rating}", labelForRating(entry.rating, dashboardLabels))
                        .replace("{card}", entry.cardPreview)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {comebackSummary.dueComebackCards > 0 ? (
                <a
                  className="mt-3 inline-flex min-h-[36px] items-center justify-center rounded-xl border border-leaf/20 bg-leaf/5 px-3 py-1.5 text-xs font-semibold text-leaf transition-colors hover:bg-leaf/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf active:bg-leaf/15"
                  href={`${base}/flashcards?source=comeback`}
                >
                  {dashboardLabels.flashcardCta}
                </a>
              ) : null}
            </div>
          ) : null}

          {/* Available BJT tests — horizontal card strip */}
          {quizTemplates.length > 0 ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{dashboardLabels.availableTestsTitle}</p>
            <ScrollStrip>
                {quizTemplates.map((t) => (
                  <a
                    className="glass-card flex min-w-[200px] shrink-0 items-center gap-3 rounded-2xl p-3 sm:min-w-[220px]"
                    href={`${base}/quiz?templateId=${t.id}`}
                    key={t.id}
                  >
                    <span
                      aria-hidden="true"
                      className="jp-text flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-leaf/10 text-sm font-bold text-leaf"
                    >
                      試
                    </span>
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-ink line-clamp-1">{(locale === "ja" ? t.titleJa : t.titleVi) || t.level || `BJT #${t.id.slice(0, 6)}`}</span>
                      <span className="text-[10px] text-muted">{dashboardLabels.availableTestsSections.replace("{n}", String(t._count.sections))}</span>
                    </div>
                    <svg
                      aria-hidden="true"
                      className="ml-auto h-4 w-4 shrink-0 text-muted/40"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      viewBox="0 0 24 24"
                    >
                      <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                ))}
            </ScrollStrip>
            </div>
          ) : null}
        </div>
      )}

      {/* ── 5. Daily Japanese (merged: featured + life-in-japan + other widgets) ── */}
      <section className="space-y-3" id="daily-japanese">
        <div>
          <div className="flex items-center gap-2">
            <span className="jp-text text-base font-bold text-accent" aria-hidden="true">日</span>
            <h2 className="text-sm font-semibold text-ink">{dashboardLabels.dailyJapaneseTitle}</h2>
          </div>
          <p className="text-xs text-muted">{dailyLabels.widgetsTitle}</p>
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-thin sm:grid sm:grid-cols-3 sm:overflow-visible">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="glass-card min-w-[220px] shrink-0 rounded-2xl p-3 sm:min-w-0" key={`dl-${i}`}>
                <div className="h-3 w-14 animate-pulse rounded bg-ink/5" />
                <div className="mt-2 h-5 w-full animate-pulse rounded bg-ink/5" />
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-sakura" role="alert">{dailyLabels.error}</p>
        ) : null}

        {/* Featured daily widgets (weather, business phrase, seasonal word) */}
        {hub ? (
          <ScrollStrip className="sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
            {orderedFeatured.map((widget) => {
              const kind = widget.config.widgetKind;
              const item = widget.item;
              const sample = sampleFeatured.find(
                (s) =>
                  (kind === "weather" && s.title === dailyLabels.sampleWeatherTitle) ||
                  (kind === "business_phrase" && s.title === dailyLabels.sampleBusinessTitle) ||
                  (kind === "seasonal_word" && s.title === dailyLabels.sampleSeasonalTitle)
              );
              return (
                <div
                  className="glass-card min-w-[220px] shrink-0 rounded-2xl sm:min-w-0"
                  key={widget.config.id}
                >
                  <div className="border-b border-ink/5 px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {labelForKind(kind, dashboardLabels)}
                    </span>
                  </div>
                  <div className="p-3">
                    {item ? (
                      <>
                        <p className="jp-text text-base font-semibold leading-relaxed text-ink">
                          {item.japaneseText}
                        </p>
                        {item.readingText ? (
                          <p className="mt-0.5 text-xs text-muted">{item.readingText}</p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-muted">{item.title}</p>
                      </>
                    ) : sample ? (
                      <>
                        <p className="jp-text text-base font-semibold leading-relaxed text-ink/40">
                          {sample.body}
                        </p>
                        <p className="mt-1 text-[10px] text-muted/50">
                          {dailyLabels.sampleWidgetBadge}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted">{dailyLabels.noContentYet}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </ScrollStrip>
        ) : null}

        {/* All remaining daily widgets (life-in-japan + other) in one strip */}
        {hub && hasRealDailyContent && [...lifeWidgets, ...otherWidgets].some((w) => w.item !== null) ? (
          <ScrollStrip>
              {[...lifeWidgets, ...otherWidgets].map((widget) => (
                <DailyPreviewCard
                  key={widget.config.id}
                  label={labelForWidgetKind(widget.config.widgetKind, dailyLabels)}
                  locale={locale}
                  userId={effectiveUserId}
                  widget={widget}
                />
              ))}
          </ScrollStrip>
        ) : null}

        {hub && !hasRealDailyContent && [...lifeWidgets, ...otherWidgets].length > 0 ? (
          <p className="text-xs text-muted">{dailyLabels.noContentYet}</p>
        ) : null}

        {actionMessage ? (
          <LearningFeedback tone="success">{actionMessage}</LearningFeedback>
        ) : null}
        {quizText ? <LearningFeedback tone="info">{quizText}</LearningFeedback> : null}
      </section>

      {/* ── 6. NHK Easy News ── */}
      <section className="space-y-3" id="nhk-news">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-accent" aria-hidden="true">📰</span>
            <h2 className="text-sm font-semibold text-ink">{dashboardLabels.nhkNewsTitle}</h2>
          </div>
          <p className="text-xs text-muted">{dashboardLabels.nhkNewsSubtitle}</p>
        </div>

        {nhkLoading ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-thin">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="glass-card min-w-[220px] shrink-0 rounded-2xl p-3" key={`nhk-sk-${i}`}>
                <div className="h-3 w-14 animate-pulse rounded bg-ink/5" />
                <div className="mt-2 h-5 w-full animate-pulse rounded bg-ink/5" />
              </div>
            ))}
          </div>
        ) : null}

        {!nhkLoading && nhkArticles.length === 0 ? (
          <p className="text-xs text-muted">{dashboardLabels.nhkNewsEmpty}</p>
        ) : null}

        {!nhkLoading && nhkArticles.length > 0 ? (
          <ScrollStrip>
            {nhkArticles.map((article) => (
              <Link
                key={article.id}
                href={`/${locale}/daily/${article.id}`}
                className="glass-card card-accent-news relative flex min-w-[220px] max-w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl no-underline sm:min-w-[240px]"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
                  {article.difficulty ? (
                    <span className="inline-flex w-fit rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                      {dashboardLabels.nhkNewsDifficulty.replace("{level}", article.difficulty)}
                    </span>
                  ) : null}
                  <p className="jp-text line-clamp-2 text-sm font-semibold leading-snug text-ink">
                    {article.title}
                  </p>
                  <span className="text-[10px] text-muted">
                    {new Date(article.publishedAt).toLocaleDateString(locale === "ja" ? "ja-JP" : "vi-VN")}
                  </span>
                </div>
              </Link>
            ))}
          </ScrollStrip>
        ) : null}
      </section>
    </div>
  );
}

/** Category → CSS accent class mapping */
const CARD_ACCENT_MAP: Record<string, string> = {
  weather: "card-accent-weather",
  business_phrase: "card-accent-business",
  seasonal_word: "card-accent-seasonal",
  life_situation: "card-accent-life",
  life_housing: "card-accent-housing",
  life_banking: "card-accent-banking",
  life_tax: "card-accent-tax",
  time_greeting: "card-accent-greeting",
  nhk_news: "card-accent-news",
};

/** Compact preview card for horizontal strip — click to go to detail page */
function DailyPreviewCard({
  label,
  locale,
  userId,
  widget,
}: {
  label: string;
  locale: string;
  userId: string;
  widget: DailyWidget;
}) {
  const item = widget.item;
  const ref = useRef<HTMLAnchorElement | null>(null);
  const seenRef = useRef(false);

  useEffect(() => {
    seenRef.current = false;
  }, [item?.id]);

  useEffect(() => {
    if (!item?.id || !ref.current) return;
    if (seenRef.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || seenRef.current) return;
        seenRef.current = true;
        observer.disconnect();
        void fetch(`${apiBaseUrl}/api/analytics/events`, {
          body: JSON.stringify({
            eventName: "daily_widget_viewed",
            payload: { itemId: item.id, widgetKind: item.widgetKind },
            source: "learner_web",
            ...(userId ? { userId } : {}),
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }).catch(() => {});
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => { observer.disconnect(); };
  }, [item?.id, item?.widgetKind, userId]);

  if (!item) return null;

  const accentClass = CARD_ACCENT_MAP[widget.config.widgetKind] ?? "";
  const hasImage = Boolean(item.imageUrl);

  return (
    <Link
      className={`glass-card relative flex min-w-[220px] max-w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl no-underline sm:min-w-[240px] ${accentClass}`}
      href={`/${locale}/daily/${item.id}`}
      ref={ref}
    >
      {/* Optional background image strip */}
      {hasImage ? (
        <div className="relative h-24 w-full shrink-0">
          <img
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            src={item.imageUrl!}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/90 to-transparent" />
        </div>
      ) : null}
      <div className={`flex min-w-0 flex-1 flex-col gap-1 p-3 ${hasImage ? "pt-0 -mt-3 relative z-10" : ""}`}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </span>
        <p className="jp-text line-clamp-2 text-sm font-semibold leading-snug text-ink">
          {item.japaneseText ?? item.title}
        </p>
        {item.readingText ? (
          <p className="line-clamp-1 text-[11px] text-muted">{item.readingText}</p>
        ) : null}
      </div>
    </Link>
  );
}
