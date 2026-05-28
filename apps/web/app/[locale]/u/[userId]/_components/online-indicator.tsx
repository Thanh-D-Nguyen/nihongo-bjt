"use client";

interface Props {
  label: string;
  online: boolean;
  className?: string;
}

/**
 * Reusable online status indicator dot.
 * Shows green pulse when online, gray when offline.
 */
export function OnlineIndicator({ label, online, className = "" }: Props) {
  return (
    <span
      className={`
        inline-block rounded-full
        ${online
          ? "bg-leaf shadow-[0_0_6px_rgba(5,150,105,0.5)]"
          : "bg-muted/40"
        }
        ${className}
      `}
      aria-label={label}
      role="status"
    >
      {online && (
        <span className="absolute inset-0 rounded-full bg-leaf animate-ping opacity-40" />
      )}
    </span>
  );
}
