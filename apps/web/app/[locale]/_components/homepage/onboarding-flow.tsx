"use client";

import { cn } from "@nihongo-bjt/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { learnerApiFetch } from "../../../../lib/learner-api";
import { OnboardingDiagnostic } from "./onboarding-diagnostic";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingOptionCopy {
  label: string;
  desc: string;
}

export interface OnboardingFlowLabels {
  dialogAria: string;
  stepCounter: string;
  recommendedBadge: string;
  back: string;
  next: string;
  finishStartReview: string;
  saving: string;
  skip: string;
  saveError: string;
  steps: {
    goalTitle: string;
    goalSubtitle: string;
    levelTitle: string;
    levelSubtitle: string;
    diagnosticTitle: string;
    diagnosticSubtitle: string;
    timeTitle: string;
    timeSubtitle: string;
  };
  goals: {
    pass_bjt: OnboardingOptionCopy;
    business_japanese: OnboardingOptionCopy;
    daily_conversation: OnboardingOptionCopy;
    reading_news: OnboardingOptionCopy;
    jlpt_prep: OnboardingOptionCopy;
  };
  levels: {
    n5: OnboardingOptionCopy;
    n4: OnboardingOptionCopy;
    n3: OnboardingOptionCopy;
    n2: OnboardingOptionCopy;
    n1: OnboardingOptionCopy;
    unknown: OnboardingOptionCopy;
  };
  times: {
    m5: OnboardingOptionCopy;
    m10: OnboardingOptionCopy;
    m20: OnboardingOptionCopy;
    m30: OnboardingOptionCopy;
  };
}

export interface OnboardingFlowProps {
  labels: OnboardingFlowLabels;
  locale: string;
  onComplete: (didComplete?: boolean) => void;
}

type Step = "goal" | "level" | "diagnostic" | "time";

interface Answers {
  currentLevel: number;
  goal: string;
  dailyMinutes: number;
}

// ─── Focused BJT/work option metadata ────────────────────────────────────────

const GOAL_ITEMS: Array<{ value: keyof OnboardingFlowLabels["goals"]; emoji: string }> = [
  { value: "pass_bjt", emoji: "🏆" },
  { value: "business_japanese", emoji: "💼" },
  { value: "daily_conversation", emoji: "🗣️" },
  { value: "reading_news", emoji: "📰" },
  { value: "jlpt_prep", emoji: "📝" }
];

const LEVEL_ITEMS: Array<{ value: number; key: keyof OnboardingFlowLabels["levels"]; emoji: string }> = [
  { value: 5, key: "n5", emoji: "🌱" },
  { value: 4, key: "n4", emoji: "📗" },
  { value: 3, key: "n3", emoji: "📘" },
  { value: 2, key: "n2", emoji: "📙" },
  { value: 1, key: "n1", emoji: "🎓" },
  { value: 0, key: "unknown", emoji: "🤔" }
];

const TIME_ITEMS: Array<{
  value: number;
  key: keyof OnboardingFlowLabels["times"];
  emoji: string;
  recommended?: boolean;
}> = [
  { value: 5, key: "m5", emoji: "⚡" },
  { value: 10, key: "m10", emoji: "⏰", recommended: true },
  { value: 20, key: "m20", emoji: "🔥" },
  { value: 30, key: "m30", emoji: "🚀" }
];

/**
 * 3 focused steps: (1) Goal -> (2) Current Level (+ optional 5-Q diagnostic) -> (3) Daily pace & launch first review.
 * Removed steps (`topics`, `style`) are preserved as backward-compatible defaults on submit.
 */
const BASE_STEPS: Step[] = ["goal", "level", "time"];

// ─── Component ────────────────────────────────────────────────────────────────

