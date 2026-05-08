import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type LearningFeedbackTone = "success" | "info" | "gentle";

const tones: Record<LearningFeedbackTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-[#E2E8F0] bg-[#F8FAFC] text-[#111827]",
  gentle: "border-blue-200 bg-blue-50 text-blue-800"
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
      className={cn("rounded-[10px] border px-3 py-2 text-sm leading-relaxed", tones[tone], className)}
      role="status"
      {...props}
    >
      {children}
    </p>
  );
}
