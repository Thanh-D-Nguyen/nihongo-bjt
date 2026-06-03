/** KotobaWorks brand mark — a minimal 言 frame with a work-path accent. */

const brandName = "KotobaWorks";

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
      <rect fill="#1B2A4A" height="58" rx="14" width="58" x="3" y="3" />
      <path
        d="M20 16H44M20 29H39M20 42H44"
        stroke="#F8FAFC"
        strokeLinecap="round"
        strokeWidth="4.4"
      />
      <path d="M20 16V48" stroke="#F8FAFC" strokeLinecap="round" strokeWidth="4.4" />
      <path d="M34 47L47 34" stroke="#3B82F6" strokeLinecap="round" strokeWidth="4.8" />
      <path
        d="M44 34H47V37"
        stroke="#F59E0B"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4.8"
      />
    </svg>
  );
}

export function BrandFull({
  className,
  labelClassName,
  markSize = 32,
  tone = "default"
}: {
  className?: string;
  labelClassName?: string;
  markSize?: number;
  tone?: "default" | "light";
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <BrandLogo size={markSize} />
      <span
        aria-label={brandName}
        className={`${tone === "light" ? "text-base font-semibold text-white" : "text-base font-semibold text-ink"}${
          labelClassName ? ` ${labelClassName}` : ""
        }`}
      >
        Kotoba
        <span className={tone === "light" ? "text-white/80" : "text-blue-700"}>Works</span>
      </span>
    </span>
  );
}
