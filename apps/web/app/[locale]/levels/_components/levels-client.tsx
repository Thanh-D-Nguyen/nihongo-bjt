"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { learnerApiFetchOptional } from "../../../../lib/learner-api";

interface LevelItem {
  code: string;
  nameJa: string;
  nameVi: string;
  scoreMin: number;
  scoreMax: number;
  jlptEquiv: string;
  descriptionVi: string;
  descriptionJa: string;
  color: string;
  vocabCount: number;
  kanjiCount: number;
  grammarCount: number;
}

interface LearnerAnalytics {
  totals: {
    bjtAccuracyPct: number;
    completedBjtSessions: number;
    reviewCount: number;
    streakDays: number;
  };
}

interface Labels {
  title: string;
  subtitle: string;
  scoreRange: string;
  vocab: string;
  kanji: string;
  grammar: string;
  loading: string;
  error: string;
  readinessTitle?: string;
  readinessSubtitle?: string;
  readinessCta?: string;
  completed?: string;
  current?: string;
  locked?: string;
  skills?: string;
}

export function LevelsClient({ labels, locale }: { labels: Labels; locale: string }) {
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [analytics, setAnalytics] = useState<LearnerAnalytics | null>(null);
  const [analyticsReady, setAnalyticsReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await learnerApiFetchOptional("/api/levels");
        if (res.ok) setLevels(await res.json());
        else setError(true);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();

    // Fetch analytics for readiness panel
    void learnerApiFetchOptional("/api/analytics/learner?days=30")
      .then(async (r) => {
        if (r?.ok) setAnalytics(await r.json());
      })
      .catch(() => {})
      .finally(() => setAnalyticsReady(true));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--color-border)]" />
        <div className="mt-8 space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div className="flex gap-4" key={i}>
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-[var(--color-border)]" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 animate-pulse rounded bg-[var(--color-border)]" />
                <div className="h-4 w-full animate-pulse rounded bg-[var(--color-border)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <p className="text-sm text-[var(--color-danger)]">{labels.error}</p>
      </div>
    );
  }

  const readinessPct = analytics?.totals.bjtAccuracyPct ?? 0;
  const hasSessions = (analytics?.totals.completedBjtSessions ?? 0) > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Page Header */}
      <div className="mb-8">
        <p className="text-overline text-muted">{labels.scoreRange}</p>
        <h1 className="text-h1 mt-2 text-ink">{labels.title}</h1>
        <p className="text-body mt-2 text-muted">{labels.subtitle}</p>
      </div>

      {/* No-level-established notice — truthful neutral state */}
      {!hasSessions && (
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
          <p className="text-body text-muted">
            Complete a BJT assessment to establish your current level and track your progress through the roadmap.
          </p>
          <Link
            className="btn btn-primary btn-sm mt-4 inline-flex"
            href={`/${locale}/quiz`}
          >
            Take Assessment
          </Link>
        </div>
      )}

      {/* Vertical Roadmap Timeline — all levels shown as reference, no completed/current/locked states */}
      <div className="roadmap-track relative">
        {/* Vertical connector line */}
        <div
          aria-hidden="true"
          className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-[var(--color-border)] sm:left-[27px]"
        />

        <div className="space-y-0">
          {levels.map((lv, index) => {
            const isLast = index === levels.length - 1;

            return (
              <div
                className={`roadmap-node relative flex gap-4 pb-8 sm:gap-5 ${isLast ? "pb-0" : ""}`}
                key={lv.code}
              >
                {/* Timeline Dot — neutral state */}
                <div className="relative z-10 shrink-0">
                  <div
                    className="flex size-12 items-center justify-center rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-subtle)] transition-colors sm:size-14"
                  >
                    <span className="text-sm font-bold sm:text-base">{lv.code}</span>
                  </div>
                </div>

                {/* Level Content Card */}
                <Link
                  className="group flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition-all hover:border-[var(--color-border-hover)] hover:shadow-sm hover:-translate-y-0.5 sm:p-5"
                  href={`/${locale}/levels/${lv.code}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-h3 text-ink">{lv.code}</h2>
                      <p className="text-body-sm mt-1 text-muted">{lv.nameVi}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--color-paper)] px-2.5 py-1 text-[10px] font-semibold tabular-nums text-muted ring-1 ring-[var(--color-border)]">
                      {lv.scoreMin}–{lv.scoreMax}
                    </span>
                  </div>

                  <p className="text-body-sm mt-3 leading-relaxed text-muted">{lv.descriptionVi}</p>

                  {/* Skill Chips */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-[var(--color-paper)] px-2 py-1 text-[10px] font-medium text-muted ring-1 ring-[var(--color-border)]">
                      {labels.vocab}: {lv.vocabCount}
                    </span>
                    <span className="rounded-md bg-[var(--color-paper)] px-2 py-1 text-[10px] font-medium text-muted ring-1 ring-[var(--color-border)]">
                      {labels.kanji}: {lv.kanjiCount}
                    </span>
                    <span className="rounded-md bg-[var(--color-paper)] px-2 py-1 text-[10px] font-medium text-muted ring-1 ring-[var(--color-border)]">
                      {labels.grammar}: {lv.grammarCount}
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mock Exam Readiness Panel — only shows real data or truthful neutral */}
      <div className="mt-10 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs sm:p-6">
        <h3 className="text-h3 text-ink">{labels.readinessTitle ?? "Mock Exam Readiness"}</h3>
        <p className="text-body-sm mt-1 text-muted">
          {labels.readinessSubtitle ?? "Based on recent performance"}
        </p>

        <div className="mt-4 flex items-baseline gap-3">
          {analyticsReady ? (
            <span className="text-4xl font-bold tabular-nums text-[var(--color-navy)]">
              {hasSessions ? `${readinessPct}%` : "—"}
            </span>
          ) : (
            <div className="h-10 w-20 animate-pulse rounded bg-[var(--color-border)]" />
          )}
          <span className="text-body-sm text-muted">
            {hasSessions
              ? `accuracy across ${(analytics?.totals.completedBjtSessions ?? 0)} sessions`
              : "No completed sessions yet"}
          </span>
        </div>

        {hasSessions && (
          <div className="mt-4">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full bg-[var(--color-blue)] transition-all"
                style={{ width: `${Math.min(readinessPct, 100)}%` }}
              />
            </div>
          </div>
        )}

        <Link
          className="btn btn-primary btn-sm mt-5 inline-flex"
          href={`/${locale}/quiz`}
        >
          {labels.readinessCta ?? "Take Mock Exam"}
        </Link>
      </div>
    </div>
  );
}