"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import enMessages from "../../../../messages/en.json";
import jaMessages from "../../../../messages/ja.json";
import viMessages from "../../../../messages/vi.json";
import { useGoAuth } from "../../../../lib/go-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

interface RevengeQuestion {
  questionId: string;
  prompt: string;
  scenario: string | null;
  skillTag: string | null;
  options: { key: string; text: string; originalKey: string }[];
  yourAnswer: string;
}

export interface RevengeModeLabels {
  answerError: string;
  close: string;
  completeScore: string;
  completeTitle: string;
  loadError: string;
  loading: string;
  questionCounter: string;
  retry: string;
  startCta: string;
  subtitle: string;
  title: string;
}

const LOCALE_FLASHCARDS = {
  en: enMessages.flashcards,
  ja: jaMessages.flashcards,
  vi: viMessages.flashcards
} as const;

function resolveRevengeLabels(locale: string, overrides?: Partial<RevengeModeLabels>): RevengeModeLabels {
  const dict =
    LOCALE_FLASHCARDS[locale as keyof typeof LOCALE_FLASHCARDS] ?? LOCALE_FLASHCARDS.vi;
  return {
    answerError: overrides?.answerError ?? dict.revengeAnswerError,
    close: overrides?.close ?? dict.revengeClose,
    completeScore: overrides?.completeScore ?? dict.revengeCompleteScore,
    completeTitle: overrides?.completeTitle ?? dict.revengeCompleteTitle,
    loadError: overrides?.loadError ?? dict.revengeLoadError,
    loading: overrides?.loading ?? dict.revengeLoading,
    questionCounter: overrides?.questionCounter ?? dict.revengeQuestionCounter,
    retry: overrides?.retry ?? dict.revengeRetry,
    startCta: overrides?.startCta ?? dict.revengeStartCta,
    subtitle: overrides?.subtitle ?? dict.revengeSubtitle,
    title: overrides?.title ?? dict.revengeTitle
  };
}

