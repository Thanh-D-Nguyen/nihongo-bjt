"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetchOptional } from "../../../../lib/learner-api";
import { DailyJapaneseSection } from "./daily-japanese-section";
import { FeaturedNewsSection } from "./featured-news-section";
import { HeroSection } from "./hero-section";
import { ProgressSection } from "./progress-section";
import { QuickActionsStrip } from "./quick-actions-strip";
import { RecommendedSection, type DeckSummary, type QuizTemplate } from "./recommended-section";
import type { DailyWidget, HomepageLabels, LearnerAnalytics, NhkArticle } from "./types";

interface DailyHubPayload {
  dueReviews: number;
  greeting: { japanese: string; reading: string };
  today: string;
  widgets: DailyWidget[];
}

export function HomepageClient({
  labels,
  locale,
}: {
  labels: HomepageLabels;
  locale: string;
}) {
  const auth = useKeycloakAuth();
  const userId = auth.userId ?? "";
  const isLoggedIn = Boolean(userId);
  const displayName = useMemo(() => auth.displayName?.trim() || null, [auth.displayName]);

  const [hub, setHub] = useState<DailyHubPayload | null>(null);
  const [hubReady, setHubReady] = useState(false);
  const [nhkArticles, setNhkArticles] = useState<NhkArticle[]>([]);
  const [nhkReady, setNhkReady] = useState(false);
  const [analytics, setAnalytics] = useState<LearnerAnalytics | null>(null);
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const [quizTemplates, setQuizTemplates] = useState<QuizTemplate[]>([]);
  const [publicDecks, setPublicDecks] = useState<DeckSummary[]>([]);
  const [recommendReady, setRecommendReady] = useState(false);

  const loadData = useCallback(() => {
    setHubReady(false);
    setNhkReady(false);
    setAnalyticsReady(false);
    setRecommendReady(false);

    void learnerApiFetchOptional(
      `/api/daily/home?locale=${locale}${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`,
    )
      .then(async (r) => {
        if (r?.ok) setHub(await r.json());
        else setHub(null);
      })
      .catch(() => setHub(null))
      .finally(() => setHubReady(true));

    void learnerApiFetchOptional(`/api/nhk-news?limit=8`)
      .then(async (r) => {
        if (r?.ok) {
          const data = await r.json();
          setNhkArticles(Array.isArray(data) ? data : []);
        } else {
          setNhkArticles([]);
        }
      })
      .catch(() => setNhkArticles([]))
      .finally(() => setNhkReady(true));

    if (userId) {
      setAnalyticsReady(false);
      void learnerApiFetchOptional(
        `/api/analytics/learner?days=7&userId=${encodeURIComponent(userId)}&locale=${locale}`,
      )
        .then(async (r) => {
          if (r?.ok) setAnalytics(await r.json());
          else setAnalytics(null);
        })
        .catch(() => setAnalytics(null))
        .finally(() => setAnalyticsReady(true));
    } else {
      setAnalytics(null);
      setAnalyticsReady(true);
    }

    void Promise.all([
      learnerApiFetchOptional(`/api/quiz/templates?status=published&limit=6`)
        .then(async (r) => {
          if (r?.ok) {
            try {
              const data = await r.json();
              setQuizTemplates(Array.isArray(data) ? data : (data?.data ?? []));
            } catch {
              setQuizTemplates([]);
            }
          } else {
            setQuizTemplates([]);
          }
        })
        .catch(() => setQuizTemplates([])),
      learnerApiFetchOptional(`/api/flashcards/decks?visibility=public&limit=6`)
        .then(async (r) => {
          if (r?.ok) {
            try {
              const data = await r.json();
              setPublicDecks(Array.isArray(data) ? data : []);
            } catch {
              setPublicDecks([]);
            }
          } else {
            setPublicDecks([]);
          }
        })
        .catch(() => setPublicDecks([])),
    ]).finally(() => setRecommendReady(true));
  }, [locale, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dueCount = hub?.dueReviews ?? 0;

  return (
    <main className="space-y-8 py-6">
      <HeroSection
        displayName={displayName}
        dueCount={dueCount}
        hubReady={hubReady}
        labels={labels}
        locale={locale}
      />

      <QuickActionsStrip dueCount={dueCount} hubReady={hubReady} labels={labels} locale={locale} />

      <FeaturedNewsSection articles={nhkArticles} labels={labels} loading={!nhkReady} locale={locale} />

      <DailyJapaneseSection
        hubReady={hubReady}
        labels={labels}
        locale={locale}
        widgets={hub?.widgets ?? []}
      />

      <ProgressSection
        analytics={analytics}
        analyticsLoading={isLoggedIn && !analyticsReady}
        isLoggedIn={isLoggedIn}
        labels={labels}
        locale={locale}
      />

      <RecommendedSection
        decks={publicDecks}
        labels={labels}
        loading={!recommendReady}
        locale={locale}
        quizTemplates={quizTemplates}
      />
    </main>
  );
}
