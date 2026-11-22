"use client";

import { useCallback, useState } from "react";
import { speakJapanese } from "../../../lib/japanese-speech";
import { FlashcardAddAction, type ContentActionLabels } from "./content-actions";

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
  sourceId?: string;
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

/* ─── Single expression card ─── */

function ExpressionCard({
  expression,
  index,
  labels,
  flashcardLabels,
  gradient,
}: {
  expression: VocabExpression;
  gradient: string;
  index: number;
  labels: Labels;
  flashcardLabels?: ContentActionLabels;
}) {
  const [expanded, setExpanded] = useState(false);

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

  return (
    <div
      className={`group/card overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-300 ${expanded ? "shadow-lg ring-1 ring-border-hover" : "hover:shadow-md hover:-translate-y-0.5"}`}
    >
      {/* Main row - always visible */}
      <button
        className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-paper/60"
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
            <span className="text-2xl font-bold text-ink leading-tight" lang="ja">
              {expression.word}
            </span>
            <span className="text-sm font-medium text-leaf-strong bg-leaf-soft px-2 py-0.5 rounded-lg" lang="ja">
              {expression.reading}
            </span>
            {expression.jlptLevel && (
              <span className="text-[11px] font-bold text-muted bg-paper border border-border px-2 py-0.5 rounded-full uppercase">
                {expression.jlptLevel}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm font-medium text-muted leading-relaxed">
            {expression.meaning}
          </p>
        </div>

        {/* Expand indicator */}
        <svg
          className={`h-5 w-5 shrink-0 text-muted transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
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
          <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-xl border border-accent/20 bg-accent-soft px-3 py-2 text-xs font-semibold text-brand-accent transition hover:border-accent/40 hover:bg-accent-soft/80 active:scale-95"
                onClick={handleSpeak}
                title={labels.listenPronunciation}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {labels.listenPronunciation}
              </button>
              {expression.sourceId && flashcardLabels && <FlashcardAddAction
                backText={expression.meaning}
                frontText={expression.word}
                labels={flashcardLabels}
                reading={expression.reading}
                sourceId={expression.sourceId}
                sourceType="magazine_vocab"
              />}
            </div>

            {/* Example sentence */}
            {expression.example && (
              <div className="rounded-xl border border-border bg-paper p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    {labels.example}
                  </span>
                  <button
                    className="rounded-lg p-1.5 text-muted transition hover:bg-border/60 hover:text-ink active:scale-90"
                    onClick={handleSpeakExample}
                    title={labels.listenPronunciation}
                    type="button"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M15.536 8.464a5 5 0 010 7.072M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <p className="text-lg font-semibold text-ink leading-relaxed" lang="ja" style={{ lineHeight: "1.9" }}>
                  {expression.example}
                </p>
                {expression.exampleReading && (
                  <p className="text-xs font-medium text-muted" lang="ja">
                    {expression.exampleReading}
                  </p>
                )}
                {expression.exampleMeaning && (
                  <p className="mt-1 text-sm text-muted italic">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted not-italic mr-2">
                      {labels.exampleMeaning}
                    </span>
                    {expression.exampleMeaning}
                  </p>
                )}
              </div>
            )}

            {/* Usage note */}
            {expression.usageNote && (
              <div className="flex gap-2.5 rounded-xl bg-amber-soft p-3.5 border border-amber/30">
                <svg className="h-4 w-4 shrink-0 text-amber-strong mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-strong">
                    {labels.usageNote}
                  </span>
                  <p className="mt-0.5 text-sm leading-relaxed text-amber-strong">
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
  flashcardLabels,
}: {
  expressions: VocabExpression[];
  gradient: string;
  labels: Labels;
  flashcardLabels?: ContentActionLabels;
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
          flashcardLabels={flashcardLabels}
        />
      ))}
    </div>
  );
}
