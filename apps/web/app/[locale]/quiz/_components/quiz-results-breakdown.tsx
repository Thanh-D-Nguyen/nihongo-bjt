"use client";

import { useState } from "react";

export interface BreakdownQuestion {
  questionId: string;
  prompt: string;
  selectedOption: string;
  isCorrect: boolean;
  explanationVi: string;
  remediationCardId?: string | null;
}

export interface BreakdownResponse {
  sessionId: string;
  testId: string;
  testTitleVi: string;
  testTitleJa?: string | null;
  estimatedScore: number | null;
  estimatedBjtBand: string | null;
  breakdown: BreakdownQuestion[];
}

interface BreakdownLabels {
  resultsTitle: string;
  estimatedScoreLabel: string;
  estimatedBandLabel: string;
  breakdownTitle: string;
  correctLabel: string;
  wrongLabel: string;
  explanationLabel: string;
  selectedOptionLabel: string;
  addToFlashcardAction: string;
  addToFlashcardSuccess: string;
  addToFlashcardError: string;
  loadingText: string;
  errorText: string;
}

export function QuizResultsBreakdown({
  breakdown,
  labels,
  userId
}: {
  breakdown: BreakdownResponse;
  labels: BreakdownLabels;
  userId: string | null;
}) {
  const [addingCardId, setAddingCardId] = useState<string | null>(null);
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set());
  const [cardError, setCardError] = useState<string | null>(null);

  const handleAddToFlashcard = async (questionId: string, remediationCardId: string) => {
    if (!userId) return;

    setAddingCardId(questionId);
    setCardError(null);

    try {
      const response = await fetch("/api/flashcards/add-from-remediation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          remediationCardId,
          sourceType: "quiz_remediation"
        })
      });

      if (!response.ok) {
        throw new Error(labels.addToFlashcardError);
      }

      setAddedCards((prev) => new Set(prev).add(questionId));
    } catch (error) {
      setCardError(error instanceof Error ? error.message : labels.addToFlashcardError);
    } finally {
      setAddingCardId(null);
    }
  };

  const correctCount = breakdown.breakdown.filter((q) => q.isCorrect).length;
  const totalCount = breakdown.breakdown.length;

  return (
    <article className="space-y-4">
      {/* Section header */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">{labels.breakdownTitle}</h2>
        <span className="text-xs font-semibold tabular-nums text-muted">
          {correctCount}/{totalCount}
        </span>
      </div>

      {/* Question cards */}
      <div className="space-y-3">
        {breakdown.breakdown.map((question, index) => (
          <div
            key={question.questionId}
            className={`overflow-hidden rounded-2xl border bg-surface shadow-sm ${
              question.isCorrect ? "border-emerald-200/60" : "border-sakura/20"
            }`}
          >
            {/* Top accent */}
            <div className={`h-0.5 w-full ${question.isCorrect ? "bg-emerald-400" : "bg-sakura/60"}`} />

            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Number badge */}
                  <span className={`mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    question.isCorrect
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-sakura/10 text-sakura"
                  }`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-relaxed text-ink">
                      {question.prompt}
                    </p>
                    <p className="mt-1.5 text-xs text-muted">
                      {labels.selectedOptionLabel}:{" "}
                      <span className="font-semibold text-ink">{question.selectedOption}</span>
                    </p>
                  </div>
                </div>
                {question.isCorrect ? (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {labels.correctLabel}
                  </span>
                ) : (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-sakura/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sakura">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {labels.wrongLabel}
                  </span>
                )}
              </div>

              {/* Explanation for wrong answers */}
              {!question.isCorrect && (
                <div className="mt-3 rounded-xl bg-paper/70 px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-accent">{labels.explanationLabel}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink/80">{question.explanationVi}</p>
                </div>
              )}

              {/* Flashcard action */}
              {question.remediationCardId && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => handleAddToFlashcard(question.questionId, question.remediationCardId!)}
                    disabled={addingCardId === question.questionId || addedCards.has(question.questionId)}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/5 px-3 text-xs font-semibold text-accent outline-none ring-offset-2 transition hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {addingCardId === question.questionId ? labels.loadingText : labels.addToFlashcardAction}
                  </button>
                  {addedCards.has(question.questionId) && (
                    <span className="text-xs font-medium text-emerald-600">{labels.addToFlashcardSuccess}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Global error */}
      {cardError && (
        <div className="rounded-xl border border-sakura/20 bg-sakura/5 px-4 py-3">
          <p className="text-xs font-medium text-sakura">{cardError}</p>
        </div>
      )}
    </article>
  );
}
