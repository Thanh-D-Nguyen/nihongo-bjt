"use client";

import DOMPurify from "isomorphic-dompurify";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch, learnerApiFetchOptional } from "../../../../../lib/learner-api";
import { NhkCreateDeckDialog } from "../../../_components/nhk-create-deck-dialog";

/** Sanitize NHK HTML — allow ruby/rt for furigana, basic formatting */
function sanitizeNhkHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "ruby", "rt", "rp", "span", "strong", "em", "a", "img"],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "class", "lang"],
    ALLOW_DATA_ATTR: false,
  });
}

interface NhkArticleDetail {
  id: string;
  title: string;
  titleWithRuby: string | null;
  publishedAt: string;
  imageUrl: string | null;
  audioUrl: string | null;
  difficulty: string | null;
  url: string;
  sourceType?: string;
  bodyHtml: string;
  bodyPlain: string;
  vocabulary: VocabItem[];
}

interface VocabItem {
  word: string;
  reading: string | null;
  meaning: string | null;
  pos: string | null;
}

interface Labels {
  backToHome: string;
  backToNews: string;
  difficulty: string;
  errorLoad: string;
  errorNotFound: string;
  loading: string;
  originalArticle: string;
  readingTitle: string;
  title: string;
  vocabTitle: string;
  vocabWord: string;
  vocabReading: string;
  vocabMeaning: string;
  vocabPos: string;
  addFlashcard: string;
  addedFlashcard: string;
  addFlashcardError: string;
  deckCreateCancel: string;
  deckCreateDescription: string;
  deckCreateSubmit: string;
  deckCreateTitle: string;
  deckNameAutoHint: string;
  deckNameLabel: string;
  deckNamePlaceholder: string;
  deckCreated: string;
  signInToAdd: string;
  publishedAt: string;
  addWordFlashcard: string;
  wordAdded: string;
  bookmarkAdd: string;
  bookmarkRemove: string;
  summaryNote: string;
  readFullArticle: string;
  furiganaToggle: string;
  furiganaOn: string;
  furiganaOff: string;
}

