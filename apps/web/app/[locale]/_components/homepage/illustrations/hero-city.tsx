/** City silhouette SVG for hero background — Tokyo/Osaka inspired skyline. */

import type { SVGProps } from "react";

export function HeroCitySilhouette(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 480 280"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Sky Tower / Tokyo Tower */}
      <path
        d="M240 20 L246 100 L248 160 L252 160 L254 100 L260 20 L250 15 Z"
        fill="currentColor"
        opacity="0.12"
      />
      <rect fill="currentColor" height="8" opacity="0.1" rx="1" width="24" x="238" y="95" />

      {/* Tall building left */}
      <rect fill="currentColor" height="140" opacity="0.08" rx="2" width="32" x="60" y="140" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="24" x="64" y="155" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="24" x="64" y="170" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="24" x="64" y="185" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="24" x="64" y="200" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="24" x="64" y="215" />

      {/* Medium building */}
      <rect fill="currentColor" height="100" opacity="0.07" rx="2" width="28" x="100" y="180" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="20" x="104" y="195" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="20" x="104" y="210" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="20" x="104" y="225" />

      {/* Short wide building */}
      <rect fill="currentColor" height="70" opacity="0.06" rx="2" width="40" x="135" y="210" />

      {/* Torii gate */}
      <g opacity="0.1">
        <rect fill="currentColor" height="60" rx="2" width="5" x="190" y="220" />
        <rect fill="currentColor" height="60" rx="2" width="5" x="220" y="220" />
        <rect fill="currentColor" height="6" rx="1" width="45" x="185" y="218" />
        <rect fill="currentColor" height="4" rx="1" width="38" x="189" y="228" />
      </g>

      {/* Right cluster — modern offices */}
      <rect fill="currentColor" height="120" opacity="0.09" rx="2" width="26" x="290" y="160" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="18" x="294" y="175" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="18" x="294" y="190" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="18" x="294" y="205" />

      <rect fill="currentColor" height="90" opacity="0.07" rx="2" width="30" x="322" y="190" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="22" x="326" y="205" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="22" x="326" y="220" />

      <rect fill="currentColor" height="150" opacity="0.08" rx="2" width="24" x="360" y="130" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="16" x="364" y="145" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="16" x="364" y="160" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="16" x="364" y="175" />
      <rect fill="currentColor" height="3" opacity="0.04" rx="0.5" width="16" x="364" y="190" />

      {/* Small buildings far right */}
      <rect fill="currentColor" height="60" opacity="0.06" rx="2" width="20" x="395" y="220" />
      <rect fill="currentColor" height="80" opacity="0.07" rx="2" width="22" x="420" y="200" />

      {/* Train track line at bottom */}
      <rect fill="currentColor" height="2" opacity="0.06" rx="1" width="480" x="0" y="276" />
      <rect fill="currentColor" height="1" opacity="0.04" rx="0.5" width="480" x="0" y="272" />

      {/* Train */}
      <g opacity="0.08">
        <rect fill="currentColor" height="12" rx="3" width="50" x="30" y="261" />
        <rect fill="currentColor" height="8" opacity="0.8" rx="1" width="8" x="36" y="263" />
        <rect fill="currentColor" height="8" opacity="0.8" rx="1" width="8" x="48" y="263" />
        <rect fill="currentColor" height="8" opacity="0.8" rx="1" width="8" x="60" y="263" />
      </g>

      {/* Cherry tree silhouette */}
      <g opacity="0.07">
        <rect fill="currentColor" height="30" rx="1" width="4" x="450" y="250" />
        <circle cx="452" cy="240" fill="currentColor" r="18" />
        <circle cx="440" cy="248" fill="currentColor" r="10" />
        <circle cx="464" cy="246" fill="currentColor" r="12" />
      </g>
    </svg>
  );
}
