"use client";

import type { GameTypeRoundProps } from "./shared-props";

/**
 * Business Roleplay: Scenario-based MC.
 * Shows a business context frame (meeting/email/phone) above the question.
 * Answers are "best professional response" style.
 */
export function BusinessRoleplayRound({
  answerPending,
  answerResult,
  canAnswer,
  onSubmitAnswer,
  round,
  selectedOptionKey
}: GameTypeRoundProps) {
  // Derive scenario type from skillTag
  const scenarioType = deriveScenarioType(round.question.skillTag);

  return (
    <div className="space-y-4">
      {/* Scenario header */}
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>{scenarioType.icon}</span>
        <span className="text-xs font-black uppercase text-emerald-700">{scenarioType.label}</span>
      </div>

      {/* Scenario context frame */}
      <div className={`rounded-2xl border-2 ${scenarioType.borderClass} overflow-hidden`}>
        {/* Frame header */}
        <div className={`flex items-center gap-2 px-4 py-2.5 ${scenarioType.headerBg}`}>
          <span className="text-sm" aria-hidden>{scenarioType.frameIcon}</span>
          <span className="text-xs font-bold text-white/90">{scenarioType.frameTitle}</span>
          <div className="ml-auto flex gap-1">
            <div className="h-2 w-2 rounded-full bg-white/30" />
            <div className="h-2 w-2 rounded-full bg-white/30" />
            <div className="h-2 w-2 rounded-full bg-white/50" />
          </div>
        </div>
        {/* Frame body — the scenario prompt */}
        <div className="bg-white/95 p-4">
          <p className="text-sm font-medium leading-6 text-ink whitespace-pre-line">
            {round.question.prompt}
          </p>
        </div>
      </div>

      {/* Question: "What is the best response?" */}
      <p className="text-xs font-black text-emerald-700 uppercase tracking-wide">
        Choose the best professional response:
      </p>

      {/* Options styled as response choices */}
      <div className="space-y-2">
        {round.question.options.map((option, idx) => {
          const picked = selectedOptionKey === option.optionKey;
          const correct = answerResult?.correctOptionKey === option.optionKey;
          const wrong = picked && answerResult && !answerResult.userCorrect;
          const letter = String.fromCharCode(65 + idx);
          return (
            <button
              key={option.optionKey}
              className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                correct
                  ? "border-leaf/40 bg-leaf/10 ring-2 ring-leaf/20"
                  : wrong
                    ? "border-red-300 bg-red-50 ring-2 ring-red-200"
                    : picked
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-ink/10 bg-white hover:border-emerald-200 hover:bg-emerald-50/30 active:scale-[0.98]"
              } ${answerPending || answerResult ? "pointer-events-none" : ""}`}
              disabled={!canAnswer}
              onClick={() => onSubmitAnswer(option.optionKey)}
              type="button"
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${
                correct
                  ? "bg-leaf text-white"
                  : wrong
                    ? "bg-red-500 text-white"
                    : picked
                      ? "bg-emerald-500 text-white"
                      : "bg-ink/5 text-muted"
              }`}>
                {letter}
              </span>
              <span className="text-sm font-semibold leading-5 text-ink">
                {option.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function deriveScenarioType(skillTag: string) {
  const tag = skillTag.toLowerCase();
  if (tag.includes("email") || tag.includes("mail")) {
    return {
      borderClass: "border-blue-200",
      frameIcon: "📧",
      frameTitle: "Business Email",
      headerBg: "bg-gradient-to-r from-blue-600 to-blue-500",
      icon: "📧",
      label: "Email Response"
    };
  }
  if (tag.includes("phone") || tag.includes("call")) {
    return {
      borderClass: "border-green-200",
      frameIcon: "📞",
      frameTitle: "Phone Conversation",
      headerBg: "bg-gradient-to-r from-green-600 to-green-500",
      icon: "📞",
      label: "Phone Etiquette"
    };
  }
  if (tag.includes("present")) {
    return {
      borderClass: "border-purple-200",
      frameIcon: "📊",
      frameTitle: "Presentation",
      headerBg: "bg-gradient-to-r from-purple-600 to-purple-500",
      icon: "📊",
      label: "Presentation"
    };
  }
  // Default: meeting
  return {
    borderClass: "border-emerald-200",
    frameIcon: "🏢",
    frameTitle: "Business Meeting",
    headerBg: "bg-gradient-to-r from-emerald-600 to-teal-500",
    icon: "💼",
    label: "Business Scenario"
  };
}
