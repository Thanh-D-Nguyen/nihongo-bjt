"use client";

import { useCallback, useState } from "react";

/* ─── Types ─── */

export type VocabExpression = {
  word: string;
  reading: string;
  meaning: string;
  jlptLevel?: string;
  example?: string;
  exampleReading?: string;
  exampleMeaning?: string;
  usageNote?: string;
};

type Labels = {
  addToFlashcard: string;
  addedToFlashcard: string;
  example: string;
  exampleMeaning: string;
  listenPronunciation: string;
  meaning: string;
  reading: string;
  tapToExpand: string;
  usageNote: string;
};

/* ─── TTS helper ─── */

function speakJapanese(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.85;
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find((v) => v.lang.startsWith("ja"));
  if (jaVoice) utterance.voice = jaVoice;
  window.speechSynthesis.speak(utterance);
}

/* ─── Single expression card ─── */

function ExpressionCard({
  expression,
  index,
  labels,
  gradient,
}: {
  expression: VocabExpression;
  gradient: string;
  index: number;
  labels: Labels;
}) {
  const [expanded, setExpanded] = useState(false);
  const [flashcardAdded, setFlashcardAdded] = useState(false);

  const handleSpeak = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      speakJapanese(expression.word);
    },
    [expression.word],
  );

  const handleSpeakExample = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (expression.example) speakJapanese(expression.example);
    },
    [expression.example],
  );

  const handleFlashcard = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setFlashcardAdded(true);
      // TODO: integrate with real flashcard API when user is authenticated
      setTimeout(() => setFlashcardAdded(false), 2500);
    },
    [],
  );

  return (
    <div
      className={`group/card overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 ${expanded ? "shadow-lg ring-1 ring-slate-200" : "hover:shadow-md hover:-translate-y-0.5"}`}
    >
      {/* Main row - always visible */}
      <button
        className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-slate-50/50"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        {/* Number badge */}
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-sm font-bold text-white shadow-sm`}
        >
          {index + 1}
        </span>

        {/* Word + Reading + Meaning */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold text-slate-900 leading-tight" lang="ja">
              {expression.word}
            </span>
            <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg" lang="ja">
              {expression.reading}
            </span>
            {expression.jlptLevel && (
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                {expression.jlptLevel}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm font-medium text-slate-700 leading-relaxed">
            {expression.meaning}
          </p>
        </div>

        {/* Expand indicator */}
        <svg
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded content */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 active:scale-95"
                onClick={handleSpeak}
                title={labels.listenPronunciation}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {labels.listenPronunciation}
              </button>
              <button
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${flashcardAdded ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
                onClick={handleFlashcard}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {flashcardAdded ? labels.addedToFlashcard : labels.addToFlashcard}
              </button>
            </div>

            {/* Example sentence */}
            {expression.example && (
              <div className="rounded-xl bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {labels.example}
                  </span>
                  <button
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 active:scale-90"
                    onClick={handleSpeakExample}
                    title={labels.listenPronunciation}
                    type="button"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M15.536 8.464a5 5 0 010 7.072M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <p className="text-lg font-semibold text-slate-900 leading-relaxed" lang="ja" style={{ lineHeight: "1.9" }}>
                  {expression.example}
                </p>
                {expression.exampleReading && (
                  <p className="text-xs font-medium text-slate-500" lang="ja">
                    {expression.exampleReading}
                  </p>
                )}
                {expression.exampleMeaning && (
                  <p className="mt-1 text-sm text-slate-700 italic">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 not-italic mr-2">
                      {labels.exampleMeaning}
                    </span>
                    {expression.exampleMeaning}
                  </p>
                )}
              </div>
            )}

            {/* Usage note */}
            {expression.usageNote && (
              <div className="flex gap-2.5 rounded-xl bg-amber-50/70 p-3.5 border border-amber-100">
                <svg className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                    {labels.usageNote}
                  </span>
                  <p className="mt-0.5 text-sm leading-relaxed text-amber-900">
                    {expression.usageNote}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Expression list ─── */

export function VocabExpressionList({
  expressions,
  gradient,
  labels,
}: {
  expressions: VocabExpression[];
  gradient: string;
  labels: Labels;
}) {
  return (
    <div className="space-y-3">
      {expressions.map((expr, i) => (
        <ExpressionCard
          expression={expr}
          gradient={gradient}
          index={i}
          key={`${expr.word}-${i}`}
          labels={labels}
        />
      ))}
    </div>
  );
}
