"use client";

import { Badge, EmptyState, ErrorState, LoadingSkeleton, TabButton, TabsList } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetchOptional } from "../../../../lib/learner-api";

interface NhkArticle {
  id: string;
  title: string;
  publishedAt: string;
  imageUrl: string | null;
  difficulty: string | null;
  url: string;
  sourceType?: "easy" | "normal";
}

interface Labels {
  backToHome: string;
  title: string;
  difficulty: string;
  loading: string;
  errorLoad: string;
}

interface HomepageLabels {
  newsEasy: string;
  newsEmpty: string;
  newsNormal: string;
  newsTimeAgo: string;
  newsMinutesAgo: string;
  newsHoursAgo: string;
  newsDaysAgo: string;
  newsLoadMore?: string;
  newsRead?: string;
}

function timeAgo(dateStr: string, labels: HomepageLabels): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) {
    return labels.newsTimeAgo.replace("{time}", labels.newsMinutesAgo.replace("{n}", String(Math.max(1, minutes))));
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return labels.newsTimeAgo.replace("{time}", labels.newsHoursAgo.replace("{n}", String(hours)));
  }
  const days = Math.floor(hours / 24);
  return labels.newsTimeAgo.replace("{time}", labels.newsDaysAgo.replace("{n}", String(days)));
}

export function NhkNewsListClient({
  labels,
  homepageLabels,
  locale,
}: {
  labels: Labels;
  homepageLabels: HomepageLabels;
  locale: string;
}) {
  const auth = useKeycloakAuth();
  const PAGE_SIZE = 12;
  const [activeType, setActiveType] = useState<"easy" | "normal">("easy");
  const [articles, setArticles] = useState<NhkArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [readArticleIds, setReadArticleIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setHasMore(true);
    try {
      const res = await learnerApiFetchOptional(
        `/api/nhk-news?type=${activeType}&limit=${PAGE_SIZE}&offset=0&locale=${locale}`
      );
      if (!res?.ok) throw new Error("Failed");
      const data: NhkArticle[] = await res.json();
      setArticles(data);
      setHasMore(data.length >= PAGE_SIZE);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeType, locale]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await learnerApiFetchOptional(
        `/api/nhk-news?type=${activeType}&limit=${PAGE_SIZE}&offset=${articles.length}&locale=${locale}`
      );
      if (!res?.ok) throw new Error("Failed");
      const data: NhkArticle[] = await res.json();
      setArticles((prev) => [...prev, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
    } catch { /* silent */ } finally {
      setLoadingMore(false);
    }
  }, [activeType, articles.length, hasMore, loadingMore, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  // Fetch reading progress for loaded articles
  useEffect(() => {
    if (!auth.userId || articles.length === 0) return;
    const ids = articles.map((a) => a.id).join(",");
    void learnerApiFetchOptional(`/api/nhk-news/reading/progress?articleIds=${encodeURIComponent(ids)}`)
      .then(async (r) => {
        if (!r?.ok) return;
        const data: { articleId: string }[] = await r.json();
        setReadArticleIds(new Set(data.map((d) => d.articleId)));
      })
      .catch(() => {});
  }, [auth.userId, articles]);

  return (
    <main className="py-6">
      <Link href={`/${locale}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors">
        {labels.backToHome}
      </Link>

      <h1 className="mb-2 text-2xl font-bold text-ink">{labels.title}</h1>

      <TabsList className="mt-4 w-fit">
        <TabButton active={activeType === "easy"} onClick={() => setActiveType("easy")}>
          {homepageLabels.newsEasy}
        </TabButton>
        <TabButton active={activeType === "normal"} onClick={() => setActiveType("normal")}>
          {homepageLabels.newsNormal}
        </TabButton>
      </TabsList>

      {loading && (
        <div aria-busy className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <LoadingSkeleton className="h-64 rounded-2xl" key={i} />
          ))}
        </div>
      )}

      {error ? <ErrorState className="mt-6" description={labels.errorLoad} title={labels.title} /> : null}

      {!loading && !error && articles.length === 0 ? (
        <EmptyState className="mt-6" description={homepageLabels.newsEmpty} title={labels.title} />
      ) : null}

      {!loading && !error && articles.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article, index) => (
            <Link
              key={article.id}
              href={`/${locale}/news/${article.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/5 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                {article.imageUrl ? (
                  <img
                    alt={article.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading={index < 6 ? "eager" : "lazy"}
                    src={article.imageUrl}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-paper text-muted">
                    <span className="text-sm font-semibold">NHK</span>
                  </div>
                )}
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  <Badge tone={activeType === "easy" ? "accent" : "neutral"}>
                    {activeType === "easy" ? homepageLabels.newsEasy : homepageLabels.newsNormal}
                  </Badge>
                  {article.difficulty ? <Badge>{article.difficulty}</Badge> : null}
                  {readArticleIds.has(article.id) && (
                    <Badge tone="accent">
                      <span className="flex items-center gap-0.5">
                        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                        {homepageLabels.newsRead ?? "Đã đọc"}
                      </span>
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="line-clamp-2 text-sm font-semibold text-ink" lang="ja">
                  {article.title}
                </h2>
                <p className="mt-auto pt-2 text-xs text-muted">
                  {timeAgo(article.publishedAt, homepageLabels)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && hasMore && articles.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-6 text-sm font-semibold text-surface transition hover:bg-ink/90 disabled:opacity-50"
          >
            {loadingMore ? labels.loading : homepageLabels.newsLoadMore ?? "Xem thêm"}
          </button>
        </div>
      )}
    </main>
  );
}
