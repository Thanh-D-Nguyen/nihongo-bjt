"use client";

import { Badge, EmptyState, ErrorState, LoadingSkeleton, TabButton, TabsList } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
  const [activeType, setActiveType] = useState<"easy" | "normal">("easy");
  const [articles, setArticles] = useState<NhkArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await learnerApiFetchOptional(
        `/api/nhk-news?type=${activeType}&limit=30&locale=${locale}`
      );
      if (!res?.ok) throw new Error("Failed");
      setArticles(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeType, locale]);

  useEffect(() => {
    void load();
  }, [load]);

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
    </main>
  );
}
