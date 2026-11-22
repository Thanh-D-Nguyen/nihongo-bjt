"use client";

import { useCallback, useState } from "react";

/* ─── Types ─── */

interface QuizOption {
  label: string;
  isCorrect: boolean;
}

interface QuizItem {
  questionJp: string;
  questionVi?: string;
  options: QuizOption[];
  explanationJp?: string;
  explanationVi?: string;
}

interface QuizTranslations {
  quizProgress: string;
  quizNext: string;
  quizResult: string;
  quizComplete: string;
  quizScore: string;
  quizPerfect: string;
  quizGood: string;
  quizTryAgain: string;
  quizSaveFailed: string;
  [key: string]: string;
}

/* ─── Component ─── */

export function MiniQuiz({
  quizzes,
  articleSlug,
  t,
}: {
  quizzes: QuizItem[];
  articleSlug: string;
  t: QuizTranslations;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const current = quizzes[currentIndex];
  const total = quizzes.length;
  const isLast = currentIndex === total - 1;

  const handleSelect = useCallback(
    (idx: number) => {
      if (showResult) return;
      setSelected(idx);
      setShowResult(true);
      if (current?.options[idx]?.isCorrect) {
        setScore((s) => s + 1);
      }
    },
    [showResult, current],
  );

  const handleNext = useCallback(() => {
    if (isLast) {
      setCompleted(true);
      fetch(`/api/magazine/${encodeURIComponent(articleSlug)}/read`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizScore: score, quizTotal: total }),
      }).then((response) => {
        if (!response.ok) setSaveFailed(true);
      }).catch(() => setSaveFailed(true));
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setShowResult(false);
    }
  }, [isLast, score, total, articleSlug]);

  // Completion screen
  if (completed) {
    const emoji = score === total ? "🎉" : score >= total / 2 ? "👍" : "💪";
    const message = score === total ? t.quizPerfect : score >= total / 2 ? t.quizGood : t.quizTryAgain;

    return (
      <div className="flex flex-col items-center rounded-3xl border border-border bg-gradient-to-br from-surface to-accent/5 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-accent/10 text-4xl">
          {emoji}
        </div>
        <p className="mt-5 text-2xl font-bold text-ink">
          {t.quizScore.replace("{score}", String(score)).replace("{total}", String(total))}
        </p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
          {message}
        </p>
        {saveFailed && <p role="alert" className="mt-3 text-sm text-sakura">{t.quizSaveFailed}</p>}
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
      {/* Progress bar */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-muted">
            {t.quizProgress.replace("{current}", String(currentIndex + 1)).replace("{total}", String(total))}
          </span>
          <span className="rounded-full bg-accent/10 px-3 py-0.5 text-xs font-semibold text-accent">
            🎯 {score}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-5">
        <p className="text-lg font-bold leading-[1.8] text-ink">{current.questionJp}</p>
        {current.questionVi && (
          <p className="mt-1.5 text-sm text-muted">{current.questionVi}</p>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2.5">
        {current.options.map((opt, idx) => {
          let className =
            "flex w-full min-h-[48px] items-center rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition-all duration-200 motion-reduce:transition-none";

          if (!showResult) {
            className +=
              " border-border bg-paper text-ink hover:border-accent/50 hover:bg-accent/5 cursor-pointer active:scale-[0.98]";
          } else if (opt.isCorrect) {
            className +=
              " border-leaf/40 bg-leaf-soft text-leaf-strong shadow-sm shadow-leaf/10";
          } else if (idx === selected) {
            className +=
              " border-sakura/40 bg-sakura-soft text-sakura-strong";
          } else {
            className += " border-border/40 bg-paper/50 text-muted opacity-50";
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={showResult}
              onClick={() => handleSelect(idx)}
              className={className}
            >
              <span className="mr-3 flex size-6 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-bold">
                {String.fromCharCode(65 + idx)}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Explanation + Next */}
      {showResult && (
        <div className="mt-5 space-y-3">
          {(current.explanationJp || current.explanationVi) && (
            <div className="rounded-2xl border border-border bg-paper p-4">
              {current.explanationJp && (
                <p className="text-sm leading-[1.8] text-ink">{current.explanationJp}</p>
              )}
              {current.explanationVi && (
                <p className="mt-1.5 text-xs italic text-muted">
                  {current.explanationVi}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={handleNext}
            className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-action px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-action/20 transition-all duration-200 hover:bg-action-hover active:scale-[0.98]"
          >
            {isLast ? t.quizResult : t.quizNext}
          </button>
        </div>
      )}
    </div>
  );
}
