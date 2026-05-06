import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "./cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-xl border border-ink/10 bg-surface px-3 text-sm font-medium text-ink shadow-sm outline-none transition placeholder:text-muted/65 focus:border-accent/35 focus:ring-2 focus:ring-accent/15 disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
