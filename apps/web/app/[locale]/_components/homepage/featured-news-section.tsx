"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { ScrollStrip } from "../../../_components/scroll-strip";
import type { HomepageLabels, NhkArticle } from "./types";

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

function DifficultyBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    N5: "bg-green-100 text-green-700",
    N4: "bg-emerald-100 text-emerald-700",
    N3: "bg-blue-100 text-blue-700",
    N2: "bg-violet-100 text-violet-700",
    N1: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${colors[level] ?? "bg-gray-100 text-gray-600"}`}>
      {level}
    </span>
  );
}

function NewsCard({
  article,
  labels,
  locale,
  onCreateFlashcard,
  priority,
}: {
  article: NhkArticle;
  labels: HomepageLabels;
  locale: string;
  onCreateFlashcard: (articleId: string) => void;
  priority?: boolean;
}) {
  return (
    <article className="group flex w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/5 transition-all hover:shadow-md hover:-translate-y-0.5 sm:w-[320px]">
      {/* Image */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
        {article.imageUrl ? (
          <Image
            src={article.imageUrl}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="320px"
            priority={priority}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <svg className="h-10 w-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
              <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}
        {article.difficulty && (
          <div className="absolute left-2 top-2">
            <DifficultyBadge level={article.difficulty} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
          {article.title}
        </h3>
        <p className="mt-1.5 text-xs text-muted">
          {timeAgo(article.publishedAt, labels)}
        </p>

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2 pt-3">
          <Link
            href={`/${locale}/news/${article.id}`}
            className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs font-medium text-ink/80 transition-colors hover:bg-gray-100"
          >
            {labels.newsReadMore}
          </Link>
          <button
            onClick={() => onCreateFlashcard(article.id)}
            className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            type="button"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 5v14m-7-7h14" strokeLinecap="round" />
            </svg>
            {labels.newsCreateFlashcard}
          </button>
        </div>
      </div>
    </article>
  );
}

export function FeaturedNewsSection({
  articles,
  labels,
  loading,
  locale,
}: {
  articles: NhkArticle[];
  labels: HomepageLabels;
  loading?: boolean;
  locale: string;
}) {
  const auth = useKeycloakAuth();
  const [flashcardMsg, setFlashcardMsg] = useState<string | null>(null);

  const handleCreateFlashcard = useCallback(
    async (articleId: string) => {
      if (!auth.userId) {
        setFlashcardMsg(labels.progressSignIn);
        setTimeout(() => setFlashcardMsg(null), 3000);
        return;
      }
      try {
        // Get article detail to pick first vocab word
        const res = await learnerApiFetch(`/api/nhk-news/${articleId}`);
        if (!res.ok) throw new Error("Failed");
        const detail = await res.json();
        const firstWord = detail.vocabulary?.[0];
        if (!firstWord) return;

        const createRes = await learnerApiFetch(`/api/nhk-news/${articleId}/flashcard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: firstWord.word,
            reading: firstWord.reading,
            meaning: firstWord.meaning,
            cardType: "vocabulary",
          }),
        });
        if (!createRes.ok) throw new Error("Failed");
        const result = await createRes.json();
        setFlashcardMsg(
          result.message === "already_exists" ? labels.newsFlashcardExists : labels.newsFlashcardCreated,
        );
        setTimeout(() => setFlashcardMsg(null), 2000);
      } catch {
        setFlashcardMsg(labels.newsFlashcardError);
        setTimeout(() => setFlashcardMsg(null), 2000);
      }
    },
    [auth.userId, labels],
  );

  if (loading) {
    return (
      <section aria-busy>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink sm:text-xl">{labels.newsTitle}</h2>
            <p className="text-sm text-muted">{labels.newsSubtitle}</p>
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden pb-1">
          {[1, 2, 3].map((i) => (
            <div
              className="h-52 w-[280px] shrink-0 animate-pulse rounded-2xl bg-paper ring-1 ring-ink/5 sm:w-[320px]"
              key={i}
            />
          ))}
        </div>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  if (articles.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink sm:text-xl">{labels.newsTitle}</h2>
          <p className="text-sm text-muted">{labels.newsSubtitle}</p>
        </div>
        <Link
          href={`/${locale}/news`}
          className="hidden text-sm font-medium text-emerald-600 hover:text-emerald-700 sm:block"
        >
          {labels.newsViewAll}
        </Link>
      </div>

      {flashcardMsg && (
        <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {flashcardMsg}
        </div>
      )}

      <ScrollStrip>
        {articles.map((article, idx) => (
          <NewsCard
            key={article.id}
            article={article}
            labels={labels}
            locale={locale}
            onCreateFlashcard={handleCreateFlashcard}
            priority={idx < 2}
          />
        ))}
      </ScrollStrip>

      <Link
        href={`/${locale}/news`}
        className="mt-3 block text-center text-sm font-medium text-emerald-600 hover:text-emerald-700 sm:hidden"
      >
        {labels.newsViewAll}
      </Link>
    </section>
  );
}
