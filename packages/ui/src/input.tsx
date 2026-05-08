import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "./cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      className={cn(
        "min-h-10 w-full rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all duration-150 placeholder:text-[#9CA3AF] hover:border-[#CBD5E1] focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/15 disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
