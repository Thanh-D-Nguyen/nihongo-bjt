"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchDailyRadarHome } from "./api";
import { themeFor } from "./module-theme";
import type { DailyRadarCard, DailyRadarHomePayload, DailyRadarLabels } from "./types";

function categoryLabel(category: string, labels: DailyRadarLabels) {
  const key = `category${category.charAt(0).toUpperCase()}${category.slice(1)}` as keyof DailyRadarLabels;
  return labels[key] ?? category;
}

function cardHref(card: DailyRadarCard, locale: string) {
  if (card.moduleType === "daily_widget" && card.targetEntityId) {
    return `/${locale}/daily/${card.targetEntityId}`;
  }
  // Skip self-referencing routes (e.g. /vi/modules/safety_emergency for a safety_emergency card)
  if (card.targetRoute && !card.targetRoute.includes(`/modules/${card.module.moduleKey}`)) {
    return card.targetRoute.replace(/^\/vi\//, `/${locale}/`);
  }
  return `/${locale}/radar/${card.slug}`;
}

function needsDisclaimer(card: DailyRadarCard) {
  const required = card.metadata && typeof card.metadata === "object" ? card.metadata.disclaimerRequired : undefined;
  return Boolean(required) || Boolean(card.module.disclaimerVi);
}

/* ─── Widget card (daily Japanese content) ─── */

function WidgetCard({ card, locale }: { card: DailyRadarCard; locale: string }) {
  const theme = themeFor(card.visualTheme, card.category);
  const gradientMap: Record<string, string> = {
    work: "from-amber-400 to-orange-500",
    money: "from-amber-400 to-yellow-500",
    study: "from-pink-400 to-rose-500",
  };
  const gradient = gradientMap[card.category] ?? "from-emerald-400 to-teal-500";

  return (
    <Link
      className={`group relative flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border shadow-sm outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:w-[300px] ${theme.card}`}
      href={cardHref(card, locale)}
    >
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center gap-2.5">
          {card.iconKey ? (
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}>
              <span className="text-lg">{card.iconKey}</span>
            </div>
          ) : null}
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${theme.badge}`}>
            {card.module.titleVi}
          </span>
        </div>
        <h3 className="text-[15px] font-bold leading-snug text-slate-800 line-clamp-1">{card.titleVi}</h3>
        {card.japaneseText && (
          <p className="mt-3 text-xl font-semibold leading-relaxed text-[#1B2A4A]" lang="ja">{card.japaneseText}</p>
        )}
        {card.readingText && (
          <p className="mt-1 text-xs font-medium text-slate-400" lang="ja">{card.readingText}</p>
        )}
        {card.descriptionVi && (
          <p className="mt-3 text-xs leading-relaxed text-slate-500 line-clamp-2">{card.descriptionVi}</p>
        )}
        <div className="mt-auto flex items-center gap-1 pt-4 text-xs font-semibold text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
          <span>Learn more</span>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </div>
      </div>
    </Link>
  );
}

/* ─── Standard radar card ─── */

function RadarCard({ card, labels, locale }: { card: DailyRadarCard; labels: DailyRadarLabels; locale: string }) {
  const theme = themeFor(card.visualTheme, card.category);
  const isComingSoon = card.moduleType === "coming_soon";
  const showDisclaimer = needsDisclaimer(card);
  return (
    <Link
      className={`group flex min-h-[230px] w-[82vw] shrink-0 snap-start flex-col rounded-2xl border p-4 shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-400 sm:w-[21rem] ${theme.card}`}
      href={cardHref(card, locale)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${theme.badge}`}>
            {categoryLabel(card.category, labels)}
          </span>
          {showDisclaimer ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
              {labels.disclaimerBadge}
            </span>
          ) : null}
        </div>
        <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
          {isComingSoon ? labels.comingSoon : (card.badgeTextVi ?? card.module.titleVi)}
        </span>
      </div>
      <h3 className="mt-4 line-clamp-2 text-base font-semibold leading-snug text-slate-950">{card.titleVi}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-700">{card.descriptionVi}</p>
      {card.recommendationReasonVi ? (
        <p className="mt-3 line-clamp-2 rounded-xl bg-white/70 px-3 py-2 text-xs leading-relaxed text-slate-700 ring-1 ring-white/80">
          {card.recommendationReasonVi}
        </p>
      ) : null}
      <div className="mt-auto space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
          {card.estimatedMinutes ? <span>{labels.minutes.replace("{n}", String(card.estimatedMinutes))}</span> : null}
          {card.levelLabel ? <span className="rounded-full bg-white/70 px-2 py-0.5 ring-1 ring-slate-200">{card.levelLabel}</span> : null}
        </div>
        <span className={`inline-flex min-h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold shadow-sm ring-1 ring-slate-200 transition group-hover:ring-slate-300 ${theme.accent}`}>
          {card.ctaLabelVi || labels.ctaFallback}
        </span>
      </div>
    </Link>
  );
}

