"use client";

import { Badge, Button, Card, CardContent, EmptyState, ErrorState, LoadingSkeleton, SectionHeader, TabButton, TabsList } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { IconBookmark, IconDocument } from "../../../_components/app-icons";
import { NhkCreateDeckDialog } from "../nhk-create-deck-dialog";
import type { HomepageLabels, NhkArticle } from "./types";

type NewsType = "easy" | "normal";

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

function NewsCard({
  article,
  labels,
  locale,
  onCreateFlashcardDeck,
  priority,
  type
}: {
  article: NhkArticle;
  labels: HomepageLabels;
  locale: string;
  onCreateFlashcardDeck: (articleId: string) => void;
  priority?: boolean;
  type: NewsType;
}) {
  return (
    <Card className="group overflow-hidden rounded-[14px] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="grid min-h-full sm:grid-cols-[9.5rem_minmax(0,1fr)]">
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 sm:aspect-auto">
          {article.imageUrl ? (
            <img
              alt={article.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading={priority ? "eager" : "lazy"}
              src={article.imageUrl}
            />
          ) : (
            <div className="flex h-full min-h-32 items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-300">
              <IconDocument aria-hidden size={28} />
            </div>
          )}
        </div>
        <CardContent className="flex min-h-48 flex-col p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={type === "easy" ? "accent" : "neutral"}>{sourceLabel(type, labels)}</Badge>
            {article.difficulty ? <Badge>{article.difficulty}</Badge> : null}
          </div>
          <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-[#111827]">
            {article.title}
          </h3>
          <p className="mt-2 text-xs text-[#6B7280]">{timeAgo(article.publishedAt, labels)}</p>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <Link
              className="inline-flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#1B2A4A] px-3 text-xs font-semibold text-white transition-all duration-150 hover:bg-[#243560]"
              href={`/${locale}/news/${article.id}`}
            >
              {labels.newsReadMore}
            </Link>
            <button
              className="inline-flex min-h-9 items-center justify-center gap-1 rounded-[10px] border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition-all duration-150 hover:bg-blue-100"
              onClick={() => onCreateFlashcardDeck(article.id)}
              type="button"
            >
              <IconBookmark aria-hidden size={16} />
              {labels.newsCreateFlashcard}
            </button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export function FeaturedNewsSection({
  articlesByType,
  error,
  labels,
  loading,
  locale,
  onRetry
}: {
  articlesByType: Record<NewsType, NhkArticle[]>;
  error?: boolean;
  labels: HomepageLabels;
  loading?: boolean;
  locale: string;
  onRetry: () => void;
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
          body: JSON.stringify({
            deckTitle
          }),
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

      <TabsList className="mb-4 w-fit">
        {(["easy", "normal"] as const).map((type) => (
          <TabButton active={activeType === type} key={type} onClick={() => setActiveType(type)}>
            {sourceLabel(type, labels)}
            <span className="ml-1 tabular-nums text-current/65">{type === "easy" ? counts.easy : counts.normal}</span>
          </TabButton>
        ))}
      </TabsList>

      {flashcardMsg ? (
        <div className="mb-3 rounded-[10px] border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
          {flashcardMsg}
        </div>
      ) : null}

      {loading ? (
        <div aria-busy className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <LoadingSkeleton className="h-48 rounded-xl" key={i} />
          ))}
          <p className="sr-only">{labels.sectionLoadingHint}</p>
        </div>
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
        <EmptyState description={labels.newsEmpty} title={sourceLabel(activeType, labels)} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {articles.slice(0, 4).map((article, idx) => (
            <NewsCard
              article={article}
              key={article.id}
              labels={labels}
              locale={locale}
              onCreateFlashcardDeck={handleOpenCreateDeck}
              priority={idx < 2}
              type={activeType}
            />
          ))}
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
