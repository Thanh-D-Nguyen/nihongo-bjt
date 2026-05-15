"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

interface RevengeQuestion {
  questionId: string;
  prompt: string;
  scenario: string | null;
  skillTag: string | null;
  options: { key: string; text: string }[];
  yourAnswer: string;
}

export function RevengeModeWidget({ locale }: { locale: string }) {
  const { userId } = useKeycloakAuth();
  const [questions, setQuestions] = useState<RevengeQuestion[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [quizActive, setQuizActive] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctOption: string } | null>(null);
  const [results, setResults] = useState<boolean[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch("/api/quiz/revenge/queue?limit=5");
      if (r.ok) {
        const data = await r.json();
        setQuestions(data.questions ?? []);
        setTotalPending(data.totalPending ?? 0);
      }
    } catch { /* no-op */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  if (!userId) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm animate-pulse">
        <div className="h-4 w-32 rounded bg-ink/10" />
        <div className="mt-3 h-10 rounded-xl bg-ink/5" />
      </div>
    );
  }

  if (questions.length === 0) return null;

  const currentQ = questions[currentIdx];
  const isComplete = quizActive && currentIdx >= questions.length;

  const handleAnswer = async (optionKey: string) => {
    if (selected || !currentQ) return;
    setSelected(optionKey);
    try {
      const r = await learnerApiFetch("/api/quiz/revenge/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQ.questionId, selectedOption: optionKey }),
      });
      if (r.ok) {
        const data = await r.json();
        setFeedback(data);
        setResults((prev) => [...prev, data.isCorrect]);
        setTimeout(() => {
          setSelected(null);
          setFeedback(null);
          setCurrentIdx((i) => i + 1);
        }, 1200);
      }
    } catch { /* no-op */ }
  };

  if (!quizActive) {
    return (
      <div className="rounded-2xl border border-[var(--color-sakura)]/20 bg-[var(--color-sakura)]/5 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚔️</span>
          <h3 className="text-sm font-bold text-ink">Revenge Mode</h3>
          <span className="ml-auto rounded-full bg-[var(--color-sakura)]/15 px-2 py-0.5 text-xs font-bold text-[var(--color-sakura)]">
            {totalPending}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {totalPending} câu sai tuần này. Thử lại để ghi nhớ tốt hơn!
        </p>
        <button
          onClick={() => { setQuizActive(true); setCurrentIdx(0); setResults([]); }}
          className="mt-3 w-full rounded-xl bg-[var(--color-sakura)] py-2.5 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.97]"
        >
          Trả thù ngay ⚔️
        </button>
      </div>
    );
  }

  if (isComplete) {
    const correct = results.filter(Boolean).length;
    return (
      <div className="rounded-2xl border border-[var(--color-matcha)]/20 bg-[var(--color-matcha)]/5 p-4 shadow-sm text-center">
        <p className="text-2xl">🎉</p>
        <p className="mt-2 text-sm font-bold text-ink">Trả thù xong!</p>
        <p className="mt-1 text-xs text-muted">
          Đúng {correct}/{results.length} câu ({results.length > 0 ? Math.round((correct / results.length) * 100) : 0}%)
        </p>
        <button
          onClick={() => { setQuizActive(false); void load(); }}
          className="mt-3 text-xs font-medium text-[var(--color-matcha)] underline"
        >
          Đóng
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">⚔️ Câu {currentIdx + 1}/{questions.length}</span>
        <span className="text-xs text-muted">{currentQ?.skillTag ?? ""}</span>
      </div>

      {currentQ?.scenario && (
        <p className="mt-2 text-xs text-muted italic leading-relaxed">{currentQ.scenario}</p>
      )}

      <p className="mt-2 text-sm font-medium text-ink leading-[1.8]">{currentQ?.prompt}</p>

      <div className="mt-3 flex flex-col gap-2">
        {currentQ?.options.map((opt) => {
          let optClass = "border-ink/10 bg-paper hover:bg-ink/5";
          if (selected === opt.key && feedback) {
            optClass = feedback.isCorrect
              ? "border-[var(--color-matcha)] bg-[var(--color-matcha)]/10"
              : "border-[var(--color-sakura)] bg-[var(--color-sakura)]/10";
          } else if (feedback && opt.key === feedback.correctOption) {
            optClass = "border-[var(--color-matcha)] bg-[var(--color-matcha)]/10";
          }

          return (
            <button
              key={opt.key}
              disabled={!!selected}
              onClick={() => void handleAnswer(opt.key)}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                optClass,
                !selected && "active:scale-[0.98]",
              )}
            >
              <span className="font-bold text-ink/50 mr-2">{opt.key}.</span>
              <span className="text-ink">{opt.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