/* ─── Spotlight ─── */

function Spotlight({ card, labels, locale }: { card: DailyRadarCard; labels: DailyRadarLabels; locale: string }) {
  const theme = themeFor(card.visualTheme, card.category);
  const showDisclaimer = needsDisclaimer(card);
  return (
    <Link
      className={`group relative block overflow-hidden rounded-3xl bg-gradient-to-br ${theme.spotlight} p-5 text-white shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:p-6`}
      href={cardHref(card, locale)}
    >
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_25%,rgba(255,255,255,0.24),transparent_38%)]" />
      <div className="relative grid min-h-[280px] gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ring-1 ring-white/20">
              {categoryLabel(card.category, labels)}
            </span>
            {card.badgeTextVi ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900">{card.badgeTextVi}</span>
            ) : null}
            {showDisclaimer ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                {labels.disclaimerBadge}
              </span>
            ) : null}
          </div>
          <h3 className="mt-5 max-w-2xl text-2xl font-semibold leading-tight sm:text-3xl">{card.titleVi}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/82 sm:text-base">{card.descriptionVi}</p>
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
            <span className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 shadow-md transition group-hover:bg-slate-100">
              {card.ctaLabelVi || labels.ctaFallback}
            </span>
          </div>
        </div>
        <div className="hidden rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur lg:block">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/65">{card.module.titleVi}</div>
          <div className="mt-4 space-y-3 text-sm text-white/80">
            <p>日本語</p>
            <p className="text-xl font-semibold text-white">{card.titleJa ?? card.titleVi}</p>
            <p>{card.module.disclaimerVi ?? card.recommendationReasonVi}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── Skeleton ─── */

function Skeleton({ labels }: { labels: DailyRadarLabels }) {
  return (
    <section aria-busy aria-labelledby="daily-radar-heading" className="space-y-4">
      <div>
        <h2 id="daily-radar-heading" className="text-2xl font-semibold text-slate-950">{labels.heading}</h2>
        <p className="mt-1 text-sm text-slate-600">{labels.subheading}</p>
      </div>
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div className="h-56 w-[280px] shrink-0 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 sm:w-[300px]" key={i} />
        ))}
      </div>
    </section>
  );
}

/* ─── Main section ─── */

export function DailyRadarSection({ labels, locale }: { labels: DailyRadarLabels; locale: string }) {
  const [payload, setPayload] = useState<DailyRadarHomePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState("all");
  const railRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      setPayload(await fetchDailyRadarHome(locale));
    } catch {
      setPayload(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const cards = useMemo(() => {
    const rows = payload?.cards ?? [];
    return category === "all" ? rows : rows.filter((card) => card.category === category);
  }, [category, payload]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const card of payload?.cards ?? []) {
      map.set(card.category, (map.get(card.category) ?? 0) + 1);
    }
    return map;
  }, [payload]);

  if (loading) return <Skeleton labels={labels} />;

  if (error) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-5">
        <h2 className="text-2xl font-semibold text-slate-950">{labels.heading}</h2>
        <p className="mt-2 text-sm text-red-900">{labels.error}</p>
        <button className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => void load()} type="button">
          {labels.retry}
        </button>
      </section>
    );
  }

  if (!payload || payload.cards.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-2xl font-semibold text-slate-950">{labels.heading}</h2>
        <p className="mt-2 text-sm text-slate-600">{labels.empty}</p>
      </section>
    );
  }

  const categories = ["all", ...(payload.categories ?? [])];

  return (
    <section aria-labelledby="daily-radar-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Japan Daily Radar</p>
          <h2 id="daily-radar-heading" className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">{labels.heading}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{labels.subheading}</p>
        </div>
        {cards.length > 3 ? (
          <div className="flex gap-2 sm:shrink-0">
            <button className="hidden rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex" onClick={() => railRef.current?.scrollBy({ behavior: "smooth", left: -360 })} type="button">←</button>
            <button className="hidden rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex" onClick={() => railRef.current?.scrollBy({ behavior: "smooth", left: 360 })} type="button">→</button>
          </div>
        ) : null}
      </div>

      {payload.spotlight ? <Spotlight card={payload.spotlight} labels={labels} locale={locale} /> : null}

      {categories.length > 2 ? (
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition ${category === item ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item === "all"
                ? `${labels.all} (${payload.cards.length})`
                : `${categoryLabel(item, labels)} (${categoryCounts.get(item) ?? 0})`}
            </button>
          ))}
        </div>
      ) : null}

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{labels.empty}</div>
      ) : (
        <div ref={railRef} className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {cards.map((card) => (
            card.moduleType === "daily_widget"
              ? <WidgetCard card={card} key={card.id} locale={locale} />
              : <RadarCard card={card} key={card.id} labels={labels} locale={locale} />
          ))}
        </div>
      )}
    </section>
  );
}
