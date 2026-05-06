"use client";

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  SectionHeader,
  StatCard
} from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../../components/auth/keycloak-auth-provider";
import { learnerApiFetchOptional } from "../../../lib/learner-api";

type AccountInfoLabels = {
  title: string;
  subtitle: string;
  eyebrow: string;
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
  recentActivity: string;
  noActivity: string;
  settings: string;
  editProfile: string;
  signOut: string;
};

type AnalyticsPayload = {
  insight?: string;
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

export function AccountInfoClient({
  labels,
  locale
}: {
  labels: AccountInfoLabels;
  locale: string;
}) {
  const auth = useKeycloakAuth();
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [dailyHome, setDailyHome] = useState<DailyHomePayload | null>(null);

  const loadSummary = useCallback(() => {
    if (!auth.userId) {
      setAnalytics(null);
      setDailyHome(null);
      return;
    }

    void learnerApiFetchOptional(
      `/api/analytics/learner?days=7&userId=${encodeURIComponent(auth.userId)}&locale=${locale}`
    )
      .then(async (response) => {
        setAnalytics(response?.ok ? ((await response.json()) as AnalyticsPayload) : null);
      })
      .catch(() => setAnalytics(null));

    void learnerApiFetchOptional(
      `/api/daily/home?locale=${locale}&userId=${encodeURIComponent(auth.userId)}`
    )
      .then(async (response) => {
        setDailyHome(response?.ok ? ((await response.json()) as DailyHomePayload) : null);
      })
      .catch(() => setDailyHome(null));
  }, [auth.userId, locale]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const userLabel = auth.displayName || auth.email || auth.userId || "";
  const initial = (userLabel.trim().charAt(0) || "N").toUpperCase();
  const totals = analytics?.totals;
  const dueReviews = dailyHome?.dueReviews ?? analytics?.dueFlashcards ?? null;
  const localeName = useMemo(() => (locale === "ja" ? "日本語" : "Tiếng Việt"), [locale]);

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.subtitle} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-ink text-xl font-semibold text-surface">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                  {labels.identityTitle}
                </p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-ink">
                  {userLabel || labels.signedOut}
                </h1>
                <p className="mt-1 truncate text-sm text-muted">{auth.email || labels.email}</p>
              </div>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-ink/10 bg-paper/70 p-3">
                <dt className="text-xs font-semibold text-muted">{labels.accountStatus}</dt>
                <dd className="mt-1 text-sm font-semibold text-ink">
                  {auth.accessToken ? labels.signedIn : labels.signedOut}
                </dd>
              </div>
              <div className="rounded-xl border border-ink/10 bg-paper/70 p-3">
                <dt className="text-xs font-semibold text-muted">{labels.localeLabel}</dt>
                <dd className="mt-1 text-sm font-semibold text-ink">{localeName}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <SectionHeader heading="h2" title={labels.learningSummary} />
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={labels.streak} value={totals?.streakDays ?? "—"} />
              <StatCard label={labels.reviews} value={totals?.reviewCount ?? "—"} />
              <StatCard
                label={labels.accuracy}
                value={totals?.bjtAccuracyPct != null ? `${totals.bjtAccuracyPct}%` : "—"}
              />
              <StatCard label={labels.dueReviews} value={dueReviews ?? "—"} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <SectionHeader heading="h2" title={labels.recentActivity} />
          {analytics?.insight ? (
            <p className="rounded-xl border border-ink/10 bg-paper/70 p-4 text-sm leading-relaxed text-ink">
              {analytics.insight}
            </p>
          ) : (
            <EmptyState title={labels.noActivity} />
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/12 bg-surface px-4 text-sm font-semibold text-ink shadow-sm hover:border-accent/25 hover:bg-accent/5"
              href={`/${locale}/settings/accounts`}
            >
              {labels.editProfile}
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/12 bg-surface px-4 text-sm font-semibold text-ink shadow-sm hover:border-accent/25 hover:bg-accent/5"
              href={`/${locale}/settings`}
            >
              {labels.settings}
            </Link>
            {auth.accessToken ? (
              <Button className="sm:ml-auto" variant="danger" type="button" onClick={auth.logout}>
                {labels.signOut}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
