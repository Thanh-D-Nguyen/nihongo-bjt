"use client";

import {
  Badge,
  ErrorState,
  PageHeader,
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  cancelJapaneseSpeech,
  speakJapanese
} from "../../../../lib/japanese-speech";
import { learnerApiFetch } from "../../../../lib/learner-api";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Exercise {
  id: string;
  exerciseType: string;
  prompt: Record<string, unknown>;
  choices: Array<{ key: string; text: string }>;
  correctAnswer: Record<string, unknown>;
  explanation: string | null;
  level: string | null;
}

interface Session {
  id: string;
  status: string;
  totalQuestions: number;
  correctCount: number;
  score: number;
}

interface AnswerResult {
  isCorrect: boolean;
  correctAnswer: Record<string, unknown>;
  explanation: string | null;
}

type Phase = "setup" | "practicing" | "review" | "completed";

export interface ExercisesLabels {
  title: string;
  eyebrow: string;
  subtitle: string;
  generate: string;
  startSession: string;
  submitAnswer: string;
  nextQuestion: string;
  completeSession: string;
  correct: string;
  incorrect: string;
  score: string;
  history: string;
  noExercises: string;
  sessionComplete: string;
  types: Record<string, string>;
  levels: Record<string, string>;
  filterType: string;
  filterLevel: string;
  questionOf: string;
  timeSpent: string;
  error: string;
  recommended?: string;
  recommendedEmpty?: string;
  browseAll?: string;
  filters?: {
    all: string;
    recommended: string;
    listening: string;
    reading: string;
    grammar: string;
    vocabulary: string;
    keigo: string;
  };
  card?: {
    questions: string;
    duration: string;
    level: string;
    difficulty: string;
    recommended: string;
    weakArea: string;
    continue: string;
  };
  empty?: {
    noResults: string;
    clearFilters: string;
    loading: string;
  };
  review?: {
    title: string;
    back: string;
    notFound: string;
    correctAnswer: string;
    ratingPrompt: string;
    again: string;
    hard: string;
    good: string;
    easy: string;
    recorded: string;
    next: string;
    complete: string;
  };
  completed?: {
    goalComplete: string;
    todayProgress: string;
  };
}

interface StudyFeedItem {
  id: string;
  type: string;
  title: string | null;
  score: number;
  source: string;
  metadata: Record<string, string> | null;
}

const EXERCISE_TYPES = ["meaning_match", "cloze", "word_order", "translation", "listening"] as const;
const LEVELS = ["all", "N5", "N4", "N3", "N2", "N1"] as const;

const EXERCISE_TYPE_ICONS: Record<string, string> = {
  meaning_match: "🔗",
  cloze: "✏️",
  word_order: "🧩",
  translation: "🌐",
  listening: "🎧",
};
const EXERCISE_TYPE_HINTS: Record<string, string> = {
  meaning_match: "Chọn nghĩa đúng cho từ",
  cloze: "Điền từ còn thiếu vào câu",
  word_order: "Sắp xếp từ thành câu",
  translation: "Dịch câu sang tiếng Việt",
  listening: "Nghe và chọn đáp án đúng",
};

/* ── Component ─────────────────────────────────────────────────────────── */

