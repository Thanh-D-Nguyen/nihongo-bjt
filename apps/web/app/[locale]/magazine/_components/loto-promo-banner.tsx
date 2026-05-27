"use client";

import Link from "next/link";

interface LotoPromoBannerProps {
  locale: string;
  labels: {
    title: string;
    subtitle: string;
    cta: string;
  };
}

export function LotoPromoBanner({ locale, labels }: LotoPromoBannerProps) {
  return (
    <Link
      href={`/${locale}/magazine/loto`}
      className="group relative mb-8 flex items-center gap-4 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 active:scale-[0.99] sm:gap-6 sm:p-6"
    >
      {/* Animated background orbs */}
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-emerald-500/5 blur-2xl transition-transform duration-500 group-hover:scale-125" />
      <div className="absolute -bottom-4 right-12 size-20 rounded-full bg-teal-500/8 blur-xl" />

      {/* Icon */}
      <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl shadow-sm transition-transform duration-300 group-hover:scale-110 sm:size-16">
        🎰
      </div>

      {/* Text */}
      <div className="relative flex-1">
        <h3 className="text-base font-bold text-foreground sm:text-lg">
          {labels.title}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
          {labels.subtitle}
        </p>
      </div>

      {/* CTA arrow */}
      <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 transition-all duration-200 group-hover:bg-emerald-500/20 group-hover:shadow-sm dark:text-emerald-400">
        <svg className="size-5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </div>
    </Link>
  );
}
