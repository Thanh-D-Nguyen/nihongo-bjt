"use client";

import { EmptyState } from "@nihongo-bjt/ui";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnnotatedJapaneseText } from "../../../../components/reading-assist/annotated-japanese-text";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { BjtAudioPlayer, isAudioSection } from "./bjt-audio-player";
import { BjtFormatGuidePanel } from "./bjt-format-guide";
import { QuizResultsBreakdown } from "./quiz-results-breakdown";

interface Template {
  _count: { sections: number; sessions: number };
  description: string | null;
  id: string;
  level: string | null;
  slug: string;
  timeLimitSeconds: number | null;
  titleJa: string | null;
  titleVi: string;
  type: string;
}

interface SessionPayload {
  correctCount: number;
  currentQuestionNo?: number;
  estimatedBjtBand: string | null;
  estimatedScore: number | null;
  id: string;
  remainingSeconds?: number | null;
  startedAt?: string;
  status: string;
  timeLimitSeconds?: number | null;
  totalQuestions: number;
}

interface BreakdownResponse {
  sessionId: string;
  testId: string;
  testTitleVi: string;
  testTitleJa?: string | null;
  estimatedScore: number | null;
  estimatedBjtBand: string | null;
  breakdown: Array<{
    questionId: string;
    prompt: string;
    selectedOption: string;
    isCorrect: boolean;
    explanationVi: string;
    remediationCardId?: string | null;
  }>;
}

interface QuestionPayload {
  question?: {
    audioScript?: string | null;
    audioUrl?: string | null;
    id: string;
    imageUrl?: string | null;
    imageAlt?: string | null;
    options: Array<{ optionKey: string; text: string }>;
    prompt: string;
    sectionCode?: string | null;
    skillTag: string;
  };
  session: SessionPayload;
}

interface OfficialSimulationStatus {
  availableTemplates: number;
  enabled: boolean;
  entitlementKey: string;
  entitled: boolean;
  featureFlag: string;
  planSlug: string;
}

