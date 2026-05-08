/** Daruma mascot SVG — 5 visual states based on streak. */

import type { SVGProps } from "react";

export type DarumaState = "waiting" | "started" | "progressing" | "strong" | "complete";

export function getDarumaState(streakDays: number, allReviewsDone: boolean): DarumaState {
  if (allReviewsDone) return "complete";
  if (streakDays >= 7) return "strong";
  if (streakDays >= 3) return "progressing";
  if (streakDays >= 1) return "started";
  return "waiting";
}

export function DarumaMascot({
  state = "waiting",
  className,
  ...props
}: SVGProps<SVGSVGElement> & { state?: DarumaState }) {
  const hasLeftEye = state !== "waiting";
  const hasRightEye = state === "strong" || state === "complete";
  const hasFlame = state === "strong" || state === "complete";
  const hasGlow = state === "complete";

  return (
    <svg
      aria-hidden="true"
      className={`${hasFlame ? "motion-safe:animate-[daruma-bob_3s_ease-in-out_infinite]" : ""} ${className ?? ""}`}
      fill="none"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Golden glow for "complete" state */}
      {hasGlow && (
        <circle cx="32" cy="36" fill="#F59E0B" opacity="0.12" r="30">
          <animate attributeName="r" dur="3s" repeatCount="indefinite" values="28;31;28" />
          <animate attributeName="opacity" dur="3s" repeatCount="indefinite" values="0.12;0.06;0.12" />
        </circle>
      )}

      {/* Flame aura for strong/complete */}
      {hasFlame && (
        <g opacity="0.3">
          <path d="M20 18 Q22 10 26 14 Q24 6 28 10 Q30 4 32 12" fill="#F59E0B" opacity="0.5">
            <animate attributeName="d" dur="2s" repeatCount="indefinite" values="M20 18 Q22 10 26 14 Q24 6 28 10 Q30 4 32 12;M20 16 Q22 8 26 12 Q24 4 28 8 Q30 2 32 10;M20 18 Q22 10 26 14 Q24 6 28 10 Q30 4 32 12" />
          </path>
          <path d="M44 18 Q42 10 38 14 Q40 6 36 10 Q34 4 32 12" fill="#F59E0B" opacity="0.5">
            <animate attributeName="d" dur="2.2s" repeatCount="indefinite" values="M44 18 Q42 10 38 14 Q40 6 36 10 Q34 4 32 12;M44 16 Q42 8 38 12 Q40 4 36 8 Q34 2 32 10;M44 18 Q42 10 38 14 Q40 6 36 10 Q34 4 32 12" />
          </path>
        </g>
      )}

      {/* Body — round daruma shape */}
      <ellipse cx="32" cy="40" fill="#DC2626" rx="22" ry="20" />
      <ellipse cx="32" cy="40" fill="#EF4444" rx="20" ry="18" />

      {/* Face area — white */}
      <ellipse cx="32" cy="36" fill="#FFF7ED" rx="14" ry="12" />
      <ellipse cx="32" cy="36" fill="white" rx="12" ry="10" />

      {/* Left eye */}
      {hasLeftEye ? (
        <circle cx="27" cy="35" fill="#1B2A4A" r="2.5" />
      ) : (
        <circle cx="27" cy="35" fill="none" r="2.5" stroke="#D1D5DB" strokeDasharray="2 1.5" strokeWidth="0.8" />
      )}

      {/* Right eye */}
      {hasRightEye ? (
        <circle cx="37" cy="35" fill="#1B2A4A" r="2.5" />
      ) : (
        <circle cx="37" cy="35" fill="none" r="2.5" stroke="#D1D5DB" strokeDasharray="2 1.5" strokeWidth="0.8" />
      )}

      {/* Mouth — changes with state */}
      {state === "waiting" ? (
        <line stroke="#9CA3AF" strokeLinecap="round" strokeWidth="1.2" x1="29" x2="35" y1="41" y2="41" />
      ) : state === "started" ? (
        <path d="M29 40 Q32 42 35 40" fill="none" stroke="#1B2A4A" strokeLinecap="round" strokeWidth="1" />
      ) : (
        <path d="M28 40 Q32 44 36 40" fill="none" stroke="#1B2A4A" strokeLinecap="round" strokeWidth="1.2" />
      )}

      {/* Eyebrows */}
      <path d="M23 31 Q27 29 30 31" fill="none" stroke="#92400E" strokeLinecap="round" strokeWidth="1.2" />
      <path d="M34 31 Q37 29 41 31" fill="none" stroke="#92400E" strokeLinecap="round" strokeWidth="1.2" />

      {/* Gold wish band */}
      <path d="M14 48 Q32 54 50 48" fill="none" stroke="#F59E0B" strokeLinecap="round" strokeWidth="2" />

      {/* 福 character on forehead */}
      <text
        dominantBaseline="middle"
        fill="#92400E"
        fontFamily="serif"
        fontSize="7"
        fontWeight="bold"
        opacity="0.7"
        textAnchor="middle"
        x="32"
        y="28"
      >
        福
      </text>

      {/* Bottom flat base */}
      <ellipse cx="32" cy="58" fill="#B91C1C" opacity="0.6" rx="16" ry="3" />
    </svg>
  );
}
