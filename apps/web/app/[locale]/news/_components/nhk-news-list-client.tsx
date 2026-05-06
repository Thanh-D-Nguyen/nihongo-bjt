"use client";

import Image from "next/image";
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
}

interface Labels {
  backToHome: string;
  title: string;
  difficulty: string;
  loading: string;
  errorLoad: string;
}

interface HomepageLabels {
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
  const [articles, setArticles] = useState<NhkArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await learnerApiFetchOptional("/api/nhk-news?limit=30");
      if (!res?.ok) throw new Error("Failed");
      setArticles(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="py-6">
      <Link href={`/${locale}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors">
        {labels.backToHome}
      </Link>

      <h1 className="mb-2 text-2xl font-bold text-ink">{labels.title}</h1>

      {loading && (
        <div className="space-y-4 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      )}

      {error && <p className="mt-6 text-sm text-red-600">{labels.errorLoad}</p>}

      {!loading && !error && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/${locale}/news/${article.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/5 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                {article.imageUrl ? (
                  <Image
                    src={article.imageUrl}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                    <span className="text-3xl">📰</span>
                  </div>
                )}
                {article.difficulty && (
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shadow-sm backdrop-blur-sm">
                    {article.difficulty}
                  </span>
                )}
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
