"use client";

import {
  Button,
  Card,
  CardContent,
  PageHeader,
  SectionHeader,
} from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetchOptional } from "../../../../lib/learner-api";

/* ── Types ── */

type SettingsLabels = {
  title: string;
  subtitle: string;
  eyebrow: string;
  profileSection: string;
  linkedAccounts: string;
  linkedAccountsDesc: string;
  notifications: string;
  notificationsDesc: string;
  privacy: string;
  privacyDesc: string;
  readingAssist: string;
  readingAssistDesc: string;
  appearance: string;
  appearanceDesc: string;
  settingsArea: string;
  backToHome: string;
  signOut: string;
};

type AccountInfoLabels = {
  identityTitle: string;
  displayName: string;
  email: string;
  accountStatus: string;
  signedIn: string;
  signedOut: string;
  localeLabel: string;
  learningSummary: string;
  streak: string;
  reviews: string;
  accuracy: string;
  dueReviews: string;
};

type AnalyticsPayload = {
  dueFlashcards?: number | null;
  totals?: {
    bjtAccuracyPct?: number;
    reviewCount?: number;
    streakDays?: number;
  };
};

type DailyHomePayload = {
  dueReviews?: number;
};

/* ── Shimmer skeleton ── */

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex gap-4">
        <div className="size-16 shrink-0 rounded-2xl bg-ink/8" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 w-24 rounded bg-ink/8" />
          <div className="h-5 w-48 rounded bg-ink/8" />
          <div className="h-3 w-36 rounded bg-ink/8" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-ink/6" />
        ))}
      </div>
    </div>
  );
}

/* ── Settings nav card ── */

function SettingsNavCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      className="group block outline-none transition-all duration-150 active:scale-[0.98]"
      href={href}
    >
      <div className="flex items-start gap-3.5 rounded-2xl border border-ink/8 bg-surface p-4 shadow-xs transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-accent/20 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-accent/30 group-focus-visible:ring-offset-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/8 text-lg" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
        </div>
        <svg className="ml-auto mt-0.5 size-4 shrink-0 text-muted/40 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4" /></svg>
      </div>
    </Link>
  );
}

/* ── Stat pill ── */

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-ink/6 bg-paper/60 px-3 py-2.5 text-center">
      <span className="text-lg font-bold tabular-nums text-ink">{value}</span>
      <span className="mt-0.5 text-[11px] font-medium text-muted">{label}</span>
    </div>
  );
}

/* ── Main component ── */

export function SettingsHubClient({
  labels,
  locale,
}: {
  labels: {
    settings: SettingsLabels;
    accountInfo: AccountInfoLabels;
    appearancePage: { title: string };
  };
  locale: string;
}) {
  const auth = useKeycloakAuth();
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [dailyHome, setDailyHome] = useState<DailyHomePayload | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const s = labels.settings;
  const a = labels.accountInfo;
  const base = `/${locale}`;

  const loadProfile = useCallback(() => {
    if (!auth.userId) {
      setProfileLoaded(true);
      return;
    }

    const promises = [
      learnerApiFetchOptional(
        `/api/analytics/learner?days=7&userId=${encodeURIComponent(auth.userId)}&locale=${locale}`
      )
        .then(async (r) => setAnalytics(r?.ok ? ((await r.json()) as AnalyticsPayload) : null))
        .catch(() => setAnalytics(null)),

      learnerApiFetchOptional(
        `/api/daily/home?locale=${locale}&userId=${encodeURIComponent(auth.userId)}`
      )
        .then(async (r) => setDailyHome(r?.ok ? ((await r.json()) as DailyHomePayload) : null))
        .catch(() => setDailyHome(null)),
    ];

    void Promise.all(promises).finally(() => setProfileLoaded(true));
  }, [auth.userId, locale]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const userLabel = auth.displayName || auth.email || auth.userId || "";
  const initial = (userLabel.trim().charAt(0) || "N").toUpperCase();
  const totals = analytics?.totals;
  const dueReviews = dailyHome?.dueReviews ?? analytics?.dueFlashcards ?? null;
  const localeName = useMemo(() => (locale === "ja" ? "日本語" : "Tiếng Việt"), [locale]);

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader
        eyebrow={s.eyebrow}
        title={s.title}
        description={s.subtitle}
      />

      {/* ── Profile hero card (bento: spans full width) ── */}
      <Card className="overflow-hidden border-ink/8">
        <CardContent className="p-0">
          {!profileLoaded ? (
            <div className="p-5 sm:p-6">
              <ProfileSkeleton />
            </div>
          ) : (
            <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
              {/* Identity */}
              <div className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-navy text-lg font-bold text-surface shadow-sm">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                      {a.identityTitle}
                    </p>
                    <h2 className="mt-0.5 truncate text-xl font-bold tracking-tight text-ink">
                      {userLabel || a.signedOut}
                    </h2>
                    <p className="truncate text-sm text-muted">
                      {auth.email || a.email}
                    </p>
                  </div>
                </div>

                {/* Status chips */}
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    auth.accessToken
                      ? "bg-leaf/10 text-leaf"
                      : "bg-ink/6 text-muted"
                  }`}>
                    <span className={`size-1.5 rounded-full ${auth.accessToken ? "bg-leaf" : "bg-muted"}`} />
                    {auth.accessToken ? a.signedIn : a.signedOut}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-accent/8 px-3 py-1 text-xs font-semibold text-accent">
                    {localeName}
                  </span>
                </div>
              </div>

              {/* Learning stats (right side on desktop) */}
              <div className="border-t border-ink/6 bg-paper/40 p-5 sm:p-6 lg:border-l lg:border-t-0">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                  {a.learningSummary}
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <StatPill label={a.streak} value={totals?.streakDays ?? "—"} />
                  <StatPill label={a.reviews} value={totals?.reviewCount ?? "—"} />
                  <StatPill
                    label={a.accuracy}
                    value={totals?.bjtAccuracyPct != null ? `${totals.bjtAccuracyPct}%` : "—"}
                  />
                  <StatPill label={a.dueReviews} value={dueReviews ?? "—"} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Settings bento grid ── */}
      <section aria-labelledby="settings-area-heading">
        <SectionHeader
          heading="h2"
          id="settings-area-heading"
          title={s.settingsArea}
        />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SettingsNavCard
            href={`${base}/settings/linked-accounts`}
            icon="🔗"
            title={s.linkedAccounts}
            description={s.linkedAccountsDesc}
          />
          <SettingsNavCard
            href={`${base}/settings/notifications`}
            icon="🔔"
            title={s.notifications}
            description={s.notificationsDesc}
          />
          <SettingsNavCard
            href={`${base}/settings/appearance`}
            icon="🎨"
            title={s.appearance}
            description={s.appearanceDesc}
          />
          <SettingsNavCard
            href={`${base}/settings/reading`}
            icon="📖"
            title={s.readingAssist}
            description={s.readingAssistDesc}
          />
          <SettingsNavCard
            href={`${base}/settings/privacy`}
            icon="🔒"
            title={s.privacy}
            description={s.privacyDesc}
          />
        </div>
      </section>

      {/* ── Footer actions ── */}
      <div className="flex items-center justify-between border-t border-ink/6 pt-5">
        <Link
          className="text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
          href={base}
        >
          {s.backToHome}
        </Link>
        {auth.accessToken ? (
          <Button variant="danger" type="button" onClick={auth.logout}>
            {s.signOut}
          </Button>
        ) : null}
      </div>
    </main>
  );
}
