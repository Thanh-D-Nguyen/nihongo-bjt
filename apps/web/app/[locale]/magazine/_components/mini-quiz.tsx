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
      const apiBase = (
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
      ).replace(/\/$/u, "");
      fetch(`${apiBase}/api/magazine/${articleSlug}/read`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizScore: score, quizTotal: total }),
      }).catch(() => {});
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
      <div className="flex flex-col items-center rounded-3xl border border-border/30 bg-gradient-to-br from-primary/5 to-accent/5 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-4xl">
          {emoji}
        </div>
        <p className="mt-5 text-2xl font-bold text-foreground">
          {t.quizScore.replace("{score}", String(score)).replace("{total}", String(total))}
        </p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="rounded-3xl border border-border/30 bg-card p-5 sm:p-6">
      {/* Progress bar */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-muted-foreground">
            {t.quizProgress.replace("{current}", String(currentIndex + 1)).replace("{total}", String(total))}
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
            🎯 {score}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-accent/30">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-5">
        <p className="text-lg font-bold leading-[1.8] text-foreground">{current.questionJp}</p>
        {current.questionVi && (
          <p className="mt-1.5 text-sm text-muted-foreground">{current.questionVi}</p>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2.5">
        {current.options.map((opt, idx) => {
          let className =
            "flex w-full min-h-[48px] items-center rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition-all duration-200 motion-reduce:transition-none";

          if (!showResult) {
            className +=
              " border-border/40 bg-background text-foreground hover:border-primary/40 hover:bg-primary/5 cursor-pointer active:scale-[0.98]";
          } else if (opt.isCorrect) {
            className +=
              " border-green-500/50 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200 shadow-sm shadow-green-500/10";
          } else if (idx === selected) {
            className +=
              " border-red-500/50 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200";
          } else {
            className += " border-border/20 bg-muted/50 text-muted-foreground opacity-50";
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
            <div className="rounded-2xl border border-border/30 bg-accent/30 p-4">
              {current.explanationJp && (
                <p className="text-sm leading-[1.8] text-foreground">{current.explanationJp}</p>
              )}
              {current.explanationVi && (
                <p className="mt-1.5 text-xs italic text-muted-foreground">
                  {current.explanationVi}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={handleNext}
            className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-200 hover:bg-primary/90 active:scale-[0.98]"
          >
            {isLast ? t.quizResult : t.quizNext}
          </button>
        </div>
      )}
    </div>
  );
}
