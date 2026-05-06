import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-surface shadow-sm hover:bg-ink/90",
  secondary:
    "border border-ink/12 bg-surface text-ink shadow-sm hover:border-accent/25 hover:bg-accent/5",
  ghost: "text-muted hover:bg-ink/5 hover:text-ink",
  danger: "border border-sakura/25 bg-sakura/8 text-sakura hover:bg-sakura/12"
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-lg px-3 text-xs",
  md: "min-h-11 rounded-xl px-4 text-sm",
  lg: "min-h-12 rounded-xl px-5 text-sm"
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
    "inline-flex items-center justify-center gap-2 font-semibold outline-none ring-offset-2 ring-offset-paper transition focus-visible:ring-2 focus-visible:ring-accent/45 disabled:pointer-events-none disabled:opacity-45",
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