export function ExercisesPageClient({
  labels,
  locale: _locale
}: {
  labels: ExercisesLabels;
  locale: string;
}) {
  void _locale;

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedType, setSelectedType] = useState<string>("meaning_match");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [dailyProgress, setDailyProgress] = useState<{ completed: number; goal: number; progress: number; isComplete: boolean } | null>(null);
  const [dueCount, setDueCount] = useState<number>(0);
  const [reviewItems, setReviewItems] = useState<Array<{ exerciseId: string; exercise: Exercise | null }>>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewRated, setReviewRated] = useState(false);
  const [studyFeed, setStudyFeed] = useState<StudyFeedItem[]>([]);
  const [studyFeedLoading, setStudyFeedLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  /* ── Fetch daily progress + due reviews + study feed on mount ────────── */

  useEffect(() => {
    learnerApiFetch("/api/exercises/daily-progress")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setDailyProgress(d); })
      .catch(() => {});

    learnerApiFetch("/api/exercises/review/due?limit=50")
      .then((r) => r.ok ? r.json() : [])
      .then((items) => { if (Array.isArray(items)) setDueCount(items.length); })
      .catch(() => {});

    // Fetch personalized recommendations
    setStudyFeedLoading(true);
    learnerApiFetch("/api/recommendation/study-feed?limit=6")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && Array.isArray(data.items)) {
          setStudyFeed(data.items.filter((i: StudyFeedItem) => i.type === "exercise"));
        }
      })
      .catch(() => {})
      .finally(() => setStudyFeedLoading(false));
  }, []);

  /* ── Start review mode ───────────────────────────────────────────────── */

  const handleStartReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await learnerApiFetch("/api/exercises/review/due?limit=20");
      if (!res.ok) throw new Error("Failed to load reviews");
      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) return;
      setReviewItems(items);
      setReviewIndex(0);
      setReviewRated(false);
      setPhase("review");
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [labels.error]);

  /* ── Submit SRS rating ───────────────────────────────────────────────── */

  const handleSrsRating = useCallback(async (rating: string) => {
    const item = reviewItems[reviewIndex];
    if (!item) return;
    try {
      await learnerApiFetch(`/api/exercises/review/${item.exerciseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating })
      });
      setReviewRated(true);
    } catch {
      setError(labels.error);
    }
  }, [reviewItems, reviewIndex, labels.error]);

  const handleNextReview = useCallback(() => {
    if (reviewIndex >= reviewItems.length - 1) {
      setPhase("setup");
      setReviewItems([]);
      // Refresh due count
      learnerApiFetch("/api/exercises/review/due?limit=50")
        .then((r) => r.ok ? r.json() : [])
        .then((items) => { if (Array.isArray(items)) setDueCount(items.length); })
        .catch(() => {});
      return;
    }
    setReviewIndex((i) => i + 1);
    setReviewRated(false);
  }, [reviewIndex, reviewItems.length]);

  /* ── Generate exercises ──────────────────────────────────────────────── */

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: selectedType, count: "10" });
      if (selectedLevel !== "all") params.set("level", selectedLevel);

      const res = await learnerApiFetch(`/api/exercises/generate?${params}`);
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json();
      setExercises(data);

      // Start session
      const sessionRes = await learnerApiFetch("/api/exercises/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType: "practice_tab",
          exerciseType: selectedType,
          level: selectedLevel !== "all" ? selectedLevel : undefined
        })
      });
      if (!sessionRes.ok) throw new Error("Failed to start session");
      const sessionData = await sessionRes.json();
      setSession(sessionData);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setStartTime(Date.now());
      setPhase("practicing");
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedLevel, labels.error]);

  /* ── Submit answer ───────────────────────────────────────────────────── */

  const handleSubmit = useCallback(async () => {
    if (!session || !selectedAnswer || answerResult) return;
    const exercise = exercises[currentIndex];
    if (!exercise) return;

    const timeSpentMs = Date.now() - startTime;

    try {
      const res = await learnerApiFetch(`/api/exercises/sessions/${session.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: exercise.id,
          userAnswer: exercise.exerciseType === "word_order"
            ? { orderedTokens: selectedAnswer.split(",") }
            : { key: selectedAnswer },
          timeSpentMs
        })
      });
      if (!res.ok) throw new Error("Failed to submit");
      const result = await res.json();
      setAnswerResult(result);
    } catch {
      setError(labels.error);
    }
  }, [session, selectedAnswer, answerResult, exercises, currentIndex, startTime, labels.error]);

  /* ── Next question / Complete ────────────────────────────────────────── */

  const handleNext = useCallback(async () => {
    if (currentIndex >= exercises.length - 1) {
      // Complete session
      if (!session) return;
      try {
        const res = await learnerApiFetch(`/api/exercises/sessions/${session.id}/complete`, {
          method: "POST"
        });
        if (!res.ok) throw new Error("Failed to complete");
        const data = await res.json();
        setSession(data);
        setPhase("completed");
        // Refresh daily progress
        learnerApiFetch("/api/exercises/daily-progress")
          .then((r) => r.ok ? r.json() : null)
          .then((d) => { if (d) setDailyProgress(d); })
          .catch(() => {});
      } catch {
        setError(labels.error);
      }
      return;
    }

    setCurrentIndex((i) => i + 1);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setStartTime(Date.now());
  }, [currentIndex, exercises.length, session, labels.error]);

  /* ── Render ──────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-5">
        <PageHeader eyebrow={labels.eyebrow} title={labels.title} />
        <div className="mt-6 space-y-4" aria-busy="true">
          {/* Shimmer skeletons matching setup layout */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`exercise-skeleton rounded-2xl border border-ink/5 p-5 ${i === 0 ? "sm:col-span-2 lg:col-span-1" : ""}`}>
                <div className="exercise-skeleton-shimmer mb-3 h-10 w-10 rounded-xl" />
                <div className="exercise-skeleton-shimmer mb-2 h-4 w-20 rounded" />
                <div className="exercise-skeleton-shimmer h-3 w-28 rounded" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="exercise-skeleton-shimmer h-10 w-14 rounded-lg" />
            ))}
          </div>
          <div className="exercise-skeleton-shimmer h-12 w-40 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-5">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.subtitle} />

      {error && (
        <div className="my-4">
          <ErrorState title={error} action={
            <button className="rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-paper" onClick={() => setError(null)} type="button">OK</button>
          } />
        </div>
      )}

      {/* ── Setup Phase ──────────────────────────────────────────────── */}
      {phase === "setup" && (
        <div className="mt-6 space-y-8">
          {/* Recommended for You — from /api/recommendation/study-feed */}
          <div>
            <h2 className="text-h3 text-ink">{labels.recommended ?? "Recommended for you"}</h2>
            {studyFeedLoading ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
                ))}
              </div>
            ) : studyFeed.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {studyFeed.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      // Start practice with recommended exercise type if available
                      const metaType = item.metadata?.exerciseType as string | undefined;
                      if (metaType && EXERCISE_TYPES.includes(metaType as typeof EXERCISE_TYPES[number])) {
                        setSelectedType(metaType as typeof EXERCISE_TYPES[number]);
                      }
                      handleGenerate();
                    }}
                    className="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-xs transition-all hover:border-[var(--color-border-hover)] hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-body font-bold text-ink line-clamp-2">
                        {item.title ?? labels.types[item.metadata?.exerciseType ?? ""] ?? item.type}
                      </h3>
                      <span className="shrink-0 rounded-md bg-[var(--color-navy)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--color-navy)]">
                        {labels.card?.recommended ?? "Recommended"}
                      </span>
                    </div>
                    {item.metadata?.level && (
                      <p className="mt-2 text-xs font-semibold text-muted">
                        {labels.card?.level?.replace("{level}", item.metadata.level) ?? `Level ${item.metadata.level}`}
                      </p>
                    )}
                    {item.metadata?.difficulty && (
                      <p className="mt-1 text-[11px] text-muted">
                        {labels.card?.difficulty?.replace("{difficulty}", item.metadata.difficulty) ?? item.metadata.difficulty}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-body-sm text-muted">
                {labels.recommendedEmpty ?? "No personalized recommendations yet. Complete a practice session to get tailored suggestions."}
              </p>
            )}
          </div>

          {/* Due Reviews banner */}
          {dueCount > 0 && (
            <button
              type="button"
              onClick={handleStartReview}
              className="flex w-full items-center gap-3 overflow-hidden rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/60 to-orange-50/30 p-4 text-left shadow-sm transition hover:border-amber-300/60 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-lg" aria-hidden>🔄</span>
              <div>
                <p className="text-sm font-bold text-ink">{labels.card?.continue ?? "Continue"} — Review</p>
                <p className="text-xs font-semibold text-muted">
                  {dueCount} {labels.card?.questions?.replace("{count}", String(dueCount)) ?? `${dueCount} items due`}
                </p>
              </div>
            </button>
          )}

          {/* Daily Progress */}
          {dailyProgress && (
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-overline text-muted">Daily Goal</span>
                {dailyProgress.isComplete && (
                  <span className="rounded-full bg-[var(--color-leaf)]/12 px-2.5 py-0.5 text-xs font-bold text-[var(--color-leaf)]">✓</span>
                )}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
                {dailyProgress.completed}<span className="text-base font-medium text-muted">/{dailyProgress.goal}</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                <div
                  className="h-full rounded-full bg-[var(--color-navy)] transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(dailyProgress.progress * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Filter chips — skill/type filters backed by real exercise types */}
          <div>
            <div className="flex flex-wrap gap-2">
              {(["all", "listening", "reading", "grammar", "vocabulary", "keigo"] as const).map((f) => {
                const active = activeFilter === f;
                const labelKey = f as keyof NonNullable<ExercisesLabels["filters"]>;
                const chipLabel = labels.filters?.[labelKey] ?? f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setActiveFilter(f)}
                    className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)] ${
                      active
                        ? "bg-[var(--color-navy)] text-white shadow-sm"
                        : "bg-[var(--color-paper)] text-muted hover:bg-[var(--color-border)] hover:text-ink"
                    }`}
                  >
                    {chipLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Browse All — Type filter bento cards */}
          <div>
            <h2 className="text-h3 text-ink">{labels.browseAll ?? "Browse all exercises"}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {EXERCISE_TYPES.map((t) => {
                const active = selectedType === t;
                return (
                  <button
                    key={t}
                    className={`exercise-type-card group relative overflow-hidden rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)] ${
                      active
                        ? "border-[var(--color-navy)]/30 bg-[var(--color-navy)]/5 shadow-md ring-1 ring-[var(--color-navy)]/15"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-hover)] hover:shadow-sm"
                    }`}
                    onClick={() => setSelectedType(t)}
                    type="button"
                  >
                    <span className={`grid h-10 w-10 place-items-center rounded-xl text-lg transition-colors ${
                      active
                        ? "bg-[var(--color-navy)]/12 shadow-sm"
                        : "bg-[var(--color-paper)] group-hover:bg-[var(--color-border)]"
                    }`} aria-hidden>
                      {EXERCISE_TYPE_ICONS[t]}
                    </span>
                    <span className="mt-3 block text-sm font-bold text-ink">
                      {labels.types[t] ?? t}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-medium text-muted">
                      {EXERCISE_TYPE_HINTS[t]}
                    </span>
                    {active ? (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-navy)] text-[10px] text-white" aria-hidden>✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Level filter — pill buttons */}
          <div>
            <p className="mb-3 text-overline text-muted">
              {labels.filterLevel}
            </p>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => {
                const active = selectedLevel === l;
                return (
                  <button
                    key={l}
                    className={`exercise-level-pill min-h-[40px] rounded-xl px-4 py-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-navy)] ${
                      active
                        ? "bg-[var(--color-navy)] text-white shadow-sm"
                        : "bg-[var(--color-paper)] text-muted hover:bg-[var(--color-border)] hover:text-ink"
                    }`}
                    onClick={() => setSelectedLevel(l)}
                    type="button"
                  >
                    {labels.levels[l] ?? l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start CTA */}
          <button
            className="flex min-h-12 items-center gap-2.5 rounded-xl bg-gradient-to-r from-accent to-blue-600 px-6 text-sm font-black text-white shadow-md shadow-accent/20 transition hover:shadow-lg hover:shadow-accent/25 active:scale-[0.98]"
            onClick={handleGenerate}
            type="button"
          >
            <span aria-hidden>📝</span>
            {labels.generate}
          </button>
        </div>
      )}

      {/* ── Review Phase (SRS) ───────────────────────────────────────── */}
      {phase === "review" && reviewItems.length > 0 && (
        <div className="mt-6 space-y-5">
          {/* Review progress */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black tabular-nums text-amber-700 shadow-sm">
                {reviewIndex + 1}/{reviewItems.length}
              </span>
              <span className="text-sm font-bold text-muted">{labels.review?.title ?? "Review"}</span>
            </div>
            <button
              type="button"
              className="text-xs font-bold text-muted hover:text-ink"
              onClick={() => { setPhase("setup"); setReviewItems([]); }}
            >
              {labels.review?.back ?? "← Back"}
            </button>
          </div>

          {/* Review progress bar */}
          <div className="h-2 overflow-hidden rounded-full bg-amber-100/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
              style={{ width: `${((reviewIndex + 1) / reviewItems.length) * 100}%` }}
            />
          </div>

          {/* Review card */}
          {(() => {
            const item = reviewItems[reviewIndex];
            const ex = item?.exercise as Exercise | null;
            if (!ex) return <p className="text-sm text-muted">{labels.review?.notFound ?? "Exercise not found."}</p>;

            return (
              <div className="overflow-hidden rounded-[1.5rem] border border-amber-200/40 bg-white shadow-sm">
                <div className="border-b border-amber-100 bg-gradient-to-b from-amber-50/40 to-white p-5 sm:p-6">
                  <Badge className="mb-3 gap-1.5 border-amber-200 bg-amber-50 text-amber-700">
                    <span aria-hidden>{EXERCISE_TYPE_ICONS[ex.exerciseType]}</span>
                    {labels.types[ex.exerciseType] ?? ex.exerciseType}
                  </Badge>
                  <p className="text-lg font-bold text-ink" style={{ lineHeight: 1.8 }}>
                    {String((ex.prompt as Record<string, unknown>).text ?? (ex.prompt as Record<string, unknown>).maskedSentence ?? (ex.prompt as Record<string, unknown>).japaneseSentence ?? "")}
                  </p>
                  {typeof (ex.prompt as Record<string, unknown>).reading === "string" && (
                    <p className="mt-1.5 text-sm font-semibold text-muted">{String((ex.prompt as Record<string, unknown>).reading)}</p>
                  )}
                </div>

                <div className="p-5 sm:p-6">
                  {/* Show correct answer */}
                  <div className="rounded-xl border border-leaf/15 bg-leaf/5 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-leaf">{labels.review?.correctAnswer ?? "Correct answer"}</p>
                    <p className="mt-1 text-sm font-bold text-ink">
                      {ex.choices?.find((c) => c.key === (ex.correctAnswer as Record<string, string>)?.key)?.text
                        ?? JSON.stringify(ex.correctAnswer)}
                    </p>
                    {ex.explanation && (
                      <p className="mt-2 text-sm text-muted">{ex.explanation}</p>
                    )}
                  </div>

                  {/* SRS Rating buttons */}
                  {!reviewRated ? (
                    <div className="mt-5">
                      <p className="mb-3 text-xs font-black uppercase tracking-wider text-muted">{labels.review?.ratingPrompt ?? "How well do you remember?"}</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {([
                          { key: "again" as const, color: "border-sakura/30 bg-sakura/8 text-sakura hover:bg-sakura/15" },
                          { key: "hard" as const, color: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
                          { key: "good" as const, color: "border-leaf/20 bg-leaf/8 text-leaf hover:bg-leaf/15" },
                          { key: "easy" as const, color: "border-accent/20 bg-accent/8 text-accent hover:bg-accent/15" },
                        ]).map((r) => (
                          <button
                            key={r.key}
                            type="button"
                            className={`min-h-11 rounded-xl border px-4 py-2.5 text-sm font-black transition ${r.color} active:scale-[0.97]`}
                            onClick={() => handleSrsRating(r.key)}
                          >
                            {labels.review?.[r.key] ?? r.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-sm font-bold text-leaf">{labels.review?.recorded ?? "✓ Recorded"}</span>
                      <button
                        type="button"
                        className="flex min-h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-black text-surface shadow-sm transition hover:bg-ink/90 active:scale-[0.98]"
                        onClick={handleNextReview}
                      >
                        {reviewIndex >= reviewItems.length - 1 ? (labels.review?.complete ?? "Complete") : (labels.review?.next ?? "Next")}
                        <span aria-hidden>→</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Practicing Phase ─────────────────────────────────────────── */}
      {phase === "practicing" && exercises.length > 0 && (
        <div className="mt-6 space-y-5">
          {/* Progress header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg border border-ink/10 bg-white px-2.5 py-1 text-xs font-black tabular-nums text-ink shadow-sm">
                {currentIndex + 1}/{exercises.length}
              </span>
              <span className="text-sm font-bold text-muted">
                {labels.questionOf
                  .replace("{current}", String(currentIndex + 1))
                  .replace("{total}", String(exercises.length))}
              </span>
            </div>
            <Badge className="gap-1.5 px-2.5">
              <span aria-hidden>{EXERCISE_TYPE_ICONS[selectedType]}</span>
              {labels.types[selectedType] ?? selectedType}
            </Badge>
          </div>

          {/* Progress bar — animated fill */}
          <div className="h-2 overflow-hidden rounded-full bg-ink/8">
            <div
              className="exercise-progress-fill h-full rounded-full bg-gradient-to-r from-accent to-blue-500"
              style={{ width: `${((currentIndex + 1) / exercises.length) * 100}%` }}
            />
          </div>

          {/* Question card */}
          <ExerciseCard
            exercise={exercises[currentIndex]}
            labels={labels}
            selectedAnswer={selectedAnswer}
            answerResult={answerResult}
            onSelect={setSelectedAnswer}
            onSubmit={handleSubmit}
            onNext={handleNext}
            isLast={currentIndex >= exercises.length - 1}
          />
        </div>
      )}

      {/* ── Completed Phase ──────────────────────────────────────────── */}
      {phase === "completed" && session && (
        <div className="mt-6">
          <div className="exercise-complete-card relative overflow-hidden rounded-[1.5rem] border border-accent/15 bg-gradient-to-br from-accent/5 via-surface to-blue-50/40 p-8 text-center shadow-sm">
            {/* Decorative glow */}
            <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-64 -translate-x-1/2 rounded-full bg-accent/8 blur-3xl" aria-hidden />

            <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-accent/15 to-blue-100/60 text-3xl shadow-sm" aria-hidden>
              🎉
            </span>
            <h2 className="relative mt-4 text-2xl font-black tracking-tight text-ink">
              {labels.sessionComplete}
            </h2>

            {/* Score bento */}
            <div className="relative mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
              <div className="rounded-2xl border border-leaf/15 bg-white/80 p-4 shadow-sm">
                <p className="text-3xl font-black tabular-nums text-leaf">
                  {session.correctCount}
                </p>
                <p className="mt-1 text-xs font-bold text-muted">
                  / {session.totalQuestions} {labels.correct.replace("!", "")}
                </p>
              </div>
              <div className="rounded-2xl border border-accent/15 bg-white/80 p-4 shadow-sm">
                <p className="text-3xl font-black tabular-nums text-accent">
                  {session.score}
                </p>
                <p className="mt-1 text-xs font-bold text-muted">{labels.score}</p>
              </div>
            </div>

            {/* Accuracy bar */}
            <div className="relative mx-auto mt-5 max-w-sm">
              <div className="h-3 overflow-hidden rounded-full bg-ink/6">
                <div
                  className="exercise-progress-fill h-full rounded-full bg-gradient-to-r from-leaf to-emerald-400"
                  style={{ width: `${session.totalQuestions > 0 ? (session.correctCount / session.totalQuestions) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] font-bold tabular-nums text-muted">
                {session.totalQuestions > 0
                  ? `${Math.round((session.correctCount / session.totalQuestions) * 100)}%`
                  : "0%"}
              </p>
            </div>

            <div className="relative mt-6">
              <button
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-blue-600 px-6 text-sm font-black text-white shadow-md shadow-accent/20 transition hover:shadow-lg active:scale-[0.98]"
                onClick={() => {
                  setPhase("setup");
                  setExercises([]);
                  setSession(null);
                }}
                type="button"
              >
                <span aria-hidden>🔄</span>
                {labels.generate}
              </button>
            </div>

            {/* Daily goal completion celebration */}
            {dailyProgress?.isComplete && (
              <div className="exercise-goal-complete relative mt-6 rounded-2xl border border-leaf/20 bg-gradient-to-r from-leaf/8 to-emerald-50/60 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf/15 text-xl" aria-hidden>🏆</span>
                  <div className="text-left">
                    <p className="text-sm font-black text-leaf">{labels.completed?.goalComplete ?? "Goal complete!"}</p>
                    <p className="text-xs font-semibold text-muted">{labels.completed?.todayProgress?.replace("{completed}", String(dailyProgress.completed)).replace("{goal}", String(dailyProgress.goal)) ?? `${dailyProgress.completed}/${dailyProgress.goal} exercises today`}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Exercise Card ─────────────────────────────────────────────────────── */

function ExerciseCard({
  exercise,
  labels,
  selectedAnswer,
  answerResult,
  onSelect,
  onSubmit,
  onNext,
  isLast
}: {
  exercise: Exercise;
  labels: ExercisesLabels;
  selectedAnswer: string | null;
  answerResult: AnswerResult | null;
  onSelect: (key: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const prompt = exercise.prompt;
  const isWordOrder = exercise.exerciseType === "word_order";

  return (
    <div className="exercise-question-card overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white shadow-sm">
      {/* Prompt */}
      <div className="border-b border-ink/8 bg-gradient-to-b from-paper/60 to-white p-5 sm:p-6">
        {prompt.maskedSentence ? (
          <div>
            <p className="text-lg font-bold leading-8 text-ink" style={{ lineHeight: 1.8 }}>
              {String(prompt.maskedSentence as string)}
            </p>
            {prompt.hint ? (
              <p className="mt-2 text-sm font-semibold text-muted">{String(prompt.hint as string)}</p>
            ) : null}
          </div>
        ) : prompt.japaneseSentence ? (
          <div>
            <p className="text-lg font-bold leading-8 text-ink" style={{ lineHeight: 1.8 }}>
              {String(prompt.japaneseSentence as string)}
            </p>
            {prompt.reading ? (
              <p className="mt-1.5 text-sm font-semibold text-muted">{String(prompt.reading as string)}</p>
            ) : null}
          </div>
        ) : isWordOrder ? (
          <div>
            <p className="mb-3 text-sm font-bold text-muted">
              {String((prompt.hint as string) ?? "")}
            </p>
            <WordOrderInput
              tokens={prompt.shuffledTokens as string[]}
              onSelect={onSelect}
              disabled={!!answerResult}
            />
          </div>
        ) : (
          <div>
            <p className="text-xl font-black text-ink" style={{ lineHeight: 1.8 }}>
              {String((prompt.text as string) ?? "")}
            </p>
            {prompt.reading ? (
              <p className="mt-1.5 text-sm font-semibold text-muted">{String(prompt.reading as string)}</p>
            ) : null}
          </div>
        )}

        {/* TTS Audio Player for listening exercises */}
        {exercise.exerciseType === "listening" && typeof prompt.audioUrl === "string" && (
          <TtsPlayer audioUrl={prompt.audioUrl} />
        )}
      </div>

      <div className="p-5 sm:p-6">
        {/* Multiple choice options */}
        {!isWordOrder && Array.isArray(exercise.choices) && (
          <div className="space-y-2.5">
            {exercise.choices.map((choice) => {
              const isSelected = selectedAnswer === choice.key;
              const isCorrectChoice = answerResult && (answerResult.correctAnswer as Record<string, string>).key === choice.key;
              const isWrong = answerResult && isSelected && !answerResult.isCorrect;

              return (
                <button
                  key={choice.key}
                  className={`exercise-answer-btn group flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left text-sm font-bold leading-6 ${
                    answerResult
                      ? isCorrectChoice
                        ? "exercise-answer-correct border-leaf/30 bg-leaf-soft text-leaf shadow-sm shadow-leaf/10"
                        : isWrong
                          ? "exercise-answer-wrong border-sakura/30 bg-sakura-soft text-sakura"
                          : "border-transparent bg-paper/60 text-ink/50"
                      : isSelected
                        ? "border-accent/30 bg-accent/8 text-ink shadow-sm shadow-accent/10"
                        : "border-transparent bg-paper/70 text-ink hover:border-ink/10 hover:bg-paper"
                  }`}
                  disabled={!!answerResult}
                  onClick={() => onSelect(choice.key)}
                  type="button"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black transition-colors ${
                    answerResult
                      ? isCorrectChoice
                        ? "bg-leaf/15 text-leaf"
                        : isWrong
                          ? "bg-sakura/15 text-sakura"
                          : "bg-ink/5 text-ink/40"
                      : isSelected
                        ? "bg-accent/12 text-accent"
                        : "bg-ink/[0.04] text-muted group-hover:bg-ink/[0.06]"
                  }`}>
                    {choice.key}
                  </span>
                  <span className="min-w-0 flex-1">{choice.text}</span>
                  {isCorrectChoice ? (
                    <span className="shrink-0 text-leaf" aria-hidden>✓</span>
                  ) : isWrong ? (
                    <span className="shrink-0 text-sakura" aria-hidden>✗</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {/* Feedback */}
        {answerResult && (
          <div
            className={`exercise-feedback mt-5 flex items-start gap-3 rounded-xl border p-4 ${
              answerResult.isCorrect
                ? "border-leaf/20 bg-gradient-to-r from-leaf/8 to-emerald-50/50 text-leaf"
                : "border-sakura/20 bg-gradient-to-r from-sakura/8 to-red-50/50 text-sakura"
            }`}
          >
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/80 text-sm shadow-sm" aria-hidden>
              {answerResult.isCorrect ? "✅" : "💡"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black">
                {answerResult.isCorrect ? labels.correct : labels.incorrect}
              </p>
              {answerResult.explanation && (
                <p className="mt-1.5 whitespace-pre-line text-sm font-semibold leading-relaxed text-ink/70">
                  {answerResult.explanation}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex justify-end gap-3">
          {!answerResult && (
            <button
              className="flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-blue-600 px-5 text-sm font-black text-white shadow-md shadow-accent/15 transition hover:shadow-lg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
              onClick={onSubmit}
              disabled={!selectedAnswer}
              type="button"
            >
              {labels.submitAnswer}
            </button>
          )}
          {answerResult && (
            <button
              className="exercise-next-btn flex min-h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-black text-surface shadow-sm transition hover:bg-ink/90 active:scale-[0.98]"
              onClick={onNext}
              type="button"
            >
              {isLast ? labels.completeSession : labels.nextQuestion}
              <span aria-hidden>→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Word Order Input ──────────────────────────────────────────────────── */

function WordOrderInput({
  tokens,
  onSelect,
  disabled
}: {
  tokens: string[];
  onSelect: (val: string) => void;
  disabled: boolean;
}) {
  const [ordered, setOrdered] = useState<string[]>([]);
  const remaining = tokens.filter((t) => !ordered.includes(t));

  useEffect(() => {
    setOrdered([]);
  }, [tokens]);

  useEffect(() => {
    if (ordered.length > 0) {
      onSelect(ordered.join(","));
    }
  }, [ordered, onSelect]);

  const addToken = (token: string) => {
    if (disabled) return;
    setOrdered((prev) => [...prev, token]);
  };

  const removeToken = (index: number) => {
    if (disabled) return;
    setOrdered((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Constructed sentence */}
      <div className="flex min-h-[52px] flex-wrap gap-2 rounded-xl border-2 border-dashed border-accent/25 bg-accent/[0.03] p-3.5">
        {ordered.map((token, i) => (
          <button
            key={`${token}-${i}`}
            className="exercise-word-token rounded-lg bg-accent/12 px-3.5 py-2 text-sm font-bold text-accent shadow-sm transition hover:bg-accent/18 active:scale-95"
            onClick={() => removeToken(i)}
            disabled={disabled}
          >
            {token}
          </button>
        ))}
        {ordered.length === 0 && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <span aria-hidden>↓</span>
            タップして文を組み立てる
          </span>
        )}
      </div>

      {/* Available tokens */}
      <div className="flex flex-wrap gap-2">
        {remaining.map((token, i) => (
          <button
            key={`${token}-${i}`}
            className="exercise-word-token rounded-lg border border-ink/10 bg-white px-3.5 py-2 text-sm font-bold text-ink shadow-sm transition hover:border-accent/20 hover:bg-paper active:scale-95"
            onClick={() => addToken(token)}
            disabled={disabled}
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── TTS Player ────────────────────────────────────────────────────────── */

function TtsPlayer({ audioUrl }: { audioUrl: string }) {
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(() => {
    // Parse tts:// URL: tts://speak?text=...&lang=ja-JP&rate=0.85
    let text: string;
    let lang = "ja-JP";
    let rate = 0.85;

    try {
      const url = new URL(audioUrl);
      text = url.searchParams.get("text") ?? "";
      lang = url.searchParams.get("lang") ?? "ja-JP";
      rate = parseFloat(url.searchParams.get("rate") ?? "0.85");
    } catch {
      // Fallback: treat entire URL as text
      text = audioUrl;
    }

    if (!text) return;

    const utt = speakJapanese(text, {
      lang,
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
      onStart: () => setSpeaking(true),
      rate
    });
    if (!utt) return;
    utteranceRef.current = utt;
  }, [audioUrl]);

  const stop = useCallback(() => {
    cancelJapaneseSpeech();
    setSpeaking(false);
  }, []);

  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        className={`group flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-black transition-all ${
          speaking
            ? "bg-accent/12 text-accent shadow-sm"
            : "bg-ink/[0.04] text-ink hover:bg-accent/8 hover:text-accent"
        }`}
        onClick={speaking ? stop : speak}
      >
        <span className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
          speaking ? "bg-accent/15 text-accent" : "bg-ink/[0.06] group-hover:bg-accent/12"
        }`} aria-hidden>
          {speaking ? "⏸" : "🔊"}
        </span>
        {speaking ? "Đang phát..." : "Nghe"}
      </button>
      {speaking && (
        <div className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="inline-block w-1 rounded-full bg-accent/60"
              style={{
                height: `${12 + Math.sin(i * 1.2) * 6}px`,
                animation: `tts-wave 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
