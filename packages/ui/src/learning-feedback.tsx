import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type LearningFeedbackTone = "success" | "info" | "gentle";

const tones: Record<LearningFeedbackTone, string> = {
  success: "border-emerald-200/70 bg-emerald-50/60 text-emerald-950",
  info: "border-ink/10 bg-paper/90 text-ink",
  gentle: "border-indigo-200/60 bg-indigo-50/50 text-indigo-950"
};

/**
 * Calm inline feedback (quiz hints, daily actions) — avoid harsh “wrong/failed” styling.
 */
export function LearningFeedback({
  children,
  className,
  tone = "gentle",
  ...props
}: HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
  tone?: LearningFeedbackTone;
}) {
  return (
    <p
      className={cn(
        "rounded-xl border px-3 py-2 text-sm leading-relaxed",
        tones[tone],
        className
      )}
      role="status"
      {...props}
    >
      {children}
    </p>
  );
}
