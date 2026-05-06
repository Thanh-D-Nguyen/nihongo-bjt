"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch, learnerApiFetchOptional } from "../../../../../lib/learner-api";

interface NhkArticleDetail {
  id: string;
  title: string;
  titleWithRuby: string | null;
  publishedAt: string;
  imageUrl: string | null;
  difficulty: string | null;
  url: string;
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
  signInToAdd: string;
  publishedAt: string;
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
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());
  const [addingWord, setAddingWord] = useState<string | null>(null);

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

  const handleAddFlashcard = useCallback(
    async (vocab: VocabItem) => {
      if (!auth.userId) return;
      setAddingWord(vocab.word);
      try {
        const res = await learnerApiFetch(`/api/nhk-news/${encodeURIComponent(articleId)}/flashcard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: vocab.word,
            reading: vocab.reading,
            meaning: vocab.meaning,
            cardType: vocab.pos === "名詞" ? "vocabulary" : vocab.pos === "動詞" ? "vocabulary" : "vocabulary",
          }),
        });
        if (res.ok) {
          setAddedWords((prev) => new Set(prev).add(vocab.word));
        }
      } catch {
        // silent
      } finally {
        setAddingWord(null);
      }
    },
    [auth.userId, articleId]
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
          <Image
            src={article.imageUrl}
            alt={article.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
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

        {/* Ruby title */}
        {article.titleWithRuby && (
          <div className="mt-2 text-sm text-muted" lang="ja">
            <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
              {labels.readingTitle}
            </span>
            <p
              className="mt-1 leading-loose"
              dangerouslySetInnerHTML={{ __html: article.titleWithRuby }}
            />
          </div>
        )}
      </div>

      {/* Body */}
      <article
        className="nhk-body mt-6 space-y-4 text-base leading-relaxed text-ink/90"
        lang="ja"
        dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
      />

      {/* Original link */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center gap-1 rounded-lg bg-gray-50 px-4 py-2 text-sm font-medium text-muted hover:bg-gray-100 hover:text-ink transition-colors"
      >
        {labels.originalArticle}
      </a>

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
                  <th className="px-4 py-3 w-24" />
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
                    <td className="px-4 py-3">
                      {!auth.userId ? (
                        <span className="text-xs text-muted">{labels.signInToAdd}</span>
                      ) : addedWords.has(v.word) ? (
                        <span className="text-xs font-medium text-emerald-600">{labels.addedFlashcard}</span>
                      ) : (
                        <button
                          onClick={() => handleAddFlashcard(v)}
                          disabled={addingWord === v.word}
                          className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                          type="button"
                        >
                          {addingWord === v.word ? "..." : labels.addFlashcard}
                        </button>
                      )}
                    </td>
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
                  {v.pos && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-muted" lang="ja">{v.pos}</span>
                  )}
                </div>
                {v.meaning && <p className="mt-2 text-sm text-muted">{v.meaning}</p>}
                <div className="mt-3">
                  {!auth.userId ? (
                    <span className="text-xs text-muted">{labels.signInToAdd}</span>
                  ) : addedWords.has(v.word) ? (
                    <span className="text-xs font-medium text-emerald-600">{labels.addedFlashcard}</span>
                  ) : (
                    <button
                      onClick={() => handleAddFlashcard(v)}
                      disabled={addingWord === v.word}
                      className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      type="button"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M12 5v14m-7-7h14" strokeLinecap="round" />
                      </svg>
                      {addingWord === v.word ? "..." : labels.addFlashcard}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
