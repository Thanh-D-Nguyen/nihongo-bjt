"use client";

interface RadialProgressProps {
  /** 0–100 */
  value: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  colorClass?: string;
}

/**
 * Animated SVG radial progress ring.
 * Uses CSS transition for smooth fill animation on mount.
 */
export function RadialProgress({
  value,
  label,
  size = 80,
  strokeWidth = 7,
  colorClass = "stroke-accent"
}: RadialProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="radial-progress-ring -rotate-90"
          width={size}
          height={size}
          aria-label={`${label}: ${value}%`}
          role="img"
        >
          <circle
            className="stroke-ink/8 dark:stroke-ink/15"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
          />
          <circle
            className={`${colorClass} transition-[stroke-dashoffset] duration-1000 ease-out`}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ willChange: "stroke-dashoffset" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-ink">
          {value}%
        </span>
      </div>
      <span className="text-[11px] font-semibold text-muted text-center leading-tight">
        {label}
      </span>
    </div>
  );
}
