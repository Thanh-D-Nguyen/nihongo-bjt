"use client";

import { useState } from "react";
import type { GameTypeRoundProps } from "./shared-props";

/**
 * Mock Exam Sprint: Passage-based questions.
 * Shows a passage/reading text, then questions about it.
 * Split view on desktop, tabbed on mobile.
 */
export function MockExamRound({
  answerPending,
  answerResult,
  canAnswer,
  onSubmitAnswer,
  round,
  selectedOptionKey
}: GameTypeRoundProps) {
  const [showPassage, setShowPassage] = useState(true);

  // The prompt serves as both passage and question.
  // Split by double-newline or use entire prompt as passage context.
  const parts = round.question.prompt.split(/\n\n+/);
  const passage = parts.length > 1 ? parts.slice(0, -1).join("\n\n") : round.question.prompt;
  const questionText = parts.length > 1 ? parts[parts.length - 1] : "";

  const sectionNum = Math.floor(round.roundIndex / 5) + 1;
  const questionInSection = (round.roundIndex % 5) + 1;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>📋</span>
          <span className="text-xs font-black uppercase text-indigo-600">
            Section {sectionNum} • Q{questionInSection}
          </span>
        </div>
        {/* Mobile tab toggle */}
        <div className="flex gap-1 sm:hidden">
          <button
            className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition ${
              showPassage ? "bg-indigo-100 text-indigo-700" : "bg-ink/5 text-muted"
            }`}
            onClick={() => setShowPassage(true)}
            type="button"
          >
            📄 Passage
          </button>
          <button
            className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition ${
              !showPassage ? "bg-indigo-100 text-indigo-700" : "bg-ink/5 text-muted"
            }`}
            onClick={() => setShowPassage(false)}
            type="button"
          >
            ❓ Question
          </button>
        </div>
      </div>

      {/* Desktop: side-by-side / Mobile: tabbed */}
      <div className="sm:grid sm:grid-cols-5 sm:gap-3">
        {/* Passage panel */}
        <div className={`sm:col-span-3 ${!showPassage ? "hidden sm:block" : ""}`}>
          <div className="max-h-52 overflow-y-auto rounded-xl border border-indigo-100 bg-white p-4 shadow-sm sm:max-h-72">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-indigo-50">
              <span className="text-xs font-black text-indigo-600">Reading Passage</span>
              <span className="text-[10px] text-muted">Scroll if needed ↕</span>
            </div>
            <p className="text-sm font-medium leading-7 text-ink whitespace-pre-line" style={{ lineHeight: "1.9" }}>
              {passage}
            </p>
          </div>
        </div>

        {/* Question + Options panel */}
        <div className={`sm:col-span-2 space-y-3 ${showPassage ? "hidden sm:block" : ""} mt-3 sm:mt-0`}>
          {questionText && (
            <p className="rounded-xl border border-indigo-50 bg-indigo-50/50 px-3 py-2 text-sm font-semibold text-ink">
              {questionText}
            </p>
          )}
          <div className="space-y-2">
            {round.question.options.map((option, idx) => {
              const picked = selectedOptionKey === option.optionKey;
              const correct = answerResult?.correctOptionKey === option.optionKey;
              const wrong = picked && answerResult && !answerResult.userCorrect;
              const num = idx + 1;
              return (
                <button
                  key={option.optionKey}
                  className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                    correct
                      ? "border-leaf/40 bg-leaf/10 ring-2 ring-leaf/20"
                      : wrong
                        ? "border-red-300 bg-red-50 ring-2 ring-red-200"
                        : picked
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-ink/10 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 active:scale-[0.98]"
                  } ${answerPending || answerResult ? "pointer-events-none" : ""}`}
                  disabled={!canAnswer}
                  onClick={() => onSubmitAnswer(option.optionKey)}
                  type="button"
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded text-[10px] font-black ${
                    correct ? "bg-leaf text-white" :
                    wrong ? "bg-red-500 text-white" :
                    picked ? "bg-indigo-500 text-white" :
                    "bg-ink/5 text-muted"
                  }`}>
                    {num}
                  </span>
                  <span className="text-sm font-semibold leading-5 text-ink">{option.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile: "Next" hint to switch to questions */}
      {showPassage && (
        <button
          className="w-full rounded-xl bg-indigo-600 py-2.5 text-center text-sm font-black text-white shadow-sm sm:hidden active:scale-[0.98]"
          onClick={() => setShowPassage(false)}
          type="button"
        >
          Answer Question →
        </button>
      )}
    </div>
  );
}