export interface QuizLabels {
  anotherRound: string;
  bandLabel: string;
  coachJ1: string;
  coachJ2: string;
  coachJ3: string;
  coachJ4: string;
  coachJ5: string;
  completedTitle: string;
  correctSummary: string;
  emptyCtaHelp: string;
  emptyCtaHome: string;
  emptyPublicDescription: string;
  emptyPublicTitle: string;
  error: string;
  estimatedScoreCaveat: string;
  eyebrow: string;
  filterAll?: string;
  filterLevel?: string;
  filterLevelAll?: string;
  filterType?: string;
  filterTypeMock?: string;
  filterTypeOfficial?: string;
  officialModeCardDescription?: string;
  officialModeCardTitle?: string;
  officialModeClosedDescription?: string;
  officialModeClosedTitle?: string;
  officialModeInviteCta?: string;
  officialModeInviteDescription?: string;
  officialModeInviteUnavailable?: string;
  officialModeLockedDescription?: string;
  officialModeLockedTitle?: string;
  officialModeManageHint?: string;
  officialModeNoTemplatesDescription?: string;
  officialModeNoTemplatesTitle?: string;
  officialModeUpgradeCta?: string;
  practiceModeCardDescription?: string;
  practiceModeCardTitle?: string;
  formatGuideBullet1: string;
  formatGuideBullet2: string;
  formatGuideBullet3: string;
  formatGuideBullet4: string;
  formatGuideBullet5: string;
  formatGuideDisclaimer: string;
  formatGuideHelpLink: string;
  formatGuideIntro: string;
  formatGuideSummary: string;
  heroPrimaryMetric?: string;
  heroSecondaryMetric?: string;
  hubExamCount?: string;
  hubMetaLevel: string;
  hubMetaQuestions?: string;
  hubMetaSections: string;
  hubMetaTimed: string;
  hubMetaUntimed: string;
  hubTemplatesDescription: string;
  hubTemplatesHeading: string;
  hubTemplatesLoading: string;
  load: string;
  noQuestion: string;
  placeholder: string;
  practiceModeBadge: string;
  printExam: string;
  questionTitle?: string;
  officialPartListening?: string;
  officialPartListeningReading?: string;
  officialPartReading?: string;
  officialSection1?: string;
  officialSection2?: string;
  officialSection3?: string;
  officialStatQuestions?: string;
  officialStatRanks?: string;
  officialStatScore?: string;
  officialStatTime?: string;
  officialStrategy1?: string;
  officialStrategy2?: string;
  officialStrategy3?: string;
  officialStrategyTitle?: string;
  resumeSession?: string;
  resumingSession?: string;
  retryQuiz?: string;
  scoreLabel: string;
  sessionBadgeActive: string;
  sessionExpired?: string;
  sessionProgress: string;
  start: string;
  subtitle: string;
  templateTypeMock?: string;
  templateTypeOfficial?: string;
  timerWarning?: string;
  title: string;
  totalScore?: string;
  viewBreakdown?: string;
  audio: {
    audioSection: string;
    hideScript: string;
    listenAudio: string;
    playCount: string;
    showScript: string;
    ttsNotice: string;
  };
  breakdown: {
    addToFlashcardAction: string;
    addToFlashcardError: string;
    addToFlashcardSuccess: string;
    breakdownTitle: string;
    correctLabel: string;
    errorText: string;
    estimatedBandLabel: string;
    estimatedScoreLabel: string;
    explanationLabel: string;
    loadingText: string;
    resultsTitle: string;
    selectedOptionLabel: string;
    wrongLabel: string;
  };
  readingAssist: {
    annotated: {
      addCardAction: string;
      addCardError: string;
      addCardNoDeck: string;
      addCardSuccess: string;
      bottomSheetClose: string;
      errorHttp: string;
      errorNetwork: string;
      errorTimeout: string;
      furiganaLabel: string;
      lexemeLine: string;
      loadingText: string;
      meaningLabel: string;
      posLabel: string;
      retryAction: string;
      serviceUnavailable: string;
    };
    sectionTitle: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function coachForBand(
  band: string | null,
  labels: Pick<QuizLabels, "coachJ1" | "coachJ2" | "coachJ3" | "coachJ4" | "coachJ5">
): string {
  switch (band) {
    case "J1":
    case "J1+":
      return labels.coachJ1;
    case "J2":
      return labels.coachJ2;
    case "J3":
      return labels.coachJ3;
    case "J4":
      return labels.coachJ4;
    default:
      return labels.coachJ5;
  }
}

function filterPublishedTemplates(rows: Template[]): Template[] {
  return rows.filter(
    (t) =>
      !t.titleVi.startsWith("[Seed]") &&
      !t.titleVi.includes("dữ liệu local") &&
      !t.titleVi.includes("シード")
  );
}

const BAND_COLORS: Record<string, string> = {
  "J1+": "text-amber-600",
  J1: "text-amber-600",
  J2: "text-emerald-600",
  J3: "text-sky-600",
  J4: "text-violet-600",
  J5: "text-slate-500"
};

const LEVEL_ORDER = ["J5", "J4", "J3", "J2", "J1", "J1+"];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLevel(value: string | null | undefined): string | null {
  return value?.replace(/^BJT-/u, "") ?? null;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function QuizClient({ labels, locale = "vi" }: { labels: QuizLabels; locale?: string }) {
  const [error, setError] = useState(false);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [results, setResults] = useState<SessionPayload | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownResponse | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("practice");
  const [officialStatus, setOfficialStatus] = useState<OfficialSimulationStatus | null>(null);
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeringRef = useRef(false);
  const { userId } = useKeycloakAuth();

  const inQuestion = Boolean(question?.question);
  const showHub = !inQuestion && !results && !resuming;

  /* ---- Timer management ---- */

  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerSeconds(Math.max(0, seconds));
    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerSeconds(null);
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-expire on timer reaching 0
  useEffect(() => {
    if (timerSeconds === 0 && question?.session) {
      // Timer expired — fetch results
      const sid = question.session.id;
      const uid = userId;
      if (!uid) return;
      stopTimer();
      void (async () => {
        try {
          // Try to get next question — server will return 403 if expired
          const res = await learnerApiFetch(
            `/api/quiz/session/${sid}/question?userId=${encodeURIComponent(uid)}`
          );
          if (res.ok) {
            const data = (await res.json()) as QuestionPayload;
            if (data.session.status === "completed") {
              setResults(data.session);
              setQuestion(null);
            }
          } else {
            // Session expired on server — try to get results
            const resultRes = await learnerApiFetch(
              `/api/quiz/session/${sid}/results?userId=${encodeURIComponent(uid)}`
            );
            if (resultRes.ok) {
              const resultData = (await resultRes.json()) as SessionPayload;
              setResults(resultData);
              setQuestion(null);
            }
          }
        } catch {
          setError(true);
        }
      })();
    }
  }, [timerSeconds, question?.session, userId, stopTimer]);

  /* ---- Session resume on page load ---- */

  const checkActiveSession = useCallback(async (uid: string) => {
    try {
      const response = await learnerApiFetch(
        `/api/quiz/session/active?userId=${encodeURIComponent(uid)}`
      );
      if (!response.ok) return null;
      const data = (await response.json()) as {
        session: {
          id: string;
          remainingSeconds: number | null;
          timeLimitSeconds: number | null;
          totalQuestions: number;
          currentQuestionNo: number;
          correctCount: number;
          status: string;
          startedAt: string;
        } | null;
      };
      return data.session;
    } catch {
      return null;
    }
  }, []);

  const resumeSession = useCallback(
    async (sessionId: string, uid: string, remainingSeconds: number | null) => {
      setResuming(true);
      setError(false);
      try {
        const res = await learnerApiFetch(
          `/api/quiz/session/${sessionId}/question?userId=${encodeURIComponent(uid)}`
        );
        if (!res.ok) {
          // Session may have expired or completed
          setResuming(false);
          return false;
        }
        const data = (await res.json()) as QuestionPayload;
        if (data.session.status === "completed") {
          setResults(data.session);
          setResuming(false);
          return true;
        }
        setQuestion(data);
        // Start timer if timed
        if (data.session.remainingSeconds != null && data.session.remainingSeconds > 0) {
          startTimer(data.session.remainingSeconds);
        } else if (remainingSeconds != null && remainingSeconds > 0) {
          startTimer(remainingSeconds);
        }
        setResuming(false);
        return true;
      } catch {
        setResuming(false);
        return false;
      }
    },
    [startTimer]
  );

  /* ---- Data loading ---- */

  const loadTemplates = useCallback(async () => {
    setError(false);
    setTemplatesLoading(true);
    try {
      const response = await learnerApiFetch("/api/quiz/templates");
      if (!response.ok) throw new Error("Template request failed");
      const all = (await response.json()) as Template[];
      setTemplates(filterPublishedTemplates(all));
    } catch {
      setError(true);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const loadOfficialStatus = useCallback(async (uid: string) => {
    try {
      const response = await learnerApiFetch(
        `/api/quiz/official-simulation/status?userId=${encodeURIComponent(uid)}`
      );
      if (!response.ok) return;
      setOfficialStatus((await response.json()) as OfficialSimulationStatus);
    } catch {
      setOfficialStatus(null);
    }
  }, []);

  const loadReferralLink = useCallback(async (uid: string) => {
    try {
      const response = await learnerApiFetch(
        `/api/learner/referral?userId=${encodeURIComponent(uid)}`
      );
      if (!response.ok) return;
      const data = (await response.json()) as { link?: string };
      setReferralLink(data.link ?? null);
    } catch {
      setReferralLink(null);
    }
  }, []);

  // On mount: load templates + check for active session to resume
  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      await loadOfficialStatus(userId);
      await loadReferralLink(userId);
      const active = await checkActiveSession(userId);
      if (active) {
        await resumeSession(active.id, userId, active.remainingSeconds);
      }
    })();
  }, [userId, checkActiveSession, loadOfficialStatus, loadReferralLink, resumeSession]);

  useEffect(() => {
    if (results && userId && !breakdown) {
      void loadBreakdown(results.id, userId);
    }
  }, [results, userId, breakdown]);

  async function loadBreakdown(sessionId: string, uid: string) {
    setBreakdownLoading(true);
    try {
      const response = await learnerApiFetch(
        `/api/quiz/session/${sessionId}/results/breakdown?userId=${encodeURIComponent(uid)}`
      );
      if (!response.ok) throw new Error("Breakdown request failed");
      setBreakdown((await response.json()) as BreakdownResponse);
    } catch {
      setError(true);
    } finally {
      setBreakdownLoading(false);
    }
  }

  async function start(event: FormEvent<HTMLFormElement>, testId: string) {
    event.preventDefault();
    const uid = userId;
    if (!uid || submitting) return;
    setError(false);
    setResults(null);
    setBreakdown(null);
    setShowBreakdown(false);
    stopTimer();
    setSubmitting(true);
    try {
      const started = await learnerApiFetch("/api/quiz/start", {
        body: JSON.stringify({ testId, userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!started.ok) throw new Error("Start quiz failed");
      const session = (await started.json()) as { id: string };
      const next = await learnerApiFetch(
        `/api/quiz/session/${session.id}/question?userId=${encodeURIComponent(uid)}`
      );
      const data = (await next.json()) as QuestionPayload;
      setQuestion(data);
      // Start timer if the exam is timed
      if (data.session.remainingSeconds != null && data.session.remainingSeconds > 0) {
        startTimer(data.session.remainingSeconds);
      } else if (data.session.timeLimitSeconds != null && data.session.timeLimitSeconds > 0) {
        startTimer(data.session.timeLimitSeconds);
      }
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function startOfficialUpgrade() {
    const uid = userId;
    if (!uid) return;
    setError(false);
    try {
      const response = await learnerApiFetch("/api/learner/monetization/checkout", {
        body: JSON.stringify({ planSlug: "standard", userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) throw new Error("Checkout request failed");
      const data = (await response.json()) as { checkoutUrl?: string };
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl.startsWith("/")
          ? `/${locale}${data.checkoutUrl}`
          : data.checkoutUrl;
      }
    } catch {
      setError(true);
    }
  }

  async function answer(optionKey: string) {
    const uid = userId;
    if (!question?.question || !uid) return;
    // Double-submit guard
    if (answeringRef.current) return;
    answeringRef.current = true;
    setError(false);
    try {
      const response = await learnerApiFetch(`/api/quiz/session/${question.session.id}/answer`, {
        body: JSON.stringify({ optionKey, questionId: question.question.id, userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        // Check if session expired
        if (response.status === 403) {
          stopTimer();
          // Try to load results
          const resultRes = await learnerApiFetch(
            `/api/quiz/session/${question.session.id}/results?userId=${encodeURIComponent(uid)}`
          );
          if (resultRes.ok) {
            const resultData = (await resultRes.json()) as SessionPayload;
            setResults(resultData);
            setQuestion(null);
            return;
          }
        }
        throw new Error("Answer request failed");
      }
      const data = (await response.json()) as { session: SessionPayload };
      if (data.session.status === "completed") {
        stopTimer();
        setResults(data.session);
        setQuestion(null);
        return;
      }
      const next = await learnerApiFetch(
        `/api/quiz/session/${data.session.id}/question?userId=${encodeURIComponent(uid)}`
      );
      setQuestion((await next.json()) as QuestionPayload);
    } catch {
      setError(true);
    } finally {
      answeringRef.current = false;
    }
  }

  function resetToHub() {
    stopTimer();
    setResults(null);
    setBreakdown(null);
    setQuestion(null);
    setShowBreakdown(false);
  }

  /* ---- Filtered templates ---- */

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (typeFilter === "official") return t.type === "official";
      if (typeFilter === "practice" && t.type !== "practice") return false;
      if (levelFilter !== "all" && normalizeLevel(t.level) !== levelFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      return true;
    });
  }, [templates, levelFilter, typeFilter]);

  const uniqueLevels = useMemo(() => {
    const levels = new Set(
      templates.map((t) => normalizeLevel(t.level)).filter(Boolean) as string[]
    );
    return LEVEL_ORDER.filter((l) => levels.has(l));
  }, [templates]);

  /* ---- Format guide labels ---- */

  const formatGuideLabels = useMemo(
    () => ({
      bullet1: labels.formatGuideBullet1,
      bullet2: labels.formatGuideBullet2,
      bullet3: labels.formatGuideBullet3,
      bullet4: labels.formatGuideBullet4,
      bullet5: labels.formatGuideBullet5,
      disclaimer: labels.formatGuideDisclaimer,
      helpLink: labels.formatGuideHelpLink,
      intro: labels.formatGuideIntro,
      officialPartListening: labels.officialPartListening ?? "Part 1: Listening",
      officialPartListeningReading:
        labels.officialPartListeningReading ?? "Part 2: Listening + Reading",
      officialPartReading: labels.officialPartReading ?? "Part 3: Reading",
      officialSection1: labels.officialSection1 ?? labels.formatGuideBullet3,
      officialSection2: labels.officialSection2 ?? labels.formatGuideBullet2,
      officialSection3: labels.officialSection3 ?? labels.formatGuideBullet1,
      officialStatQuestions: labels.officialStatQuestions ?? "80|questions",
      officialStatRanks: labels.officialStatRanks ?? "J5-J1+|ranks",
      officialStatScore: labels.officialStatScore ?? "0-800|score",
      officialStatTime: labels.officialStatTime ?? "~2h|duration",
      officialStrategy1: labels.officialStrategy1 ?? labels.formatGuideBullet1,
      officialStrategy2: labels.officialStrategy2 ?? labels.formatGuideBullet4,
      officialStrategy3: labels.officialStrategy3 ?? labels.formatGuideBullet5,
      officialStrategyTitle: labels.officialStrategyTitle ?? labels.formatGuideHelpLink,
      summary: labels.formatGuideSummary
    }),
    [labels]
  );

  /* ---- Progress ---- */

  const progressCurrent = question?.session
    ? Math.min(question.session.currentQuestionNo ?? 0, question.session.totalQuestions - 1) + 1
    : 0;
  const progressTotal = question?.session?.totalQuestions ?? 0;
  const progressPercent = progressTotal > 0 ? (progressCurrent / progressTotal) * 100 : 0;
  const officialGateVisible =
    typeFilter === "official" &&
    officialStatus !== null &&
    (!officialStatus.enabled ||
      !officialStatus.entitled ||
      officialStatus.availableTemplates === 0);

  /* ---- Render ---- */

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-12 pt-2 sm:px-6 sm:pb-16">
      {/* Header */}
      {showHub && (
        <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-surface shadow-sm">
          <div className="grid gap-5 bg-[radial-gradient(circle_at_88%_12%,rgba(37,99,235,0.16),transparent_32%),linear-gradient(135deg,#ffffff,#f7fbff)] p-5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-accent">
                {labels.eyebrow}
              </p>
              <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-ink sm:text-4xl">
                {labels.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
                {labels.subtitle}
              </p>
            </div>
            <div className="grid min-w-[18rem] grid-cols-2 gap-2">
              {[
                labels.heroPrimaryMetric ?? "80|questions",
                labels.heroSecondaryMetric ?? "0-800|score"
              ].map((item) => {
                const [value, label] = item.split("|");
                return (
                  <div
                    className="rounded-2xl border border-ink/10 bg-white/78 p-3 shadow-sm"
                    key={item}
                  >
                    <p className="text-2xl font-black text-ink">{value}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase text-muted">{label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-sakura/20 bg-sakura/5 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-sakura">{labels.error}</p>
        </div>
      )}

      {/* Resuming session indicator */}
      {resuming && (
        <div className="flex items-center justify-center gap-3 py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm font-medium text-muted">
            {labels.resumingSession ?? "Đang khôi phục bài thi..."}
          </p>
        </div>
      )}

      {/* ========== HUB STATE ========== */}
      {showHub && (
        <>
          {/* Format guide */}
          <BjtFormatGuidePanel labels={formatGuideLabels} locale={locale} />

          {!templatesLoading && templates.length > 0 && (
            <section className="grid gap-3 md:grid-cols-2" aria-label={labels.filterType}>
              <button
                className={`rounded-2xl border p-4 text-left shadow-sm transition hover:bg-paper ${
                  typeFilter === "official"
                    ? "border-amber-300 bg-amber-50"
                    : "border-ink/10 bg-surface"
                }`}
                onClick={() => {
                  setTypeFilter("official");
                  setLevelFilter("all");
                }}
                type="button"
              >
                <p className="text-xs font-black uppercase text-amber-700">
                  {labels.filterTypeOfficial ?? "Chính thức"}
                </p>
                <h2 className="mt-1 text-lg font-black text-ink">
                  {labels.officialModeCardTitle ??
                    labels.templateTypeOfficial ??
                    "Official simulation"}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                  {labels.officialModeCardDescription ?? labels.formatGuideBullet1}
                </p>
              </button>
              <button
                className={`rounded-2xl border p-4 text-left shadow-sm transition hover:bg-paper ${
                  typeFilter !== "official"
                    ? "border-accent/30 bg-accent/5"
                    : "border-ink/10 bg-surface"
                }`}
                onClick={() => setTypeFilter("practice")}
                type="button"
              >
                <p className="text-xs font-black uppercase text-accent">
                  {labels.filterTypeMock ?? "Luyện tập"}
                </p>
                <h2 className="mt-1 text-lg font-black text-ink">
                  {labels.practiceModeCardTitle ??
                    labels.templateTypeMock ??
                    "Target-rank practice"}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                  {labels.practiceModeCardDescription ?? labels.formatGuideBullet5}
                </p>
              </button>
            </section>
          )}

          {/* Filters */}
          {!templatesLoading && templates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Level filter pills */}
              <div
                className={`flex flex-wrap gap-1.5 ${typeFilter === "official" ? "opacity-45" : ""}`}
                aria-disabled={typeFilter === "official"}
              >
                <FilterPill
                  active={levelFilter === "all"}
                  disabled={typeFilter === "official"}
                  label={labels.filterLevelAll ?? labels.filterAll ?? "Tất cả"}
                  onClick={() => setLevelFilter("all")}
                />
                {uniqueLevels.map((lv) => (
                  <FilterPill
                    active={levelFilter === lv}
                    disabled={typeFilter === "official"}
                    key={lv}
                    label={lv.replace("BJT-", "")}
                    onClick={() => setLevelFilter(lv)}
                  />
                ))}
              </div>

              <div className="mx-1 hidden h-5 w-px bg-ink/10 sm:block" />

              {/* Type filter */}
              <div className="flex gap-1.5">
                <FilterPill
                  active={typeFilter === "official"}
                  label={labels.filterTypeOfficial ?? "Chính thức"}
                  onClick={() => {
                    setTypeFilter("official");
                    setLevelFilter("all");
                  }}
                />
                <FilterPill
                  active={typeFilter === "practice"}
                  label={labels.filterTypeMock ?? "Luyện tập"}
                  onClick={() => setTypeFilter("practice")}
                />
                <FilterPill
                  active={typeFilter === "all"}
                  label={labels.filterAll ?? "Tất cả"}
                  onClick={() => setTypeFilter("all")}
                />
              </div>
            </div>
          )}

          {/* Templates loading */}
          {templatesLoading && (
            <div className="space-y-3" aria-busy>
              {[1, 2, 3, 4].map((i) => (
                <div
                  className="h-28 animate-pulse rounded-2xl bg-paper ring-1 ring-ink/5"
                  key={i}
                />
              ))}
              <p className="sr-only">{labels.hubTemplatesLoading}</p>
            </div>
          )}

          {officialGateVisible && officialStatus ? (
            <OfficialSimulationGate
              labels={labels}
              onUpgrade={startOfficialUpgrade}
              referralLink={referralLink}
              status={officialStatus}
            />
          ) : null}

          {/* Empty state */}
          {!templatesLoading &&
            filteredTemplates.length === 0 &&
            !error &&
            !officialGateVisible && (
              <EmptyState
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-bold text-white outline-none ring-offset-2 hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent"
                      href={`/${locale}`}
                    >
                      {labels.emptyCtaHome}
                    </Link>
                    <Link
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/15 bg-surface px-5 text-sm font-bold text-ink outline-none ring-offset-2 hover:bg-paper focus-visible:ring-2 focus-visible:ring-accent"
                      href={`/${locale}/help`}
                    >
                      {labels.emptyCtaHelp}
                    </Link>
                  </div>
                }
                description={labels.emptyPublicDescription}
                title={labels.emptyPublicTitle}
              />
            )}

          {/* Template grid */}
          {!templatesLoading && filteredTemplates.length > 0 && !officialGateVisible && (
            <section aria-labelledby="quiz-templates-heading">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-lg font-bold text-ink" id="quiz-templates-heading">
                  {labels.hubTemplatesHeading}
                </h2>
                <span className="text-xs font-semibold tabular-nums text-muted">
                  {(labels.hubExamCount ?? "{n} đề").replace(
                    "{n}",
                    String(filteredTemplates.length)
                  )}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {filteredTemplates.map((template) => (
                  <ExamCard
                    key={template.id}
                    labels={labels}
                    locale={locale}
                    onStart={(e) => void start(e, template.id)}
                    submitting={submitting}
                    template={template}
                    userId={userId}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ========== QUESTION STATE ========== */}
      {inQuestion && question && (
        <div className="space-y-4">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
                {labels.sessionBadgeActive}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Timer display */}
              {timerSeconds != null && (
                <ExamTimer seconds={timerSeconds} warningLabel={labels.timerWarning} />
              )}
              <span className="text-sm font-bold tabular-nums text-ink">
                {progressCurrent}
                <span className="text-muted"> / {progressTotal}</span>
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/5">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Question card */}
          <QuizQuestionPanel
            labels={labels}
            onAnswer={answer}
            question={question}
            userId={userId}
          />
        </div>
      )}

      {/* ========== RESULTS STATE ========== */}
      {results && (
        <div className="space-y-6">
          <ResultsSummary
            labels={labels}
            onRetry={resetToHub}
            onViewBreakdown={() => setShowBreakdown(true)}
            results={results}
            showBreakdownBtn={!showBreakdown && !breakdownLoading}
          />

          {showBreakdown && breakdownLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="ml-3 text-sm text-muted">{labels.breakdown.loadingText}</span>
            </div>
          )}

          {showBreakdown && breakdown && (
            <QuizResultsBreakdown breakdown={breakdown} labels={labels.breakdown} userId={userId} />
          )}
        </div>
      )}

      {/* Edge: no question available */}
      {question && !question.question && !results && (
        <div className="rounded-2xl border border-ink/10 bg-paper/50 p-6 text-center">
          <p className="text-sm text-muted">{labels.noQuestion}</p>
        </div>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter Pill                                                        */
/* ------------------------------------------------------------------ */

function FilterPill({
  active,
  disabled = false,
  label,
  onClick
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`
        inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold outline-none
        ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-accent
        ${
          active
            ? "bg-ink text-surface shadow-sm"
            : "border border-ink/12 bg-surface text-muted hover:border-ink/25 hover:text-ink"
        }
      `}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Official Simulation Gate                                           */
/* ------------------------------------------------------------------ */

function OfficialSimulationGate({
  labels,
  onUpgrade,
  referralLink,
  status
}: {
  labels: QuizLabels;
  onUpgrade: () => void;
  referralLink: string | null;
  status: OfficialSimulationStatus;
}) {
  const mode = !status.enabled ? "closed" : !status.entitled ? "locked" : "noTemplates";
  const title =
    mode === "closed"
      ? (labels.officialModeClosedTitle ?? "Mô phỏng chính thức đang đóng")
      : mode === "locked"
        ? (labels.officialModeLockedTitle ?? "Mô phỏng chính thức là tính năng trả phí")
        : (labels.officialModeNoTemplatesTitle ?? "Chưa có đề mô phỏng chính thức");
  const description =
    mode === "closed"
      ? (labels.officialModeClosedDescription ??
        "Admin có thể mở lại bằng feature flag khi nội dung và billing đã sẵn sàng.")
      : mode === "locked"
        ? (labels.officialModeLockedDescription ??
          "Nâng cấp gói hoặc mời bạn học qua referral để có thêm quyền truy cập khi chiến dịch mở.")
        : (labels.officialModeNoTemplatesDescription ??
          "Feature đã mở và tài khoản có quyền, nhưng chưa có template official published.");

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-black uppercase text-amber-700">
            {labels.filterTypeOfficial ?? "Mô phỏng chính thức"}
          </p>
          <h2 className="mt-1 text-lg font-black text-ink">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted">{description}</p>
          <p className="mt-2 text-xs font-semibold text-muted">
            {(
              labels.officialModeManageHint ??
              "Trạng thái được kiểm soát từ server: {flag} · quyền: {entitlement} · gói hiện tại: {plan}"
            )
              .replace("{flag}", status.featureFlag)
              .replace("{entitlement}", status.entitlementKey)
              .replace("{plan}", status.planSlug)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {mode === "locked" ? (
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white outline-none ring-offset-2 hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-accent"
              onClick={onUpgrade}
              type="button"
            >
              {labels.officialModeUpgradeCta ?? "Nâng cấp"}
            </button>
          ) : null}
          {referralLink ? (
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-amber-300 bg-white px-5 text-sm font-bold text-ink outline-none ring-offset-2 hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => void navigator.clipboard?.writeText(referralLink)}
              type="button"
            >
              {labels.officialModeInviteCta ?? "Mời bạn học"}
            </button>
          ) : (
            <button
              className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-full border border-ink/10 bg-white/60 px-5 text-sm font-bold text-muted"
              disabled
              type="button"
            >
              {labels.officialModeInviteCta ?? "Mời bạn học"}
            </button>
          )}
        </div>
      </div>
      {referralLink ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-muted">
          {(
            labels.officialModeInviteDescription ??
            "Referral link: {link}. Phần thưởng referral được cộng qua quota/entitlement server-side khi chiến dịch cho phép."
          ).replace("{link}", referralLink)}
        </p>
      ) : (
        <p className="mt-3 rounded-xl border border-ink/10 bg-white/70 px-3 py-2 text-xs font-semibold text-muted">
          {labels.officialModeInviteUnavailable ??
            "Referral link sẽ xuất hiện khi social growth được mở bằng feature flag."}
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Exam Card                                                          */
/* ------------------------------------------------------------------ */

function ExamCard({
  labels,
  locale,
  onStart,
  submitting,
  template,
  userId
}: {
  labels: QuizLabels;
  locale: string;
  onStart: (e: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  template: Template;
  userId: string | null;
}) {
  const title = locale === "ja" && template.titleJa ? template.titleJa : template.titleVi;
  const level = template.level?.replace("BJT-", "") ?? "";
  const levelColor = BAND_COLORS[level] ?? "text-muted";
  const sections = template._count?.sections ?? 0;
  const timeMin = template.timeLimitSeconds
    ? Math.max(1, Math.round(template.timeLimitSeconds / 60))
    : null;
  const typeBadge =
    template.type === "official"
      ? (labels.templateTypeOfficial ?? "Chính thức")
      : (labels.templateTypeMock ?? "Luyện tập");
  const isOfficial = template.type === "official";
  const cardTitle =
    isOfficial && level
      ? title
          .replace(new RegExp(`\\s*${escapeRegExp(level)}\\s*[—-]?\\s*`, "iu"), " ")
          .replace(/\s{2,}/gu, " ")
          .trim()
      : title;
  const targetLabel =
    !isOfficial && level ? (labels.hubMetaLevel ?? "Mức {level}").replace("{level}", level) : null;

  return (
    <form
      className={`
        group relative flex flex-col overflow-hidden rounded-2xl border bg-surface shadow-sm
        transition hover:shadow-md
        ${isOfficial ? "border-amber-200/60" : "border-ink/8"}
      `}
      onSubmit={onStart}
    >
      {/* Top accent bar */}
      <div
        className={`h-1 w-full ${isOfficial ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-accent/60 to-accent/30"}`}
      />

      <div className="flex flex-1 flex-col p-4">
        {/* Level + type badges */}
        <div className="mb-2.5 flex items-center gap-2">
          {targetLabel && (
            <span className={`text-xs font-extrabold tracking-wide ${levelColor}`}>{level}</span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isOfficial ? "bg-amber-50 text-amber-700" : "bg-accent/8 text-accent/70"
            }`}
          >
            {typeBadge}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold leading-snug text-ink group-hover:text-accent">
          {cardTitle}
        </h3>
        {targetLabel ? (
          <p className="mt-1 text-xs font-semibold text-muted">{targetLabel}</p>
        ) : null}

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {(labels.hubMetaSections ?? "{n} phần").replace("{n}", String(sections))}
          </span>
          {timeMin && (
            <span className="inline-flex items-center gap-1">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <circle cx={12} cy={12} r={10} />
                <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {(labels.hubMetaTimed ?? "{n} phút").replace("{n}", String(timeMin))}
            </span>
          )}
          {!timeMin && (
            <span className="inline-flex items-center gap-1 text-leaf">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {labels.hubMetaUntimed}
            </span>
          )}
        </div>

        {/* Description */}
        {template.description?.trim() && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted/80">
            {template.description}
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-auto flex items-center gap-2 pt-4">
          <button
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-ink px-4 text-sm font-bold text-surface outline-none ring-offset-2 transition hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98] disabled:opacity-40 sm:flex-none sm:min-w-[8rem]"
            disabled={!userId || submitting}
            type="submit"
          >
            {submitting ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-surface border-t-transparent" />
            ) : (
              labels.start
            )}
          </button>
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-muted outline-none ring-offset-2 transition hover:bg-paper hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
            href={`/${locale}/quiz/print/${template.id}`}
            target="_blank"
          >
            <svg
              className="mr-1 h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect height={8} rx={1} width={12} x={6} y={14} />
            </svg>
            {labels.printExam}
          </Link>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Question Panel                                                     */
/* ------------------------------------------------------------------ */

export function QuizQuestionPanel({
  labels,
  onAnswer,
  question,
  userId
}: {
  labels: QuizLabels;
  onAnswer: (optionKey: string) => void | Promise<void>;
  question: QuestionPayload;
  userId: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  // Reset selected when question changes
  useEffect(() => {
    setSelected(null);
  }, [question.question?.id]);

  if (!question.question) return null;

  const handleAnswer = (key: string) => {
    if (selected) return;
    setSelected(key);
    setTimeout(() => {
      void onAnswer(key);
    }, 200);
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-ink/8 bg-surface shadow-sm">
      {/* Question header */}
      <div className="border-b border-ink/6 bg-paper/40 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">
            {(labels.questionTitle ?? "Câu {n}").replace(
              "{n}",
              String(
                Math.min(
                  question.session.currentQuestionNo ?? 0,
                  question.session.totalQuestions - 1
                ) + 1
              )
            )}
          </h2>
          <span className="rounded-full bg-accent/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
            {question.question.skillTag}
          </span>
        </div>
      </div>

      {/* Question body */}
      <div className="p-4 sm:p-5">
        {/* Audio player for LC/LR sections */}
        {isAudioSection(question.question.sectionCode) && (
          <BjtAudioPlayer
            audioUrl={question.question.audioUrl}
            audioScript={question.question.audioScript}
            sectionCode={question.question.sectionCode}
            maxPlays={2}
            labels={labels.audio}
          />
        )}

        {/* Question image */}
        {question.question.imageUrl && (
          <div className="mb-4 flex justify-center">
            <img
              src={question.question.imageUrl}
              alt={question.question.imageAlt ?? ""}
              className="max-h-64 max-w-full rounded-lg border border-ink/10 object-contain"
              loading="eager"
            />
          </div>
        )}

        {/* Prompt with reading assist */}
        <div className="mb-5">
          {userId ? (
            <AnnotatedJapaneseText
              analyzePath="/api/reading-assist/analyze"
              analyticsPath="/api/reading-assist/analytics"
              displayMode="hover"
              labels={labels.readingAssist.annotated}
              quizSessionId={question.session.id}
              text={question.question.prompt}
              userId={userId}
            />
          ) : (
            <p className="text-sm leading-relaxed text-ink whitespace-pre-wrap">
              {question.question.prompt}
            </p>
          )}
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2.5">
          {question.question.options.map((option) => {
            const isSelected = selected === option.optionKey;
            return (
              <button
                className={`
                  group/opt relative min-h-12 rounded-xl border px-4 py-3 text-left text-sm
                  font-medium outline-none ring-offset-2 transition-all
                  focus-visible:ring-2 focus-visible:ring-accent
                  ${
                    isSelected
                      ? "border-accent bg-accent/5 text-accent shadow-sm"
                      : "border-ink/10 bg-surface text-ink hover:border-accent/30 hover:bg-accent/[0.03] active:scale-[0.99]"
                  }
                `}
                disabled={Boolean(selected)}
                key={option.optionKey}
                onClick={() => handleAnswer(option.optionKey)}
                type="button"
              >
                <span className="flex items-start gap-3">
                  <span
                    className={`
                      mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center
                      rounded-full text-xs font-bold transition
                      ${
                        isSelected
                          ? "bg-accent text-white"
                          : "border border-ink/15 bg-paper text-muted group-hover/opt:border-accent/30 group-hover/opt:text-accent"
                      }
                    `}
                  >
                    {option.optionKey}
                  </span>
                  <span className="flex-1 leading-relaxed">{option.text}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Results Summary                                                    */
/* ------------------------------------------------------------------ */

function ResultsSummary({
  labels,
  onRetry,
  onViewBreakdown,
  results,
  showBreakdownBtn
}: {
  labels: QuizLabels;
  onRetry: () => void;
  onViewBreakdown: () => void;
  results: SessionPayload;
  showBreakdownBtn: boolean;
}) {
  const accuracy =
    results.totalQuestions > 0
      ? Math.round((results.correctCount / results.totalQuestions) * 100)
      : 0;
  const band = results.estimatedBjtBand ?? "—";
  const score = results.estimatedScore ?? 0;
  const bandColor = BAND_COLORS[band] ?? "text-ink";

  const ringColor =
    accuracy >= 80 ? "stroke-emerald-500" : accuracy >= 50 ? "stroke-amber-500" : "stroke-sakura";
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (accuracy / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Hero result card */}
      <div className="overflow-hidden rounded-2xl border border-ink/8 bg-surface shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-r from-accent via-emerald-400 to-amber-400" />
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <h1 className="text-center text-lg font-extrabold text-ink sm:text-xl">
            {labels.completedTitle}
          </h1>

          {/* Score ring + stats */}
          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
            {/* Circular progress */}
            <div className="relative flex-shrink-0">
              <svg className="h-32 w-32 -rotate-90 sm:h-36 sm:w-36" viewBox="0 0 120 120">
                <circle
                  className="stroke-ink/5"
                  cx={60}
                  cy={60}
                  fill="none"
                  r={54}
                  strokeWidth={8}
                />
                <circle
                  className={`${ringColor} transition-all duration-1000 ease-out`}
                  cx={60}
                  cy={60}
                  fill="none"
                  r={54}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  strokeWidth={8}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold tabular-nums text-ink sm:text-3xl">
                  {accuracy}%
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
                  {labels.correctSummary
                    .replace("{correct}", String(results.correctCount))
                    .replace("{total}", String(results.totalQuestions))}
                </span>
              </div>
            </div>

            {/* Score + Band */}
            <div className="flex gap-6 text-center sm:flex-col sm:gap-4 sm:text-left">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {(labels.scoreLabel ?? "Điểm").replace(":", "").replace(" (thang 800)", "")}
                </p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums text-ink">{score}</p>
                <p className="text-[10px] text-muted">{labels.totalScore ?? "/ 800"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {labels.bandLabel}
                </p>
                <p className={`mt-1 text-3xl font-extrabold ${bandColor}`}>{band}</p>
              </div>
            </div>
          </div>

          {/* Coach message */}
          <div className="mx-auto mt-6 max-w-lg rounded-xl bg-paper/70 px-4 py-3 text-center">
            <p className="text-sm leading-relaxed text-ink/80">
              {coachForBand(results.estimatedBjtBand, labels)}
            </p>
          </div>

          {/* Caveat */}
          <p className="mt-3 text-center text-[11px] text-muted">{labels.estimatedScoreCaveat}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3 border-t border-ink/6 bg-paper/30 px-5 py-4">
          {showBreakdownBtn && (
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-bold text-surface outline-none ring-offset-2 transition hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
              onClick={onViewBreakdown}
              type="button"
            >
              {labels.viewBreakdown ?? "Xem chi tiết"}
            </button>
          )}
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/12 bg-surface px-5 text-sm font-bold text-ink outline-none ring-offset-2 transition hover:bg-paper focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
            onClick={onRetry}
            type="button"
          >
            {labels.retryQuiz ?? "Làm bài khác"}
          </button>
        </div>
      </div>

      {/* Encouragement note */}
      <p className="text-center text-xs text-muted">{labels.anotherRound}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exam Timer                                                         */
/* ------------------------------------------------------------------ */

function ExamTimer({ seconds, warningLabel }: { seconds: number; warningLabel?: string }) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isWarning = seconds <= 60;
  const isCritical = seconds <= 30;

  return (
    <div
      aria-label={warningLabel ?? "Thời gian còn lại"}
      aria-live="polite"
      className={`
        inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold tabular-nums
        ${
          isCritical
            ? "animate-pulse bg-sakura/15 text-sakura"
            : isWarning
              ? "bg-amber-100 text-amber-700"
              : "bg-ink/5 text-ink"
        }
      `}
      role="timer"
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <circle cx={12} cy={12} r={10} />
        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </div>
  );
}
