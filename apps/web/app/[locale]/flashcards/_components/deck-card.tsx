"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import type { DeckApiRow } from "./deck-types";

export interface DeckCardLabels {
  cards: string;
  private: string;
  public: string;
  statusActive: string;
  statusArchived: string;
  updatedLabel: string;
  createdLabel: string;
  listAriaLabel: string;
  gridAriaLabel: string;
  openDeckAria: string;
}

export function deckDisplayTitle(d: DeckApiRow, locale: string) {
  return locale === "ja" && d.titleJa ? d.titleJa : d.titleVi;
}

export function deckDisplayDesc(d: DeckApiRow, locale: string) {
  return locale === "ja" && d.descriptionJa ? d.descriptionJa : d.descriptionVi;
}

export function deckCardCount(d: DeckApiRow) {
  return d._count?.cards ?? 0;
}

function formatShortDate(iso: string | undefined, locale: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "vi-VN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(d);
  } catch {
    return "";
  }
}

const tileChrome =
  "rounded-xl border border-ink/10 bg-surface shadow-sm outline-none ring-offset-2 transition-all duration-200 hover:border-leaf/40 focus-within:ring-2 focus-within:ring-accent";

const metaRowClass =
  "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-muted";

function MetaLine({
  children,
  asLink,
  href
}: {
  children: ReactNode;
  asLink: boolean;
  href: string;
}) {
  if (asLink) {
    return (
      <Link
        className={`${metaRowClass} min-w-0 flex-1 rounded py-1 outline-none transition-colors hover:text-ink/90 focus-visible:ring-2 focus-visible:ring-accent`}
        href={href}
      >
        {children}
      </Link>
    );
  }
  return <div className={metaRowClass}>{children}</div>;
}

export function DeckCard({
  deck,
  href,
  insideFooter,
  labels,
  locale,
  mode
}: {
  deck: DeckApiRow;
  href: string;
  /** Owner-only control on the same row as meta (cards · status · date). */
  insideFooter?: ReactNode;
  labels: DeckCardLabels;
  locale: string;
  mode: "grid" | "list";
}) {
  const title = deckDisplayTitle(deck, locale);
  const desc = deckDisplayDesc(deck, locale);
  const n = deckCardCount(deck);
  const visLabel = deck.visibility === "public" ? labels.public : labels.private;
  const statusLabel =
    deck.status === "active" ? labels.statusActive : labels.statusArchived;
  const dateIso = deck.updatedAt ?? deck.createdAt;
  const dateLabel = deck.updatedAt ? labels.updatedLabel : labels.createdLabel;
  const dateStr = formatShortDate(dateIso, locale);
  const aria = `${labels.openDeckAria}: ${title}`;

  const metaInner = (
    <>
      <span className="tabular-nums">
        {n} {labels.cards}
      </span>
      <span aria-hidden>·</span>
      <span>{statusLabel}</span>
      {dateStr ? (
        <>
          <span aria-hidden>·</span>
          <span>
            {dateLabel}: {dateStr}
          </span>
        </>
      ) : null}
    </>
  );

  const badge = (
    <span
      className={
        deck.visibility === "public"
          ? "shrink-0 rounded-full border border-leaf/25 bg-leaf-soft px-2 py-0.5 text-[10px] font-bold text-leaf"
          : "shrink-0 rounded-full border border-ink/10 bg-paper px-2 py-0.5 text-[10px] font-bold text-muted"
      }
    >
      {visLabel}
    </span>
  );

  const metaFooterRow = (
    <div className="flex min-h-10 items-center justify-between gap-2 border-t border-ink/10 bg-paper/30 px-4 py-2">
      <MetaLine asLink={Boolean(insideFooter)} href={href}>
        {metaInner}
      </MetaLine>
      {insideFooter ? <div className="shrink-0">{insideFooter}</div> : null}
    </div>
  );

  if (mode === "list") {
    if (insideFooter) {
      return (
        <div className={`flex min-h-[4.5rem] flex-col overflow-hidden ${tileChrome}`}>
          <Link
            aria-label={aria}
            className="min-w-0 flex-1 px-3 py-3 outline-none sm:px-4"
            href={href}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-bold leading-snug text-ink">{title}</h3>
              {badge}
            </div>
            {desc ? (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{desc}</p>
            ) : null}
          </Link>
          {metaFooterRow}
        </div>
      );
    }

    return (
      <Link
        aria-label={aria}
        className={`flex gap-3 px-3 py-3 sm:px-4 ${tileChrome}`}
        href={href}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-bold leading-snug text-ink">{title}</h3>
            {badge}
          </div>
          {desc ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{desc}</p>
          ) : null}
          <div className="mt-2">
            <MetaLine asLink={false} href={href}>
              {metaInner}
            </MetaLine>
          </div>
        </div>
      </Link>
    );
  }

  /* grid */
  if (insideFooter) {
    return (
      <div className={`flex h-full min-h-[8.5rem] flex-col overflow-hidden ${tileChrome}`}>
        <Link
          aria-label={aria}
          className="flex min-h-0 flex-1 flex-col p-4 pb-3 outline-none"
          href={href}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 text-sm font-bold leading-snug text-ink">{title}</h3>
            {badge}
          </div>
          {desc ? (
            <p className="mt-2 line-clamp-2 min-h-[2.25rem] flex-1 text-xs leading-relaxed text-muted">
              {desc}
            </p>
          ) : (
            <div className="min-h-[2.25rem] flex-1" />
          )}
        </Link>
        {metaFooterRow}
      </div>
    );
  }

  return (
    <Link
      aria-label={aria}
      className={`flex h-full min-h-[8.5rem] flex-col p-4 ${tileChrome}`}
      href={href}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-bold leading-snug text-ink">{title}</h3>
        {badge}
      </div>
      {desc ? (
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] flex-1 text-xs leading-relaxed text-muted">{desc}</p>
      ) : (
        <div className="min-h-[2.5rem] flex-1" />
      )}
      <div className="mt-auto pt-2">
        <MetaLine asLink={false} href={href}>
          {metaInner}
        </MetaLine>
      </div>
    </Link>
  );
}
