"use client";

import { cn } from "@nihongo-bjt/ui";
import { useState } from "react";

/**
 * Quick diagnostic mini-test — 5 multiple-choice questions spanning N5 → N3.
 * Used when a user picks "Chưa biết" (currentLevel === 0) so we can still
 * suggest a starting JLPT level.
 *
 * Scoring → suggested level:
 *   0–1 correct  → N5
 *   2–3 correct  → N4
 *   4–5 correct  → N3
 *
 * Kept intentionally short (≤ 60 s). Anchors: hiragana, katakana, N5 vocab,
 * N4 grammar (て-form), N3 vocab/kanji.
 */

interface DiagnosticQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  /** JLPT level this question is aimed at, for analytics or future weighting */
  level: 5 | 4 | 3;
}

const QUESTIONS: DiagnosticQuestion[] = [
  {
    prompt: "Hiragana này đọc là gì? 「か」",
    options: ["sa", "ka", "ta", "na"],
    correctIndex: 1,
    level: 5,
  },
  {
    prompt: "Katakana 「テ」 đọc là gì?",
    options: ["te", "ne", "tu", "ke"],
    correctIndex: 0,
    level: 5,
  },
  {
    prompt: "「ありがとう」 nghĩa là?",
    options: ["Xin chào", "Cảm ơn", "Tạm biệt", "Xin lỗi"],
    correctIndex: 1,
    level: 5,
  },
  {
    prompt: "Chọn dạng te của 「食べる」 (taberu):",
    options: ["食べた", "食べて", "食べない", "食べる"],
    correctIndex: 1,
    level: 4,
  },
  {
    prompt: "「経済」 đọc là gì?",
    options: ["けいざい (keizai)", "けいけん (keiken)", "きょうい (kyōi)", "けいやく (keiyaku)"],
    correctIndex: 0,
    level: 3,
  },
];

export function OnboardingDiagnostic({
  onComplete,
  onSkip,
}: {
  /** Called with the suggested JLPT level (5/4/3) after all questions answered */
  onComplete: (suggestedLevel: 5 | 4 | 3) => void;
  /** Called if user skips diagnostic without finishing */
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);

  const current = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;
  const selected = answers[index];

  const pick = (optIdx: number) => {
    if (showFeedback) return;
    const nextAnswers = [...answers];
    nextAnswers[index] = optIdx;
    setAnswers(nextAnswers);
    setShowFeedback(true);
  };

  const proceed = () => {
    setShowFeedback(false);
    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    // Compute score & suggest level
    const correct = answers.reduce(
      (sum, ans, i) => (ans === QUESTIONS[i].correctIndex ? sum + 1 : sum),
      0,
    );
    const suggested: 5 | 4 | 3 = correct <= 1 ? 5 : correct <= 3 ? 4 : 3;
    onComplete(suggested);
  };

  return (
    <div className="space-y-4">
      {/* Sub-progress within diagnostic */}
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Bài kiểm tra nhanh · Câu {index + 1}/{QUESTIONS.length}</span>
        <button
          className="hover:text-ink transition"
          onClick={onSkip}
          type="button"
        >
          Bỏ qua bài kiểm tra
        </button>
      </div>

      <div className="rounded-2xl border border-ink/8 bg-surface p-4">
        <p className="mb-3 text-base font-semibold text-ink">{current.prompt}</p>
        <div className="space-y-2">
          {current.options.map((opt, optIdx) => {
            const isPicked = selected === optIdx;
            const isCorrect = optIdx === current.correctIndex;
            const reveal = showFeedback;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => pick(optIdx)}
                disabled={showFeedback}
                className={cn(
                  "block w-full rounded-xl border p-3 text-left text-sm transition",
                  reveal && isCorrect
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                    : reveal && isPicked && !isCorrect
                      ? "border-rose-400 bg-rose-50 text-rose-900"
                      : isPicked
                        ? "border-accent bg-accent/10 text-ink"
                        : "border-ink/8 bg-surface text-ink/80 hover:border-ink/20",
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {showFeedback && (
          <div className="mt-3 flex items-center justify-between text-xs">
            <span
              className={cn(
                "font-medium",
                selected === current.correctIndex
                  ? "text-emerald-600"
                  : "text-rose-600",
              )}
            >
              {selected === current.correctIndex
                ? "✓ Chính xác"
                : "✗ Chưa đúng"}
            </span>
            <button
              type="button"
              onClick={proceed}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-white hover:bg-accent/90"
            >
              {isLast ? "Xem gợi ý trình độ" : "Câu tiếp →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
