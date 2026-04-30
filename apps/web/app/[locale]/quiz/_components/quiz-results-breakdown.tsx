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

  return (
    <article className="space-y-6 rounded-xl border border-ink/10 bg-surface p-4">
      <div className="border-b border-ink/10 pb-4">
        <h2 className="text-lg font-semibold text-ink">{labels.resultsTitle}</h2>
        <p className="mt-3 text-sm">
          {labels.estimatedScoreLabel} <strong>{breakdown.estimatedScore ?? "—"}</strong>
        </p>
        <p className="text-sm">
          {labels.estimatedBandLabel} <strong>{breakdown.estimatedBjtBand ?? "—"}</strong>
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-ink">{labels.breakdownTitle}</h3>
        <div className="mt-4 space-y-4">
          {breakdown.breakdown.map((question, index) => (
            <div
              key={question.questionId}
              className="rounded-lg border border-ink/10 bg-paper/50 p-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">
                    Q{index + 1}. {question.prompt}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {labels.selectedOptionLabel ?? "Your answer"}:{" "}
                    <strong>{question.selectedOption}</strong>
                  </p>
                </div>
                {question.isCorrect ? (
                  <span className="ml-2 inline-flex rounded-full bg-success/20 px-2.5 py-0.5 text-xs font-semibold text-success">
                    {labels.correctLabel}
                  </span>
                ) : (
                  <span className="ml-2 inline-flex rounded-full bg-sakura/20 px-2.5 py-0.5 text-xs font-semibold text-sakura">
                    {labels.wrongLabel}
                  </span>
                )}
              </div>

              {!question.isCorrect && (
                <div className="mt-3 rounded-lg bg-info/10 p-2.5">
                  <p className="text-xs font-semibold text-info">{labels.explanationLabel}</p>
                  <p className="mt-1 text-xs text-ink">{question.explanationVi}</p>
                </div>
              )}

              {question.remediationCardId && (
                <button
                  onClick={() => handleAddToFlashcard(question.questionId, question.remediationCardId!)}
                  disabled={addingCardId === question.questionId || addedCards.has(question.questionId)}
                  className="mt-2 inline-flex rounded-lg border border-info/30 bg-info/5 px-3 py-1.5 text-xs font-semibold text-info hover:bg-info/10 disabled:opacity-50"
                >
                  {addingCardId === question.questionId ? labels.loadingText : labels.addToFlashcardAction}
                </button>
              )}

              {addedCards.has(question.questionId) && (
                <p className="mt-2 text-xs text-success">{labels.addToFlashcardSuccess}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {cardError && (
        <div className="rounded-lg border border-sakura/30 bg-sakura/10 p-3">
          <p className="text-xs text-sakura">{cardError}</p>
        </div>
      )}
    </article>
  );
}
