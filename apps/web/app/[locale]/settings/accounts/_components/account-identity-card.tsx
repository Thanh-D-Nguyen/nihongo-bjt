"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useGoAuth } from "../../../../../lib/go-auth-provider";

export interface AccountIdentityLabels {
  identityTitle: string;
  email: string;
  accountStatus: string;
  signedIn: string;
  signedOut: string;
  localeLabel: string;
  privacyTitle: string;
  privacyDesc: string;
  signOut: string;
}

export function AccountIdentityCard({
  labels,
  locale
}: {
  labels: AccountIdentityLabels;
  locale: string;
}) {
  const auth = useGoAuth();
  const displayName = auth.displayName?.trim() || auth.email || auth.userId || "";
  const initial = (displayName.charAt(0) || "N").toUpperCase();
  const localeName = useMemo(() => {
    if (locale === "ja") return "日本語";
    if (locale === "en") return "English";
    return "Tiếng Việt";
  }, [locale]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-lg font-semibold text-surface"
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent">
            {labels.identityTitle}
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-ink">
            {displayName || labels.signedOut}
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted">{auth.email || labels.email}</p>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-ink/10 bg-paper/70 p-3">
          <dt className="text-xs font-semibold text-muted">{labels.accountStatus}</dt>
          <dd className="mt-1 text-sm font-semibold text-ink">
            {auth.isAuthenticated ? labels.signedIn : labels.signedOut}
          </dd>
        </div>
        <div className="rounded-xl border border-ink/10 bg-paper/70 p-3">
          <dt className="text-xs font-semibold text-muted">{labels.localeLabel}</dt>
          <dd className="mt-1 text-sm font-semibold text-ink">{localeName}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-4">
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink/12 bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:border-accent/30 hover:bg-surface"
          href={`/${locale}/settings/privacy`}
        >
          <span>{labels.privacyTitle}</span>
          <span className="text-xs font-normal text-muted">· {labels.privacyDesc}</span>
        </Link>
        {auth.isAuthenticated ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sakura-strong/30 bg-sakura-soft px-4 text-sm font-semibold text-sakura-strong transition-colors hover:bg-sakura-soft/80"
            onClick={() => auth.logout()}
            type="button"
          >
            {labels.signOut}
          </button>
        ) : null}
      </div>
    </section>
  );
}
