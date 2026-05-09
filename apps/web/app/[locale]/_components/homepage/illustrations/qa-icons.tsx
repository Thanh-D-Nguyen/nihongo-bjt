/** Quick Action illustration icons — richer than simple stroke icons. */

import type { SVGProps } from "react";

export function QaFlashcard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Back card */}
      <rect fill="currentColor" height="28" opacity="0.15" rx="4" width="24" x="16" y="6" />
      {/* Front card */}
      <rect fill="currentColor" height="28" opacity="0.3" rx="4" width="24" x="10" y="10" />
      {/* Active card */}
      <rect fill="currentColor" height="28" rx="5" width="26" x="6" y="14" />
      {/* Japanese character on card */}
      <text
        dominantBaseline="middle"
        fill="white"
        fontFamily="serif"
        fontSize="14"
        fontWeight="bold"
        textAnchor="middle"
        x="19"
        y="29"
      >
        語
      </text>
    </svg>
  );
}

export function QaBjt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Document */}
      <rect fill="currentColor" height="32" rx="4" width="26" x="11" y="8" />
      {/* Header line */}
      <rect fill="white" height="3" opacity="0.8" rx="1" width="16" x="16" y="14" />
      {/* Content lines */}
      <rect fill="white" height="2" opacity="0.4" rx="0.5" width="18" x="15" y="22" />
      <rect fill="white" height="2" opacity="0.4" rx="0.5" width="14" x="15" y="27" />
      <rect fill="white" height="2" opacity="0.4" rx="0.5" width="16" x="15" y="32" />
      {/* BJT stamp */}
      <circle cx="30" cy="34" fill="white" opacity="0.2" r="6" />
      <text
        dominantBaseline="middle"
        fill="white"
        fontSize="5"
        fontWeight="bold"
        opacity="0.7"
        textAnchor="middle"
        x="30"
        y="34"
      >
        BJT
      </text>
    </svg>
  );
}

export function QaBattle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Lightning bolt */}
      <path
        d="M28 6 L18 22 L24 22 L20 42 L34 20 L26 20 Z"
        fill="currentColor"
      />
      {/* Spark effects */}
      <circle cx="12" cy="18" fill="white" opacity="0.4" r="1.5" />
      <circle cx="38" cy="30" fill="white" opacity="0.3" r="1" />
      <circle cx="36" cy="14" fill="white" opacity="0.25" r="1.5" />
      <line opacity="0.3" stroke="white" strokeLinecap="round" strokeWidth="1.5" x1="8" x2="12" y1="28" y2="26" />
      <line opacity="0.2" stroke="white" strokeLinecap="round" strokeWidth="1.5" x1="40" x2="36" y1="22" y2="24" />
    </svg>
  );
}

export function QaSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Magnifying glass */}
      <circle cx="22" cy="22" fill="currentColor" opacity="0.2" r="12" />
      <circle cx="22" cy="22" fill="none" r="10" stroke="currentColor" strokeWidth="3" />
      {/* Handle */}
      <line stroke="currentColor" strokeLinecap="round" strokeWidth="3.5" x1="30" x2="40" y1="30" y2="40" />
      {/* Kanji inside lens */}
      <text
        dominantBaseline="middle"
        fill="currentColor"
        fontFamily="serif"
        fontSize="11"
        fontWeight="bold"
        opacity="0.8"
        textAnchor="middle"
        x="22"
        y="23"
      >
        漢
      </text>
    </svg>
  );
}

export function QaStandup(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Building body */}
      <rect fill="currentColor" height="24" rx="3" width="30" x="9" y="18" />
      {/* Roof bar */}
      <rect fill="currentColor" height="4" opacity="0.6" rx="2" width="34" x="7" y="14" />
      {/* Windows row 1 */}
      <rect fill="white" height="4" opacity="0.45" rx="1" width="5" x="13" y="23" />
      <rect fill="white" height="4" opacity="0.45" rx="1" width="5" x="22" y="23" />
      <rect fill="white" height="4" opacity="0.45" rx="1" width="5" x="31" y="23" />
      {/* Door */}
      <rect fill="white" height="8" opacity="0.65" rx="1.5" width="7" x="20" y="34" />
      {/* 出 character above roof */}
      <text dominantBaseline="middle" fill="currentColor" fontFamily="serif" fontSize="9" fontWeight="bold" opacity="0.85" textAnchor="middle" x="24" y="11">
        出
      </text>
    </svg>
  );
}

export function QaReviewInbox(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Notebook cover */}
      <rect fill="currentColor" height="32" rx="4" width="26" x="11" y="8" />
      {/* Spine */}
      <rect fill="currentColor" height="32" opacity="0.45" rx="2.5" width="5" x="11" y="8" />
      {/* Text lines */}
      <rect fill="white" height="2" opacity="0.75" rx="0.5" width="14" x="19" y="18" />
      <rect fill="white" height="2" opacity="0.55" rx="0.5" width="12" x="19" y="24" />
      <rect fill="white" height="2" opacity="0.35" rx="0.5" width="10" x="19" y="30" />
      {/* 振 character */}
      <text dominantBaseline="middle" fill="white" fontFamily="serif" fontSize="7" fontWeight="bold" opacity="0.8" textAnchor="middle" x="25" y="13">
        振
      </text>
    </svg>
  );
}
