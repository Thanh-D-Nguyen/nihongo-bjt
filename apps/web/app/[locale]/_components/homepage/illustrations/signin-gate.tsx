/** Torii gate illustration for sign-in prompt. */

import type { SVGProps } from "react";

export function ToriiGate(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Path / ground */}
      <path d="M20 72 Q40 68 60 72" fill="none" stroke="#E2E8F0" strokeLinecap="round" strokeWidth="1.5" />

      {/* Left pillar */}
      <rect fill="#3B82F6" height="40" opacity="0.7" rx="2" width="5" x="24" y="32" />
      {/* Right pillar */}
      <rect fill="#3B82F6" height="40" opacity="0.7" rx="2" width="5" x="51" y="32" />

      {/* Top beam (kasagi) — curved */}
      <path d="M18 30 Q40 24 62 30" fill="none" stroke="#3B82F6" strokeLinecap="round" strokeWidth="4" />

      {/* Secondary beam (nuki) */}
      <rect fill="#3B82F6" height="3" opacity="0.6" rx="1" width="28" x="26" y="38" />

      {/* Decorative center tablet (gakuzuka) */}
      <rect fill="#DBEAFE" height="6" rx="1" width="10" x="35" y="34" />

      {/* Small sakura blossoms around */}
      <circle cx="16" cy="26" fill="#F9A8D4" opacity="0.3" r="2" />
      <circle cx="66" cy="28" fill="#F9A8D4" opacity="0.25" r="1.5" />
      <circle cx="70" cy="22" fill="#F9A8D4" opacity="0.2" r="1" />
      <circle cx="12" cy="32" fill="#F9A8D4" opacity="0.15" r="1.5" />

      {/* Subtle path leading through */}
      <path d="M36 72 L38 56 M44 72 L42 56" stroke="#CBD5E1" strokeLinecap="round" strokeWidth="0.8" />
    </svg>
  );
}
