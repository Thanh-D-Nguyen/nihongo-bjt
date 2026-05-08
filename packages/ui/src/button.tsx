import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[#1B2A4A] text-white shadow-sm hover:bg-[#243560]",
  secondary:
    "border border-[#E2E8F0] bg-white text-[#111827] shadow-sm hover:border-[#CBD5E1] hover:bg-[#F8FAFC]",
  ghost: "text-[#4B5563] hover:bg-[#F1F5F9] hover:text-[#111827]",
  danger: "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-[10px] px-3 text-xs",
  md: "min-h-10 rounded-[10px] px-4 text-sm",
  lg: "min-h-11 rounded-[10px] px-5 text-sm"
};

export function buttonClassName({
  className,
  size = "md",
  variant = "primary"
}: {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold outline-none ring-offset-2 ring-offset-white transition-all duration-150 focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className
  );
}

export function Button({
  className,
  size,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return <button className={buttonClassName({ className, size, variant })} {...props} />;
}

export function ButtonLink({
  className,
  children,
  size,
  variant,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <a className={buttonClassName({ className, size, variant })} {...props}>
      {children}
    </a>
  );
}
