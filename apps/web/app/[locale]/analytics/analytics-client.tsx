"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  SectionHeader
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { useKeycloakAuth } from "../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../lib/learner-api";

interface AnalyticsLabels {
  summaryTitle: string;
  metricsTitle: string;
  weakSkillsTitle: string;
  weakSkillsEmpty: string;
  accuracy: string;
  completedSessions: string;
  empty: string;
  error: string;
  eyebrow: string;
  inputLabel: string;
  insight: string;
  load: string;
  placeholder: string;
  reviews: string;
  streak: string;
  subtitle: string;
  title: string;
}

interface LearnerAnalytics {
  insight: string;
  totals: {
    bjtAccuracyPct: number;
    completedBjtSessions: number;
    reviewCount: number;
    streakDays: number;
  };
  weakSkills: Array<{
    attempts: number;
    failureRate: number;
    incorrect: number;
    skillTag: string;
  }>;
}

export function LearnerAnalyticsClient({ labels, locale }: { labels: AnalyticsLabels; locale: string }) {
  const [analytics, setAnalytics] = useState<LearnerAnalytics | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const { userId } = useKeycloakAuth();

  const loadAnalytics = useCallback(async () => {
    const uid = userId;
    if (!uid) {
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const response = await learnerApiFetch(
        `/api/analytics/learner?days=7&userId=${encodeURIComponent(uid)}`
      );
      if (!response.ok) {
        throw new Error("Learner analytics request failed");
      }
      setAnalytics((await response.json()) as LearnerAnalytics);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const hasData = analytics
    ? analytics.totals.reviewCount + analytics.totals.completedBjtSessions > 0
    : false;

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader
        actions={
          <button
            className="rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90 disabled:opacity-50"
            disabled={loading || !userId}
            type="button"
            onClick={() => void loadAnalytics()}
          >
            {labels.load}
          </button>
        }
        description={labels.subtitle}
        eyebrow={labels.eyebrow}
        title={labels.title}
      />

      {error ? (
        <p className="text-sm text-sakura" role="alert">
          {labels.error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-muted">{labels.load}</p> : null}

      {analytics ? (
        <Card className="border-ink/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{labels.summaryTitle}</CardTitle>
            {!hasData ? <CardDescription>{labels.empty}</CardDescription> : null}
          </CardHeader>
          <CardContent className="space-y-6">
            {!hasData ? (
              <p className="text-sm leading-relaxed text-muted">{labels.empty}</p>
            ) : (
              <>
                <SectionHeader heading="h3" title={labels.metricsTitle} variant="overline" />
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label={labels.reviews} value={analytics.totals.reviewCount} />
                  <Metric label={labels.accuracy} value={`${analytics.totals.bjtAccuracyPct}%`} />
                  <Metric
                    label={labels.completedSessions}
                    value={analytics.totals.completedBjtSessions}
                  />
                  <Metric label={labels.streak} value={analytics.totals.streakDays} />
                </dl>
                <div className="rounded-xl border border-ink/10 bg-paper/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {labels.insight}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink">{analytics.insight}</p>
                </div>
                <div className="rounded-xl border border-ink/10 bg-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {labels.weakSkillsTitle}
                  </p>
                  {analytics.weakSkills.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">{labels.weakSkillsEmpty}</p>
                  ) : (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {analytics.weakSkills.map((skill) => (
                        <li key={skill.skillTag}>
                          <a
                            className="inline-flex rounded-full border border-sakura/30 bg-sakura/10 px-3 py-1 text-xs font-medium text-sakura hover:bg-sakura/15"
                            href={`/${locale}/flashcards?source=analytics&skill=${encodeURIComponent(skill.skillTag)}`}
                          >
                            {skill.skillTag} ({skill.failureRate}%)
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-ink/8 bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
