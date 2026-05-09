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
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B7280]">
          {labels.questionEyebrow}
        </p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-[#111827]">
          {question.promptJa}
        </h3>
        <p className="text-xs text-[#4B5563]">{question.promptVi}</p>
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
                    ? "border-[#1B2A4A] bg-[#EEF2FF] shadow-sm"
                    : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
                } ${disabled ? "pointer-events-none opacity-60" : ""}`}
                disabled={disabled}
                onClick={() => setPicked(opt.optionKey)}
                type="button"
              >
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    isPicked ? "bg-[#1B2A4A] text-white" : "bg-[#F1F5F9] text-[#4B5563]"
                  }`}
                >
                  {opt.optionKey}
                </span>
                <span className="flex-1 text-sm leading-relaxed text-[#111827]">{opt.textJa}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-dashed border-[#E2E8F0] pt-3">
        <span className="text-xs text-[#6B7280]">
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
