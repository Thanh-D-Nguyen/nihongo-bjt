"use client";

import { cn } from "./cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  id?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  id,
}: ToggleProps) {
  const toggleId = id ?? `toggle-${label?.replace(/\s+/g, "-").toLowerCase() ?? "default"}`;

  return (
    <label
      className={cn(
        "group flex cursor-pointer items-center justify-between gap-4 rounded-xl px-1 py-2 transition-colors",
        disabled && "pointer-events-none opacity-50"
      )}
      htmlFor={toggleId}
    >
      <div className="min-w-0 select-none">
        {label && (
          <span className="block text-sm font-medium text-ink">{label}</span>
        )}
        {description && (
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        )}
      </div>
      <button
        aria-checked={checked}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2",
          checked ? "bg-accent" : "bg-ink/15"
        )}
        disabled={disabled}
        id={toggleId}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block size-4 rounded-full bg-surface shadow-sm ring-0 transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </label>
  );
}
