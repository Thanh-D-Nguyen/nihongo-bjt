import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const defaults: IconProps = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.75 };

function icon(d: string, props: IconProps) {
  const s = props.size ?? 20;
  return (
    <svg {...defaults} {...props} height={s} viewBox="0 0 24 24" width={s}>
      <path d={d} />
    </svg>
  );
}

/** House — Home / Dashboard */
export function IconHome(p: IconProps) {
  return icon("M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z M9 21V14h6v7", p);
}

/** Clipboard with check — BJT Quiz */
export function IconQuiz(p: IconProps) {
  return icon("M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z M9 14l2 2 4-4", p);
}

/** Stacked cards — Flashcard Review */
export function IconReview(p: IconProps) {
  return icon("M4 7h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4 M4 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2 M4 7v12 M8 3h8a2 2 0 0 1 2 2v1", p);
}

/** Lightning — Battle */
export function IconBattle(p: IconProps) {
  return icon("M13 2L3 14h9l-1 8 10-12h-9l1-8z", p);
}

/** Magnifier — Search */
export function IconSearch(p: IconProps) {
  return icon("M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M21 21l-4.35-4.35", p);
}

/** Ribbon bookmark — Saved / list */
export function IconBookmark(p: IconProps) {
  return icon("M6 4h12a2 2 0 0 1 2 2v14l-8-4-8 4V6a2 2 0 0 1 2-2z", p);
}

/** Bar chart — Analytics / Progress */
export function IconAnalytics(p: IconProps) {
  return icon("M18 20V10 M12 20V4 M6 20v-6", p);
}

/** Gear — Settings */
export function IconSettings(p: IconProps) {
  return (
    <svg {...defaults} {...p} height={p.size ?? 20} viewBox="0 0 24 24" width={p.size ?? 20}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** Person in circle — Account hub */
export function IconUser(p: IconProps) {
  const s = p.size ?? 20;
  return (
    <svg {...defaults} {...p} height={s} viewBox="0 0 24 24" width={s}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/** Ellipsis horizontal — More menu */
export function IconMore(p: IconProps) {
  return (
    <svg {...defaults} {...p} height={p.size ?? 20} viewBox="0 0 24 24" width={p.size ?? 20}>
      <circle cx="12" cy="12" fill="currentColor" r="1.5" stroke="none" />
      <circle cx="5" cy="12" fill="currentColor" r="1.5" stroke="none" />
      <circle cx="19" cy="12" fill="currentColor" r="1.5" stroke="none" />
    </svg>
  );
}
