"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../../lib/learner-api";

interface Choice {
  id: string;
  choiceKey: string;
  textVi: string;
  textJa: string | null;
}

interface Step {
  id: string;
  stepOrder: number;
  situationVi: string;
  situationJa: string | null;
  speakerName: string | null;
  speakerRole: string | null;
  choices: Choice[];
}

interface ScenarioData {
  id: string;
  titleVi: string;
  difficulty: string;
  steps: Step[];
}

interface ChoiceResult {
  stepOrder: number;
  choiceKey: string;
  points: number;
  isOptimal: boolean;
  feedbackVi: string | null;
}

export function ScenarioPlayClient({
  locale,
  scenarioId,
}: {
  locale: string;
  scenarioId: string;
}) {
  const { userId } = useKeycloakAuth();
  const router = useRouter();
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    isOptimal: boolean;
    feedbackVi: string | null;
    pointsAwarded: number;
  } | null>(null);
  const [results, setResults] = useState<ChoiceResult[]>([]);
  const [finished, setFinished] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch(`/api/scenarios/${scenarioId}`);
      if (r.ok) setScenario(await r.json());
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [userId, scenarioId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChoice = async (step: Step, choiceKey: string) => {
    if (selectedChoice) return;
    setSelectedChoice(choiceKey);
    try {
      const r = await learnerApiFetch(
        `/api/scenarios/steps/${step.id}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ choiceKey }),
        },
      );
      if (r.ok) {
        const data = await r.json();
        setFeedback(data);
        setResults((prev) => [
          ...prev,
          {
            stepOrder: step.stepOrder,
            choiceKey,
            points: data.pointsAwarded,
            isOptimal: data.isOptimal,
            feedbackVi: data.feedbackVi,
          },
        ]);
      }
    } catch {
      /* no-op */
    }
  };

  const handleNext = async () => {
    if (!scenario) return;
    if (currentStep >= scenario.steps.length - 1) {
      try {
        await learnerApiFetch(`/api/scenarios/${scenarioId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ choices: results }),
        });
      } catch {
        /* no-op */
      }
      setFinished(true);
    } else {
      setCurrentStep((s) => s + 1);
      setSelectedChoice(null);
      setFeedback(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4 space-y-4 animate-pulse">
        <div className="h-6 w-64 rounded bg-ink/10" />
        <div className="h-40 rounded-2xl bg-ink/5" />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="mx-auto max-w-2xl p-4 text-center py-20">
        <p className="text-muted">Không tìm thấy tình huống.</p>
      </div>
    );
  }

  // Finished — show summary
  if (finished) {
    const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
    const maxPossible = scenario.steps.length * 10;
    const pct = Math.round((totalPoints / maxPossible) * 100);
    const optimal = results.filter((r) => r.isOptimal).length;

    return (
      <div className="mx-auto max-w-2xl p-4">
        <div className="rounded-2xl border border-ink/8 bg-surface p-6 shadow-sm text-center">
          <p className="text-4xl">
            {pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪"}
          </p>
          <h2 className="mt-3 text-lg font-black text-ink">
            {scenario.titleVi}
          </h2>
          <p className="mt-2 text-2xl font-black text-[var(--color-matcha)]">
            {totalPoints}/{maxPossible} điểm
          </p>
          <p className="mt-1 text-sm text-muted">
            {optimal}/{scenario.steps.length} câu tối ưu · {pct}%
          </p>

          <div className="mt-6 space-y-2 text-left">
            {results.map((r, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl p-3 text-xs",
                  r.isOptimal
                    ? "bg-[var(--color-matcha)]/10"
                    : "bg-[var(--color-sakura)]/10",
                )}
              >
                <span className="font-bold">Bước {r.stepOrder}:</span>{" "}
                {r.feedbackVi}
                <span className="ml-2 font-bold">+{r.points}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={() => {
                setCurrentStep(0);
                setResults([]);
                setFinished(false);
                setSelectedChoice(null);
                setFeedback(null);
              }}
              className="rounded-xl bg-[var(--color-matcha)] px-6 py-2.5 text-sm font-bold text-white"
            >
              Chơi lại
            </button>
            <button
              onClick={() => router.push(`/${locale}/scenarios`)}
              className="rounded-xl border border-ink/15 px-6 py-2.5 text-sm font-medium text-muted"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const step = scenario.steps[currentStep];

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-ink">{scenario.titleVi}</h2>
        <span className="text-xs text-muted">
          Bước {currentStep + 1}/{scenario.steps.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-ink/10 mb-4">
        <div
          className="h-full rounded-full bg-[var(--color-matcha)] transition-all duration-300"
          style={{
            width: `${((currentStep + 1) / scenario.steps.length) * 100}%`,
          }}
        />
      </div>

      {/* Situation */}
      <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm">
        {step.speakerName && (
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-full bg-ink/10 flex items-center justify-center text-sm">
              {step.speakerRole === "Narrator" ? "📋" : "👤"}
            </div>
            <div>
              <span className="text-xs font-bold text-ink">
                {step.speakerName}
              </span>
              {step.speakerRole && step.speakerRole !== "Narrator" && (
                <span className="ml-1 text-[10px] text-muted">
                  · {step.speakerRole}
                </span>
              )}
            </div>
          </div>
        )}

        <p className="text-sm text-ink leading-[1.8]">{step.situationVi}</p>
        {step.situationJa && (
          <p className="mt-2 text-xs text-muted leading-[1.8] italic">
            {step.situationJa}
          </p>
        )}
      </div>

      {/* Choices */}
      <div className="mt-4 space-y-2">
        {step.choices.map((c) => {
          let choiceStyle = "border-ink/10 bg-paper hover:bg-ink/5";
          if (selectedChoice === c.choiceKey && feedback) {
            choiceStyle = feedback.isOptimal
              ? "border-[var(--color-matcha)] bg-[var(--color-matcha)]/10"
              : "border-[var(--color-sakura)] bg-[var(--color-sakura)]/10";
          }

          return (
            <button
              key={c.choiceKey}
              disabled={!!selectedChoice}
              onClick={() => void handleChoice(step, c.choiceKey)}
              className={cn(
                "w-full rounded-xl border p-3 text-left text-sm transition-all",
                choiceStyle,
                !selectedChoice && "active:scale-[0.98]",
              )}
            >
              <span className="font-bold text-ink/40 mr-2">
                {c.choiceKey}.
              </span>
              <span className="text-ink">{c.textVi}</span>
              {c.textJa && (
                <p className="mt-1 text-xs text-muted">{c.textJa}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={cn(
            "mt-4 rounded-xl p-3 text-sm animate-in fade-in slide-in-from-bottom-2",
            feedback.isOptimal
              ? "bg-[var(--color-matcha)]/10 border border-[var(--color-matcha)]/20"
              : "bg-[var(--color-sakura)]/10 border border-[var(--color-sakura)]/20",
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span>{feedback.isOptimal ? "✅" : "💡"}</span>
            <span className="font-bold text-xs">
              {feedback.isOptimal ? "Tuyệt vời!" : "Chưa tối ưu"} (+
              {feedback.pointsAwarded} điểm)
            </span>
          </div>
          {feedback.feedbackVi && (
            <p className="text-xs text-muted">{feedback.feedbackVi}</p>
          )}
        </div>
      )}

      {/* Next button */}
      {feedback && (
        <button
          onClick={() => void handleNext()}
          className="mt-4 w-full rounded-xl bg-[var(--color-matcha)] py-3 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.97]"
        >
          {currentStep >= scenario.steps.length - 1
            ? "Xem kết quả"
            : "Tiếp tục →"}
        </button>
      )}
    </div>
  );
}
