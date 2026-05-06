/** NihonGo BJT brand mark — 日+N monogram */

export function BrandLogo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 32 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Gradient container */}
      <defs>
        <linearGradient id="brand-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect fill="url(#brand-bg)" height="32" rx="8" width="32" />
      {/* 日 character stylized — top box, middle bar, bottom box */}
      <rect fill="none" height="18" rx="2" stroke="#fff" strokeWidth="2" width="12" x="10" y="7" />
      <line stroke="#fff" strokeWidth="2" x1="10" x2="22" y1="16" y2="16" />
      {/* N stroke accent — left diagonal */}
      <line stroke="#fff" strokeLinecap="round" strokeWidth="2.5" x1="7" x2="7" y1="8" y2="24" />
      <line stroke="#fff" strokeLinecap="round" strokeOpacity="0.7" strokeWidth="2" x1="7" x2="13" y1="8" y2="16" />
    </svg>
  );
}

export function BrandFull({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <BrandLogo size={30} />
      <span className="text-base font-extrabold tracking-tight text-ink">
        NihonGo<span className="ml-0.5 text-sm font-bold text-emerald-600">BJT</span>
      </span>
    </span>
  );
}