export function RevengeModeWidget({
  labels,
  locale
}: {
  labels?: Partial<RevengeModeLabels>;
  locale: string;
}) {
  const { userId } = useGoAuth();
  const copy = useMemo(() => resolveRevengeLabels(locale, labels), [labels, locale]);
  const [questions, setQuestions] = useState<RevengeQuestion[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [quizActive, setQuizActive] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctOption: string } | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const mountedRef = useRef(true);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const r = await learnerApiFetch("/api/quiz/revenge/queue?limit=5");
      if (!mountedRef.current) return;
      if (!r.ok) {
        setLoadFailed(true);
        return;
      }
      const data = (await r.json()) as { questions?: RevengeQuestion[]; totalPending?: number };
      if (!mountedRef.current) return;
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setTotalPending(typeof data.totalPending === "number" ? data.totalPending : 0);
    } catch {
      if (mountedRef.current) {
        setLoadFailed(true);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!userId) return null;

  if (loading) {
    return (
      <div
        aria-live="polite"
        className="animate-pulse rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm"
        role="status"
      >
        <span className="sr-only">{copy.loading}</span>
        <div className="h-4 w-32 rounded bg-ink/10" />
        <div className="mt-3 h-10 rounded-xl bg-ink/5" />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sakura-strong/30 bg-sakura-soft/60 p-4 text-left shadow-sm"
        role="alert"
      >
        <p className="text-xs font-medium text-sakura-strong">{copy.loadError}</p>
        <button
          className="text-xs font-bold text-ink underline outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => void load()}
          type="button"
        >
          {copy.retry}
        </button>
      </div>
    );
  }

  if (questions.length === 0) return null;

  const currentQ = questions[currentIdx];
  const isComplete = quizActive && currentIdx >= questions.length;

  const handleAnswer = async (optionKey: string) => {
    if (selected || !currentQ) return;
    setSelected(optionKey);
    setSubmitError(null);
    const originalKey = currentQ.options.find((o) => o.key === optionKey)?.originalKey ?? optionKey;
    try {
      const r = await learnerApiFetch("/api/quiz/revenge/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQ.questionId, selectedOption: originalKey })
      });
      if (!mountedRef.current) return;
      if (!r.ok) {
        setSelected(null);
        setSubmitError(copy.answerError);
        return;
      }
      const data = (await r.json()) as { isCorrect: boolean; correctOption: string };
      if (!mountedRef.current) return;
      const correctDisplayKey =
        currentQ.options.find((o) => o.originalKey === data.correctOption)?.key ?? data.correctOption;
      setFeedback({ isCorrect: data.isCorrect, correctOption: correctDisplayKey });
      setResults((prev) => [...prev, data.isCorrect]);
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
      }
      advanceTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setSelected(null);
        setFeedback(null);
        setCurrentIdx((i) => i + 1);
      }, 1200);
    } catch {
      if (!mountedRef.current) return;
      setSelected(null);
      setSubmitError(copy.answerError);
    }
  };

  if (!quizActive) {
    return (
      <section className="rounded-2xl border border-sakura/25 bg-sakura-soft/60 p-4 text-left shadow-sm">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-lg">
            ⚔️
          </span>
          <h3 className="text-sm font-bold text-ink">{copy.title}</h3>
          <span className="ml-auto rounded-full bg-sakura-soft px-2 py-0.5 text-xs font-bold tabular-nums text-sakura-strong">
            {totalPending}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {copy.subtitle.replace("{count}", String(totalPending))}
        </p>
        <button
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-surface shadow-sm outline-none ring-offset-2 transition-colors hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
          onClick={() => {
            setQuizActive(true);
            setCurrentIdx(0);
            setResults([]);
            setSubmitError(null);
          }}
          type="button"
        >
          {copy.startCta}
        </button>
      </section>
    );
  }

  if (isComplete) {
    const correct = results.filter(Boolean).length;
    const percent = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;
    const scoreLine = copy.completeScore
      .replace("{correct}", String(correct))
      .replace("{total}", String(results.length))
      .replace("{percent}", String(percent));
    return (
      <section className="rounded-2xl border border-matcha-strong/30 bg-matcha-soft/60 p-4 text-center shadow-sm dark:border-matcha/30">
        <p aria-hidden className="text-2xl">
          🎉
        </p>
        <p className="mt-2 text-sm font-bold text-ink">{copy.completeTitle}</p>
        <p className="mt-1 text-xs text-muted">{scoreLine}</p>
        <button
          className="mt-3 text-xs font-semibold text-matcha-strong underline outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-matcha"
          onClick={() => {
            setQuizActive(false);
            void load();
          }}
          type="button"
        >
          {copy.close}
        </button>
      </section>
    );
  }

  const counterText = copy.questionCounter
    .replace("{current}", String(currentIdx + 1))
    .replace("{total}", String(questions.length));

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-4 text-left shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">
          <span aria-hidden className="mr-1">
            ⚔️
          </span>
          {counterText}
        </span>
        <span className="text-xs text-muted">{currentQ?.skillTag ?? ""}</span>
      </div>

      {currentQ?.scenario ? (
        <p className="mt-2 text-xs italic leading-relaxed text-muted">{currentQ.scenario}</p>
      ) : null}

      <p className="mt-2 text-sm font-medium leading-[1.8] text-ink" lang="ja">
        {currentQ?.prompt}
      </p>

      {submitError ? (
        <p className="mt-2 text-xs font-medium text-sakura-strong" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {currentQ?.options.map((opt) => {
          let optClass = "border-ink/10 bg-paper hover:bg-ink/5";
          if (selected === opt.key && feedback) {
            optClass = feedback.isCorrect
              ? "border-matcha-strong bg-matcha-soft/50 dark:border-matcha"
              : "border-sakura-strong bg-sakura-soft/50";
          } else if (feedback && opt.key === feedback.correctOption) {
            optClass = "border-matcha-strong bg-matcha-soft/50 dark:border-matcha";
          }

          return (
            <button
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent",
                optClass,
                !selected && "active:scale-[0.98]"
              )}
              disabled={Boolean(selected)}
              key={opt.key}
              onClick={() => void handleAnswer(opt.key)}
              type="button"
            >
              <span className="mr-2 font-bold text-ink/70">{opt.key}.</span>
              <span className="text-ink" lang="ja">
                {opt.text}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
