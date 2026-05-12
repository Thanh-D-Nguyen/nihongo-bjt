"use client";

import { Badge, Button, EmptyState, ErrorState, SectionHeader, TabButton, TabsList } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { IconBookmark, IconDocument } from "../../../_components/app-icons";
import { NhkCreateDeckDialog } from "../nhk-create-deck-dialog";
import type { HomepageLabels, NhkArticle } from "./types";

type NewsType = "easy" | "normal";

/* ─── Progressive image ─── */

function ProgressiveImage({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      alt={alt}
      className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? "" : "scale-105 blur-sm"}`}
      loading={priority ? "eager" : "lazy"}
      onLoad={() => setLoaded(true)}
      src={src}
    />
  );
}

/* ─── Time ago helper ─── */

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
  return labels.newsTimeAgo.replace("{time}", labels.newsDaysAgo.replace("{n}", String(Math.floor(hours / 24))));
}

function sourceLabel(type: NewsType, labels: HomepageLabels) {
  return type === "easy" ? labels.newsEasy : labels.newsNormal;
}

/* ─── Featured (hero) news card — first article, full-width ─── */

function FeaturedNewsCard({
  article,
  labels,
  locale,
  onCreateFlashcardDeck,
  type,
}: {
  article: NhkArticle;
  labels: HomepageLabels;
  locale: string;
  onCreateFlashcardDeck: (id: string) => void;
  type: NewsType;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-xl">
      <div className="grid md:grid-cols-[1fr_1fr]">
        {/* Image half */}
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 md:aspect-auto md:min-h-[280px]">
          {article.imageUrl ? (
            <ProgressiveImage alt={article.title} priority src={article.imageUrl} />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-300">
              <IconDocument aria-hidden size={48} />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-white/20" />

          {/* Badge on image */}
          <div className="absolute left-4 top-4">
            <Badge tone={type === "easy" ? "accent" : "neutral"} className="shadow-lg backdrop-blur-sm">
              {sourceLabel(type, labels)}
            </Badge>
          </div>
        </div>

        {/* Content half */}
        <div className="flex flex-col justify-center p-6 md:p-8">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{timeAgo(article.publishedAt, labels)}</span>
            {article.difficulty && (
              <>
                <span className="text-slate-300">·</span>
                <Badge>{article.difficulty}</Badge>
              </>
            )}
          </div>

          <h3 className="mt-3 text-lg font-bold leading-snug text-slate-800 line-clamp-3 md:text-xl">
            {article.title}
          </h3>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1B2A4A] px-5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-[#243560] hover:shadow-md"
              href={`/${locale}/news/${article.id}`}
            >
              {labels.newsReadMore}
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </Link>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 transition-all duration-200 hover:bg-blue-100 hover:shadow-sm"
              onClick={() => onCreateFlashcardDeck(article.id)}
              type="button"
            >
              <IconBookmark aria-hidden size={16} />
              {labels.newsCreateFlashcard}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Compact news card — remaining articles ─── */

function CompactNewsCard({
  article,
  labels,
  locale,
  onCreateFlashcardDeck,
  type,
}: {
  article: NhkArticle;
  labels: HomepageLabels;
  locale: string;
  onCreateFlashcardDeck: (id: string) => void;
  type: NewsType;
}) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      {/* Image top */}
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        {article.imageUrl ? (
          <ProgressiveImage alt={article.title} src={article.imageUrl} />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-300">
            <IconDocument aria-hidden size={28} />
          </div>
        )}
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent" />

        {/* Badges */}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge tone={type === "easy" ? "accent" : "neutral"} className="text-[10px] shadow-sm backdrop-blur-sm">
            {sourceLabel(type, labels)}
          </Badge>
          {article.difficulty && <Badge className="text-[10px] shadow-sm backdrop-blur-sm">{article.difficulty}</Badge>}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col p-4">
        <p className="text-[11px] font-medium text-slate-400">
          {timeAgo(article.publishedAt, labels)}
        </p>

        <h3 className="mt-1.5 text-sm font-bold leading-snug text-slate-800 line-clamp-2">
          {article.title}
        </h3>

        <div className="mt-3 flex gap-2">
          <Link
            className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg bg-[#1B2A4A] px-3 text-xs font-bold text-white transition-all hover:bg-[#243560]"
            href={`/${locale}/news/${article.id}`}
          >
            {labels.newsReadMore}
          </Link>
          <button
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-blue-600 transition-all hover:bg-blue-100"
            onClick={() => onCreateFlashcardDeck(article.id)}
            title={labels.newsCreateFlashcard}
            type="button"
          >
            <IconBookmark aria-hidden size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Skeleton ─── */

function NewsSkeleton() {
  return (
    <div aria-busy className="space-y-4">
      {/* Featured skeleton */}
      <div className="h-[280px] animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50" />
      {/* Grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div className="h-[260px] animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50" key={i} />
        ))}
      </div>
      <p className="sr-only">Loading...</p>
    </div>
  );
}

/* ─── Empty state ─── */

function NewsEmptyState({ labels, type }: { labels: HomepageLabels; type: NewsType }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" /></svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-slate-600">{sourceLabel(type, labels)}</p>
        <p className="mt-1 text-sm text-slate-400">{labels.newsEmpty}</p>
      </div>
    </div>
  );
}

/* ─── Main section ─── */

export function FeaturedNewsSection({
  articlesByType,
  error,
  labels,
  loading,
  locale,
  onRetry,
  onTabChange
}: {
  articlesByType: Record<NewsType, NhkArticle[]>;
  error?: boolean;
  labels: HomepageLabels;
  loading?: boolean;
  locale: string;
  onRetry: () => void;
  onTabChange?: (type: NewsType) => void;
}) {
  const auth = useKeycloakAuth();
  const [activeType, setActiveType] = useState<NewsType>("easy");
  const [flashcardMsg, setFlashcardMsg] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [pendingArticleId, setPendingArticleId] = useState<string | null>(null);
  const articles = articlesByType[activeType] ?? [];

  const counts = useMemo(
    () => ({
      easy: articlesByType.easy.length,
      normal: articlesByType.normal.length
    }),
    [articlesByType.easy.length, articlesByType.normal.length]
  );

  const handleOpenCreateDeck = useCallback(
    (articleId: string) => {
      if (!auth.userId) {
        setFlashcardMsg(labels.progressSignIn);
        setTimeout(() => setFlashcardMsg(null), 3000);
        return;
      }
      setCreateError(null);
      setPendingArticleId(articleId);
    },
    [auth.userId, labels.progressSignIn]
  );

  const handleCreateFlashcardDeck = useCallback(
    async (deckTitle: string | null) => {
      if (!pendingArticleId) return;
      setCreatingDeck(true);
      setCreateError(null);
      try {
        const createRes = await learnerApiFetch(`/api/nhk-news/${pendingArticleId}/flashcards`, {
          body: JSON.stringify({ deckTitle }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        });
        if (!createRes.ok) throw new Error("Failed");
        setPendingArticleId(null);
        setFlashcardMsg(labels.newsFlashcardCreated);
        setTimeout(() => setFlashcardMsg(null), 2000);
      } catch {
        setCreateError(labels.newsFlashcardError);
      } finally {
        setCreatingDeck(false);
      }
    },
    [labels.newsFlashcardCreated, labels.newsFlashcardError, pendingArticleId]
  );

  const [featured, ...rest] = articles;

  return (
    <section>
      <SectionHeader
        actions={
          <Link className="text-sm font-semibold text-[#3B82F6] transition hover:text-[#2563EB]" href={`/${locale}/news`}>
            {labels.newsViewAll}
          </Link>
        }
        description={labels.newsSubtitle}
        title={labels.newsTitle}
      />

      {/* Tabs */}
      <TabsList className="mb-5 w-fit">
        {(["easy", "normal"] as const).map((type) => (
          <TabButton active={activeType === type} key={type} onClick={() => { setActiveType(type); onTabChange?.(type); }}>
            {sourceLabel(type, labels)}
            <span className="ml-1.5 tabular-nums text-current/60">
              {type === "easy" ? counts.easy : counts.normal}
            </span>
          </TabButton>
        ))}
      </TabsList>

      {/* Flashcard toast */}
      {flashcardMsg && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700">
          {flashcardMsg}
        </div>
      )}

      {/* Content area */}
      {loading ? (
        <NewsSkeleton />
      ) : error ? (
        <ErrorState
          action={
            <Button size="sm" variant="secondary" onClick={onRetry} type="button">
              {labels.newsViewAll}
            </Button>
          }
          description={labels.newsError}
          title={labels.newsTitle}
        />
      ) : articles.length === 0 ? (
        <NewsEmptyState labels={labels} type={activeType} />
      ) : (
        <div className="space-y-4">
          {/* Featured article — hero card */}
          {featured && (
            <FeaturedNewsCard
              article={featured}
              labels={labels}
              locale={locale}
              onCreateFlashcardDeck={handleOpenCreateDeck}
              type={activeType}
            />
          )}

          {/* Remaining articles — responsive grid */}
          {rest.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.slice(0, 3).map((article) => (
                <CompactNewsCard
                  article={article}
                  key={article.id}
                  labels={labels}
                  locale={locale}
                  onCreateFlashcardDeck={handleOpenCreateDeck}
                  type={activeType}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <NhkCreateDeckDialog
        labels={{
          cancel: labels.newsDeckCreateCancel,
          description: labels.newsDeckCreateDescription,
          error: createError ?? undefined,
          nameHint: labels.newsDeckNameAutoHint,
          nameLabel: labels.newsDeckNameLabel,
          namePlaceholder: labels.newsDeckNamePlaceholder,
          submit: creatingDeck ? labels.sectionLoadingHint : labels.newsDeckCreateSubmit,
          title: labels.newsDeckCreateTitle
        }}
        loading={creatingDeck}
        onClose={() => {
          setPendingArticleId(null);
          setCreateError(null);
        }}
        onSubmit={handleCreateFlashcardDeck}
        open={pendingArticleId !== null}
      />
    </section>
  );
}
