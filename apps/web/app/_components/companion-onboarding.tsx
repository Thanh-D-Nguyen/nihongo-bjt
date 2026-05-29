"use client";

export type CompanionOnboardingLabels = {
  step1Title: string;
  step1Body: string;
  step2Title: string;
  step2Body: string;
  step3Title: string;
  step3Body: string;
  next: string;
  skip: string;
  finish: string;
};

const STEP_EMOJIS = ["🐕", "📚", "🚀"];

export function CompanionOnboarding({
  currentStep,
  labels,
  onAdvance,
  onDismiss,
}: {
  currentStep: number;
  labels: CompanionOnboardingLabels;
  onAdvance: () => void;
  onDismiss: () => void;
}) {
  if (currentStep < 0 || currentStep > 2) return null;

  const steps = [
    { title: labels.step1Title, body: labels.step1Body },
    { title: labels.step2Title, body: labels.step2Body },
    { title: labels.step3Title, body: labels.step3Body },
  ];

  const step = steps[currentStep];
  if (!step) return null;

  const isLast = currentStep === 2;

  return (
    <div
      className="pointer-events-auto motion-safe:animate-[panelSlideUp_0.3s_ease-out_both] absolute bottom-full right-0 z-10 mb-3 w-[min(20rem,calc(100vw-2rem))]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-2xl">
        {/* Step indicator */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? "w-6 bg-amber-500"
                    : i < currentStep
                      ? "w-1.5 bg-amber-400"
                      : "w-1.5 bg-amber-200"
                }`}
                key={i}
              />
            ))}
          </div>
          <button
            className="min-h-[44px] min-w-[44px] px-2 text-[11px] font-medium text-muted transition active:scale-95 hover:text-ink"
            onClick={onDismiss}
            type="button"
          >
            {labels.skip}
          </button>
        </div>

        {/* Content */}
        <div className="mb-4 flex gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm">
            {STEP_EMOJIS[currentStep]}
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">{step.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">{step.body}</p>
          </div>
        </div>

        {/* Action */}
        <button
          className="flex min-h-9 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 text-xs font-bold text-white shadow-md transition hover:shadow-lg active:scale-[0.98]"
          onClick={onAdvance}
          type="button"
        >
          {isLast ? labels.finish : labels.next}
        </button>

        {/* Tail */}
        <div className="absolute -bottom-[6px] right-8 h-3 w-3 rotate-45 border-b border-r border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50" />
      </div>
    </div>
  );
}