export function OnboardingFlow({ labels, locale, onComplete }: OnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("goal");
  const [answers, setAnswers] = useState<Answers>({
    currentLevel: -1,
    goal: "",
    dailyMinutes: 10
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const skipOnboarding = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const response = await learnerApiFetch("/api/recommendation/onboarding/skip", {
        method: "POST"
      });
      if (!response.ok) throw new Error(`skip_onboarding:${response.status}`);
      onComplete(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [onComplete, saving]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) void skipOnboarding();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [saving, skipOnboarding]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const displayStepIndex =
    step === "goal" ? 0 : step === "level" || step === "diagnostic" ? 1 : 2;
  const totalSteps = BASE_STEPS.length;
  const progress = ((displayStepIndex + 1) / totalSteps) * 100;

  const canProceed = useCallback(() => {
    switch (step) {
      case "goal":
        return answers.goal !== "";
      case "level":
        return answers.currentLevel >= 0;
      case "diagnostic":
        return false;
      case "time":
        return answers.dailyMinutes > 0;
    }
  }, [step, answers]);

  const next = useCallback(async () => {
    if (step === "goal") {
      setStep("level");
      return;
    }
    if (step === "level") {
      setStep(answers.currentLevel === 0 ? "diagnostic" : "time");
      return;
    }
    if (step !== "time") return;

    setSaving(true);
    setSaveError(false);
    try {
      const response = await learnerApiFetch("/api/recommendation/onboarding/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLevel: answers.currentLevel,
          goal: answers.goal,
          topics: [],
          dailyMinutes: answers.dailyMinutes,
          style: "mixed"
        })
      });
      if (!response.ok) throw new Error(`save_onboarding:${response.status}`);
      onComplete(true);
      router.push(`/${locale}/flashcards?tab=review`);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [step, answers, onComplete, router, locale]);

  const back = useCallback(() => {
    if (step === "level") setStep("goal");
    else if (step === "time") setStep("level");
  }, [step]);

  const handleDiagnosticComplete = useCallback((suggestedLevel: 5 | 4 | 3) => {
    setAnswers((prev) => ({ ...prev, currentLevel: suggestedLevel }));
    setStep("time");
  }, []);

  const handleDiagnosticSkip = useCallback(() => {
    setStep("time");
  }, []);

  const stepTitle =
    step === "goal"
      ? labels.steps.goalTitle
      : step === "level"
        ? labels.steps.levelTitle
        : step === "diagnostic"
          ? labels.steps.diagnosticTitle
          : labels.steps.timeTitle;

  const stepSubtitle =
    step === "goal"
      ? labels.steps.goalSubtitle
      : step === "level"
        ? labels.steps.levelSubtitle
        : step === "diagnostic"
          ? labels.steps.diagnosticSubtitle
          : labels.steps.timeSubtitle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={labels.dialogAria}
    >
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-3xl bg-surface shadow-2xl",
          !prefersReducedMotion && "animate-in fade-in slide-in-from-bottom-4 duration-300"
        )}
      >
        {/* Progress bar */}
        <div className="h-1.5 bg-ink/5">
          <div
            className="h-full rounded-r-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-6">
          {/* Header */}
          <div className="mb-6 text-center">
            <p className="mb-1 text-xs text-muted">
              {labels.stepCounter
                .replace("{current}", String(displayStepIndex + 1))
                .replace("{total}", String(totalSteps))}
            </p>
            <h2 className="text-lg font-bold text-ink">{stepTitle}</h2>
            <p className="mt-1 text-xs text-muted">{stepSubtitle}</p>
          </div>

          {saveError ? (
            <p
              className="mb-3 rounded-xl border border-sakura-strong/30 bg-sakura-soft px-3 py-2 text-xs font-medium text-sakura-strong"
              role="alert"
            >
              {labels.saveError}
            </p>
          ) : null}

          {/* Options */}
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {step === "goal" &&
              GOAL_ITEMS.map((item) => {
                const copy = labels.goals[item.value];
                return (
                  <OptionButton
                    key={item.value}
                    selected={answers.goal === item.value}
                    onClick={() => setAnswers((prev) => ({ ...prev, goal: item.value }))}
                    emoji={item.emoji}
                    label={copy.label}
                    desc={copy.desc}
                  />
                );
              })}

            {step === "level" &&
              LEVEL_ITEMS.map((item) => {
                const copy = labels.levels[item.key];
                return (
                  <OptionButton
                    key={item.value}
                    selected={answers.currentLevel === item.value}
                    onClick={() => setAnswers((prev) => ({ ...prev, currentLevel: item.value }))}
                    emoji={item.emoji}
                    label={copy.label}
                    desc={copy.desc}
                  />
                );
              })}

            {step === "diagnostic" && (
              <OnboardingDiagnostic
                onComplete={handleDiagnosticComplete}
                onSkip={handleDiagnosticSkip}
              />
            )}

            {step === "time" &&
              TIME_ITEMS.map((item) => {
                const copy = labels.times[item.key];
                return (
                  <OptionButton
                    key={item.value}
                    selected={answers.dailyMinutes === item.value}
                    onClick={() => setAnswers((prev) => ({ ...prev, dailyMinutes: item.value }))}
                    emoji={item.emoji}
                    label={copy.label}
                    desc={copy.desc}
                    recommended={item.recommended}
                    recommendedBadge={labels.recommendedBadge}
                  />
                );
              })}
          </div>

          {/* Navigation — hidden during diagnostic (component has its own nav) */}
          {step !== "diagnostic" && (
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={back}
                disabled={displayStepIndex === 0}
                type="button"
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-medium transition",
                  displayStepIndex === 0
                    ? "invisible"
                    : "text-muted hover:bg-ink/5 hover:text-ink"
                )}
              >
                {labels.back}
              </button>

              <button
                onClick={() => void next()}
                disabled={!canProceed() || saving}
                type="button"
                className={cn(
                  "rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition active:scale-[0.97]",
                  canProceed() && !saving
                    ? "bg-action text-white hover:bg-action-hover"
                    : "cursor-not-allowed bg-ink/10 text-muted"
                )}
              >
                {saving
                  ? labels.saving
                  : step === "time"
                    ? labels.finishStartReview
                    : labels.next}
              </button>
            </div>
          )}

          {/* Skip */}
          <div className="mt-3 text-center">
            <button
              disabled={saving}
              onClick={() => void skipOnboarding()}
              type="button"
              className="text-[11px] text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {labels.skip}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Option Button ────────────────────────────────────────────────────────────

function OptionButton({
  selected,
  onClick,
  emoji,
  label,
  desc,
  recommended,
  recommendedBadge
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  desc: string;
  recommended?: boolean;
  recommendedBadge?: string;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors duration-150",
        selected
          ? "border-accent bg-accent/10 shadow-sm"
          : "border-ink/8 bg-surface hover:border-ink/20"
      )}
    >
      <span className="text-xl" aria-hidden="true">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", selected ? "text-ink" : "text-ink/80")}>
            {label}
          </span>
          {recommended && recommendedBadge ? (
            <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-brand-accent">
              {recommendedBadge}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted">{desc}</p>
      </div>
      {selected ? (
        <div className="shrink-0" aria-hidden="true">
          <svg className="h-5 w-5 text-accent" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      ) : null}
    </button>
  );
}
