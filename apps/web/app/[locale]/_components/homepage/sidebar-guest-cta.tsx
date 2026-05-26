"use client";

import Link from "next/link";

interface SidebarGuestCtaProps {
  title: string;
  subtitle: string;
  cta: string;
  locale: string;
}

export function SidebarGuestCta({ title, subtitle, cta, locale }: SidebarGuestCtaProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink/8 bg-gradient-to-br from-[#1B2A4A]/80 to-[#312E81]/80 p-6 text-center shadow-lg">
      <span className="text-3xl" aria-hidden>🏆</span>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="text-xs text-white/70 leading-relaxed">{subtitle}</p>
      <Link
        href={`/${locale}/login`}
        className="mt-1 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95"
      >
        {cta}
      </Link>
    </div>
  );
}
