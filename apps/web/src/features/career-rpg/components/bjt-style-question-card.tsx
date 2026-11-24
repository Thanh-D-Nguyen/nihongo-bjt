"use client";

import { Button, Card } from "@nihongo-bjt/ui";
import { useState } from "react";

import type { CareerRpgLabels } from "../i18n";
import type { BjtStyleQuestion } from "../types";

interface Props {
  question: BjtStyleQuestion;
  labels: CareerRpgLabels["chapter"];
  disabled?: boolean;
  onSubmit: (optionKey: string) => void;
}

export function BjtStyleQuestionCard({ question, labels, disabled = false, onSubmit }: Props) {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <Card className="space-y-4 p-5">
      <header>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
          {labels.questionEyebrow}
        </p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-ink">
          {question.promptJa}
        </h3>
        <p className="text-xs text-muted">{question.promptVi}</p>
      </header>
      <ul className="space-y-2">
        {question.options.map((opt) => {
          const isPicked = picked === opt.optionKey;
          return (
            <li key={opt.optionKey}>
              <button
                aria-pressed={isPicked}
                className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                  isPicked
                    ? "border-brand-navy bg-accent-soft shadow-sm"
                    : "border-border bg-surface hover:border-border-hover hover:bg-paper"
                } ${disabled ? "pointer-events-none opacity-60" : ""}`}
                disabled={disabled}
                onClick={() => setPicked(opt.optionKey)}
                type="button"
              >
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    isPicked ? "bg-brand-panel text-white" : "bg-paper text-muted"
                  }`}
                >
                  {opt.optionKey}
                </span>
                <span className="flex-1 text-sm leading-relaxed text-ink">{opt.textJa}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-dashed border-border pt-3">
        <span className="text-xs text-muted">
          {picked ? `${labels.selectAnswer}: ${picked}` : labels.selectAnswer}
        </span>
        <Button
          disabled={disabled || !picked}
          onClick={() => picked && onSubmit(picked)}
          size="md"
          variant="primary"
        >
          {labels.submitAnswer}
        </Button>
      </div>
    </Card>
  );
}