export function NhkArticleDetailClient({
  articleId,
  labels,
  locale,
}: {
  articleId: string;
  labels: Labels;
  locale: string;
}) {
  const auth = useKeycloakAuth();
  const [article, setArticle] = useState<NhkArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deckStatus, setDeckStatus] = useState<string | null>(null);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [deckDialogOpen, setDeckDialogOpen] = useState(false);
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [togglingBookmark, setTogglingBookmark] = useState(false);
  const [showFurigana, setShowFurigana] = useState(true);
  const readStartRef = { current: Date.now() };

  const safeBodyHtml = useMemo(() => article ? sanitizeNhkHtml(article.bodyHtml) : "", [article]);
  const safeTitleRuby = useMemo(() => article?.titleWithRuby ? sanitizeNhkHtml(article.titleWithRuby) : "", [article]);

  const handleAddWord = useCallback(
    async (v: VocabItem) => {
      if (!auth.userId || savedWords.has(v.word)) return;
      setSavingWord(v.word);
      try {
        const cardType = v.pos === "grammar" ? "grammar" : "vocabulary";
        const res = await learnerApiFetch(`/api/nhk-news/${encodeURIComponent(articleId)}/flashcard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: v.word, reading: v.reading, meaning: v.meaning, cardType }),
        });
        if (res.ok) {
          setSavedWords((prev) => new Set(prev).add(v.word));
        }
      } catch { /* ignore */ } finally {
        setSavingWord(null);
      }
    },
    [auth.userId, articleId, savedWords]
  );

  const handleToggleBookmark = useCallback(async () => {
    if (!auth.userId || togglingBookmark) return;
    setTogglingBookmark(true);
    try {
      const res = await learnerApiFetch(`/api/nhk-news/${encodeURIComponent(articleId)}/bookmark`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarked(data.bookmarked);
      }
    } catch { /* ignore */ } finally {
      setTogglingBookmark(false);
    }
  }, [auth.userId, articleId, togglingBookmark]);

  // Track reading time on unmount / page leave
  useEffect(() => {
    if (!auth.userId || !article) return;
    readStartRef.current = Date.now();
    const trackOnLeave = () => {
      const sec = Math.round((Date.now() - readStartRef.current) / 1000);
      if (sec < 3) return; // too short, skip
      void learnerApiFetch(`/api/nhk-news/${encodeURIComponent(articleId)}/reading`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readTimeSec: sec, completed: sec >= 30 }),
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", trackOnLeave);
    return () => {
      trackOnLeave();
      window.removeEventListener("beforeunload", trackOnLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId, article?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await learnerApiFetchOptional(`/api/nhk-news/${encodeURIComponent(articleId)}`);
      if (!res?.ok) {
        setError(res?.status === 404 ? labels.errorNotFound : labels.errorLoad);
        return;
      }
      setArticle(await res.json());
    } catch {
      setError(labels.errorLoad);
    } finally {
      setLoading(false);
    }
  }, [articleId, labels.errorLoad, labels.errorNotFound]);

  useEffect(() => {
    void load();
  }, [load]);

  // Check bookmark status on mount
  useEffect(() => {
    if (!auth.userId) return;
    void learnerApiFetchOptional(`/api/nhk-news/${encodeURIComponent(articleId)}/bookmark`)
      .then(async (r) => {
        if (!r?.ok) return;
        const data = await r.json();
        setBookmarked(!!data.bookmarked);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId]);

  const handleCreateDeck = useCallback(
    async (deckTitle: string | null) => {
      if (!auth.userId) return;
      setCreatingDeck(true);
      setDeckStatus(null);
      setDeckError(null);
      try {
        const res = await learnerApiFetch(`/api/nhk-news/${encodeURIComponent(articleId)}/flashcards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deckTitle
          }),
        });
        if (res.ok) {
          setDeckDialogOpen(false);
          setDeckStatus(labels.deckCreated);
        } else {
          setDeckError(labels.addFlashcardError);
        }
      } catch {
        setDeckError(labels.addFlashcardError);
      } finally {
        setCreatingDeck(false);
      }
    },
    [auth.userId, articleId, labels.addFlashcardError, labels.deckCreated]
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="h-6 w-32 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-56 animate-pulse rounded-2xl bg-gray-100" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </main>
    );
  }

  if (error || !article) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href={`/${locale}/news`} className="text-sm text-muted hover:text-ink">
          {labels.backToNews}
        </Link>
        <div className="mt-8 rounded-2xl bg-red-50 p-6 text-center">
          <p className="text-red-700">{error ?? labels.errorNotFound}</p>
        </div>
      </main>
    );
  }

  const publishDate = new Date(article.publishedAt).toLocaleDateString(
    locale === "ja" ? "ja-JP" : "vi-VN",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-sm text-muted">
        <Link href={`/${locale}`} className="hover:text-ink transition-colors">
          {labels.backToHome}
        </Link>
        <span>/</span>
        <Link href={`/${locale}/news`} className="hover:text-ink transition-colors">
          {labels.title}
        </Link>
      </nav>

      {/* Hero image */}
      {article.imageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gray-100">
          <img
            alt={article.title}
            className="h-full w-full object-cover"
            loading="eager"
            src={article.imageUrl}
          />
        </div>
      )}

      {/* Title + meta */}
      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {article.difficulty && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              {labels.difficulty}: {article.difficulty}
            </span>
          )}
          <time>{labels.publishedAt.replace("{time}", publishDate)}</time>
        </div>

        <h1 className="mt-3 text-2xl font-bold leading-tight text-ink sm:text-3xl" lang="ja">
          {article.title}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div
            aria-label={labels.furiganaToggle}
            className="inline-flex min-h-12 items-center rounded-xl border border-ink/10 bg-surface p-1 shadow-sm"
            role="group"
          >
            <button
              aria-pressed={showFurigana}
              className={`min-h-10 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                showFurigana ? "bg-ink text-surface" : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
              onClick={() => setShowFurigana(true)}
              type="button"
            >
              {labels.furiganaOn}
            </button>
            <button
              aria-pressed={!showFurigana}
              className={`min-h-10 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                !showFurigana ? "bg-ink text-surface" : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
              onClick={() => setShowFurigana(false)}
              type="button"
            >
              {labels.furiganaOff}
            </button>
          </div>
          {auth.userId ? (
            <>
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 text-sm font-semibold text-surface transition hover:bg-ink/90 disabled:opacity-50"
                disabled={creatingDeck || article.vocabulary.length === 0}
                onClick={() => {
                  setDeckError(null);
                  setDeckDialogOpen(true);
                }}
                type="button"
              >
                {creatingDeck ? labels.loading : labels.addFlashcard}
              </button>
              <button
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-50 ${
                  bookmarked
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-gray-200 bg-surface text-muted hover:border-accent hover:text-accent"
                }`}
                disabled={togglingBookmark}
                onClick={handleToggleBookmark}
                type="button"
                aria-label={bookmarked ? labels.bookmarkRemove : labels.bookmarkAdd}
              >
                <svg className="h-4 w-4" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {bookmarked ? labels.bookmarkRemove : labels.bookmarkAdd}
              </button>
            </>
          ) : (
            <span className="text-sm font-medium text-muted">{labels.signInToAdd}</span>
          )}
          {deckStatus ? <span className="text-sm font-semibold text-emerald-700">{deckStatus}</span> : null}
        </div>

        {/* Ruby title */}
        {article.titleWithRuby && showFurigana && (
          <div className="mt-2 text-sm text-muted" lang="ja">
            <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
              {labels.readingTitle}
            </span>
            <p
              className="mt-1 leading-loose"
              dangerouslySetInnerHTML={{ __html: safeTitleRuby }}
            />
          </div>
        )}
      </div>

      {/* Audio player */}
      {article.audioUrl && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <svg className="h-5 w-5 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M18 3.25a.75.75 0 00-1.154-.632L10 7.133V4.25a.75.75 0 00-1.154-.632l-7.5 4.75a.75.75 0 000 1.264l7.5 4.75A.75.75 0 0010 13.75v-2.883l6.846 4.515A.75.75 0 0018 14.75V3.25z" />
          </svg>
          <audio
            className="h-8 w-full min-w-0"
            controls
            controlsList="nodownload"
            preload="none"
            src={article.audioUrl}
          >
            <track kind="captions" />
          </audio>
        </div>
      )}

      {/* Summary notice for normal articles */}
      {article.sourceType === "normal" && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <span>{labels.summaryNote}</span>
        </div>
      )}

      {/* Body */}
      <article
        className={`nhk-body mt-6 space-y-4 text-base leading-relaxed text-ink/90 ${
          showFurigana ? "" : "nhk-hide-furigana"
        }`}
        lang="ja"
        dangerouslySetInnerHTML={{ __html: safeBodyHtml }}
      />
      <style jsx global>{`
        .nhk-hide-furigana rt,
        .nhk-hide-furigana rp {
          display: none;
        }
      `}</style>

      {/* Read full article CTA — prominent for normal, subtle for easy */}
      {article.sourceType === "normal" ? (
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent/90"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {labels.readFullArticle}
        </a>
      ) : (
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1 rounded-lg bg-gray-50 px-4 py-2 text-sm font-medium text-muted hover:bg-gray-100 hover:text-ink transition-colors"
        >
          {labels.originalArticle}
        </a>
      )}

      {/* Vocabulary table */}
      {article.vocabulary.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {labels.vocabTitle}
          </h2>

          <div className="overflow-hidden rounded-xl ring-1 ring-ink/8">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">{labels.vocabWord}</th>
                  <th className="px-4 py-3">{labels.vocabReading}</th>
                  <th className="px-4 py-3 hidden sm:table-cell">{labels.vocabMeaning}</th>
                  <th className="px-4 py-3 hidden sm:table-cell">{labels.vocabPos}</th>
                  {auth.userId && <th className="px-4 py-3 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {article.vocabulary.map((v) => (
                  <tr key={v.word} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-ink" lang="ja">
                      {v.word}
                    </td>
                    <td className="px-4 py-3 text-muted" lang="ja">
                      {v.reading ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted hidden sm:table-cell">
                      {v.meaning ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted hidden sm:table-cell" lang="ja">
                      {v.pos ?? "—"}
                    </td>
                    {auth.userId && (
                      <td className="px-2 py-3 text-center">
                        {savedWords.has(v.word) ? (
                          <span className="text-xs text-emerald-600">✓</span>
                        ) : (
                          <button
                            type="button"
                            disabled={savingWord === v.word}
                            onClick={() => void handleAddWord(v)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-accent-soft hover:text-accent transition-colors disabled:opacity-50"
                            title={labels.addWordFlashcard}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile vocab cards (shown below sm) */}
          <div className="mt-4 space-y-3 sm:hidden">
            {article.vocabulary.map((v) => (
              <div key={`m-${v.word}`} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink/5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-semibold text-ink" lang="ja">{v.word}</p>
                    {v.reading && <p className="text-xs text-muted" lang="ja">{v.reading}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {v.pos && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-muted" lang="ja">{v.pos}</span>
                    )}
                    {auth.userId && (
                      savedWords.has(v.word) ? (
                        <span className="text-xs text-emerald-600">✓</span>
                      ) : (
                        <button
                          type="button"
                          disabled={savingWord === v.word}
                          onClick={() => void handleAddWord(v)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-accent-soft hover:text-accent transition-colors disabled:opacity-50"
                          title={labels.addWordFlashcard}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>
                </div>
                {v.meaning && <p className="mt-2 text-sm text-muted">{v.meaning}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <NhkCreateDeckDialog
        labels={{
          cancel: labels.deckCreateCancel,
          description: labels.deckCreateDescription,
          error: deckError ?? undefined,
          nameHint: labels.deckNameAutoHint,
          nameLabel: labels.deckNameLabel,
          namePlaceholder: labels.deckNamePlaceholder,
          submit: creatingDeck ? labels.loading : labels.deckCreateSubmit,
          title: labels.deckCreateTitle
        }}
        loading={creatingDeck}
        onClose={() => {
          setDeckDialogOpen(false);
          setDeckError(null);
        }}
        onSubmit={handleCreateDeck}
        open={deckDialogOpen}
      />
    </main>
  );
}
