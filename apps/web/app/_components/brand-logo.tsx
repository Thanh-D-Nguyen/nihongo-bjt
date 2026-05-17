/** NihonGo BJT brand mark — a study card, 日 frame, and rising N path. */

const brandGradientId = "nihongo-brand-bg";
const accentGradientId = "nihongo-brand-accent";

export function BrandLogo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 64 64"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={brandGradientId} x1="8" y1="6" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F172A" />
          <stop offset="0.55" stopColor="#12322F" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id={accentGradientId} x1="17" y1="46" x2="48" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5EEAD4" />
          <stop offset="1" stopColor="#F9A8D4" />
        </linearGradient>
        <filter id="nihongo-brand-shadow" x="6" y="6" width="52" height="52" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" floodColor="#020617" floodOpacity="0.24" stdDeviation="3" />
        </filter>
      </defs>
      <rect fill={`url(#${brandGradientId})`} height="58" rx="16" width="58" x="3" y="3" />
      <path d="M14 49.5C20.4 45.1 25.6 39.4 29.8 32.3C34.4 24.6 40.1 19.1 47 15.8" stroke={`url(#${accentGradientId})`} strokeLinecap="round" strokeWidth="5.4" />
      <g filter="url(#nihongo-brand-shadow)">
        <rect height="34" rx="5" stroke="#F8FAFC" strokeWidth="4" width="25" x="20" y="15" />
        <path d="M21.5 27.5H43.5M21.5 37.5H43.5" stroke="#F8FAFC" strokeLinecap="round" strokeWidth="3.4" />
      </g>
      <circle cx="48.5" cy="15.5" fill="#F472B6" r="4.2" />
      <path d="M16 16.5V47.5" stroke="#F8FAFC" strokeLinecap="round" strokeOpacity="0.82" strokeWidth="4" />
    </svg>
  );
}

export function BrandFull({
  className,
  markSize = 32,
  tone = "default"
}: {
  className?: string;
  markSize?: number;
  tone?: "default" | "light";
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <BrandLogo size={markSize} />
      <span className={tone === "light" ? "text-base font-black tracking-tight text-white" : "text-base font-black tracking-tight text-ink"}>
        NihonGo
        <span className={tone === "light" ? "ml-1 text-sm font-black text-teal-100" : "ml-1 text-sm font-black text-teal-700"}>
          BJT
        </span>
      </span>
    </span>
  );
}
