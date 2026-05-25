"use client";

import { cn } from "@nihongo-bjt/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type LocaleSwitcherLabels = {
  localeSwitcher: string;
  localeSwitcherAria: string;
  localeVi: string;
  localeJa: string;
  localeEn: string;
};

const LOCALES = [
  { code: "vi", flag: "🇻🇳" },
  { code: "ja", flag: "🇯🇵" },
  { code: "en", flag: "🇬🇧" },
] as const;

export function LocaleSwitcher({
  currentLocale,
  labels,
  variant = "icon",
}: {
  currentLocale: string;
  labels: LocaleSwitcherLabels;
  variant?: "icon" | "menu-item";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function switchLocale(newLocale: string) {
    if (newLocale === currentLocale) {
      setOpen(false);
      return;
    }
    // Replace current locale segment in path: /vi/dashboard → /ja/dashboard
    const newPath = pathname.replace(
      new RegExp(`^/${currentLocale}(/|$)`),
      `/${newLocale}$1`
    );
    setOpen(false);
    router.push(newPath);
  }

  const localeLabels: Record<string, string> = {
    vi: labels.localeVi,
    ja: labels.localeJa,
    en: labels.localeEn,
  };

  const currentFlag = LOCALES.find((l) => l.code === currentLocale)?.flag ?? "🌐";

  if (variant === "menu-item") {
    return (
      <div className="relative" ref={ref}>
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={labels.localeSwitcherAria}
          className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-paper hover:text-ink dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
          type="button"
          onClick={() => setOpen((v) => !v)}
        >
          <GlobeIcon />
          <span className="flex-1 text-left">{labels.localeSwitcher}</span>
          <span className="text-xs text-muted/60">{currentFlag} {currentLocale.toUpperCase()}</span>
        </button>
        {open && (
          <div
            className="absolute bottom-full left-0 z-50 mb-1 w-full overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-lg dark:border-white/10 dark:bg-[#1E293B]"
            role="listbox"
          >
            {LOCALES.map((loc) => (
              <button
                aria-selected={loc.code === currentLocale}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors",
                  loc.code === currentLocale
                    ? "bg-accent/8 text-accent"
                    : "text-ink hover:bg-paper dark:text-slate-200 dark:hover:bg-white/5"
                )}
                key={loc.code}
                role="option"
                type="button"
                onClick={() => switchLocale(loc.code)}
              >
                <span className="text-base">{loc.flag}</span>
                <span className="flex-1 text-left">{localeLabels[loc.code]}</span>
                {loc.code === currentLocale && (
                  <svg aria-hidden className="size-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // "icon" variant — compact button for header
  return (
    <div className="relative" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={labels.localeSwitcherAria}
        className="inline-flex size-10 items-center justify-center gap-1 rounded-xl border border-ink/8 bg-surface text-muted shadow-sm transition hover:border-ink/15 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <GlobeIcon />
        <span className="text-[10px] font-bold uppercase leading-none">{currentLocale}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-[0_18px_48px_rgba(23,33,31,0.12)] dark:border-white/10 dark:bg-[#1E293B] dark:shadow-[0_18px_48px_rgba(0,0,0,0.5)]"
          role="listbox"
        >
          <div className="p-1.5">
            {LOCALES.map((loc) => (
              <button
                aria-selected={loc.code === currentLocale}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  loc.code === currentLocale
                    ? "bg-accent/8 text-accent"
                    : "text-ink hover:bg-paper dark:text-slate-200 dark:hover:bg-white/5"
                )}
                key={loc.code}
                role="option"
                type="button"
                onClick={() => switchLocale(loc.code)}
              >
                <span className="text-base">{loc.flag}</span>
                <span className="flex-1 text-left">{localeLabels[loc.code]}</span>
                {loc.code === currentLocale && (
                  <svg aria-hidden className="size-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg aria-hidden className="size-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.97.633-3.794 1.708-5.276" />
    </svg>
  );
}
