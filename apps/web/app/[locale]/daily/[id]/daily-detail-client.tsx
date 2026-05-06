"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { AnnotatedJapaneseText } from "../../../../components/reading-assist/annotated-japanese-text";
import { learnerApiFetch, learnerApiFetchOptional } from "../../../../lib/learner-api";

/* ── types ── */
interface DailyItemDetail {
  id: string;
  title: string;
  widgetKind: string;
  contentDate: string;
  locale: string;
  japaneseText: string | null;
  readingText: string | null;
  explanationText: string | null;
  bodyMd: string | null;
  sourceProvider: string | null;
  sourceRef: string | null;
  learningSafeguard?: {
    learningObjective: string;
    riskDisclaimer: string;
    remediationLinks: Array<{ href: string; label: string }>;
    sourceTitle: string | null;
    sourceUrl: string | null;
    sourceDate: string | null;
  };
}

type AnnotatedLabels = {
  addCardAction: string;
  addCardError: string;
  addCardNoDeck: string;
  addCardSuccess: string;
  bottomSheetClose: string;
  errorHttp: string;
  errorNetwork: string;
  errorTimeout: string;
  furiganaLabel: string;
  lexemeLine: string;
  loadingText: string;
  meaningLabel: string;
  posLabel: string;
  retryAction: string;
  serviceUnavailable: string;
};

type DailyLabels = Record<string, string>;
type DetailLabels = Record<string, string>;

const WIDGET_KIND_LABELS: Record<string, { emoji: string; vi: string }> = {
  weather: { emoji: "🌤", vi: "Thời tiết" },
  business_phrase: { emoji: "💼", vi: "Công sở" },
  seasonal_word: { emoji: "🌸", vi: "Từ mùa" },
  life_situation: { emoji: "🚃", vi: "Đời sống" },
  life_housing: { emoji: "🏠", vi: "Thuê nhà" },
  life_banking: { emoji: "🏦", vi: "Ngân hàng" },
  life_tax: { emoji: "📋", vi: "Thuế & bảo hiểm" },
  time_greeting: { emoji: "⏰", vi: "Chào theo giờ" },
  nhk_news: { emoji: "📰", vi: "Tin NHK" }
};

function kindLabel(kind: string) {
  const k = WIDGET_KIND_LABELS[kind];
  return k ? `${k.emoji} ${k.vi}` : kind;
}

export function DailyDetailClient({
  dailyLabels,
  detailLabels,
  id,
  locale,
  readingAssistLabels
}: {
  dailyLabels: DailyLabels;
  detailLabels: DetailLabels;
  id: string;
  locale: string;
  readingAssistLabels: AnnotatedLabels;
}) {
  const t = useCallback((k: string) => detailLabels[k] ?? k, [detailLabels]);
  const auth = useKeycloakAuth();
  const userId = auth.userId ?? "";

  const [item, setItem] = useState<DailyItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  /* load item */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const r = await learnerApiFetchOptional(`/api/daily/items/${encodeURIComponent(id)}`);
        if (!r.ok) {
          if (!cancelled) setError(t("errorNotFound"));
          return;
        }
        if (!cancelled) setItem((await r.json()) as DailyItemDetail);
      } catch {
        if (!cancelled) setError(t("errorLoad"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, t]);

  /* actions */
  const postAction = async (action: "generate-flashcards" | "quick-quiz" | "mark-useful") => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch(`/api/daily/items/${id}/${action}`, {
        body: JSON.stringify({ userId }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (r.ok) {
        if (action === "generate-flashcards") setActionMsg(dailyLabels.cardsCreated ?? "OK");
        else if (action === "mark-useful") setActionMsg(t("markedUseful"));
        else setActionMsg("OK");
      }
    } catch {
      setActionMsg(dailyLabels.widgetActionError ?? "Error");
    }
    setTimeout(() => setActionMsg(null), 3000);
  };

  /* ── render ── */
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded bg-ink/10" />
          <div className="h-10 w-2/3 rounded bg-ink/10" />
          <div className="h-24 rounded bg-ink/10" />
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-sm text-muted">{error ?? t("errorNotFound")}</p>
        <Link
          className="mt-4 inline-block rounded-xl border border-ink/12 px-4 py-2 text-sm font-medium text-ink hover:bg-surface"
          href={`/${locale}`}
        >
          {t("backToHome")}
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl px-4 py-8">
      {/* breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-muted">
        <Link className="hover:text-ink transition-colors" href={`/${locale}`}>
          {t("home")}
        </Link>
        <span>/</span>
        <span>{kindLabel(item.widgetKind)}</span>
      </nav>

      {/* header */}
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            {kindLabel(item.widgetKind)}
          </span>
          <time className="text-xs text-muted" dateTime={item.contentDate}>
            {new Date(item.contentDate).toLocaleDateString(locale === "ja" ? "ja-JP" : "vi-VN", {
              day: "numeric",
              month: "long",
              year: "numeric"
            })}
          </time>
        </div>
        <h1 className="text-2xl font-bold leading-tight text-ink">{item.title}</h1>
      </header>

      {/* ── Japanese content block with reading assist ── */}
      {item.japaneseText ? (
        <section className="mb-6 rounded-2xl border border-ink/8 bg-surface p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg" aria-hidden>日</span>
            <h2 className="text-sm font-semibold text-ink">{t("japaneseContent")}</h2>
          </div>

          {/* main Japanese text with reading assist */}
          <div className="rounded-xl bg-paper p-4">
            {userId ? (
              <AnnotatedJapaneseText
                analyzePath="/api/reading-assist/analyze"
                analyticsPath="/api/reading-assist/analytics"
                displayMode="hover"
                labels={readingAssistLabels}
                text={item.japaneseText}
                userId={userId}
              />
            ) : (
              <p className="jp-text text-xl font-bold leading-relaxed text-ink">
                {item.japaneseText}
              </p>
            )}
          </div>

          {/* reading (furigana) */}
          {item.readingText ? (
            <div className="mt-3 rounded-xl bg-accent/5 px-4 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1">{t("reading")}</div>
              <p className="jp-text text-base text-ink/80">{item.readingText}</p>
            </div>
          ) : null}

          {/* explanation */}
          {item.explanationText ? (
            <div className="mt-3 rounded-xl bg-paper px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1">{t("explanation")}</div>
              <p className="text-sm leading-relaxed text-ink/80">{item.explanationText}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── body markdown ── */}
      {item.bodyMd ? (
        <section className="mb-6">
          <div className="prose prose-sm prose-slate max-w-none text-ink/90">
            {/* render bodyMd paragraphs — each paragraph may contain Japanese */}
            {item.bodyMd.split("\n\n").map((para, i) => {
              const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(para);
              if (hasJapanese && userId) {
                return (
                  <div key={i} className="mb-3">
                    <AnnotatedJapaneseText
                      analyzePath="/api/reading-assist/analyze"
                      analyticsPath="/api/reading-assist/analytics"
                      displayMode="hover"
                      labels={readingAssistLabels}
                      text={para}
                      userId={userId}
                    />
                  </div>
                );
              }
              return (
                <p key={i} className="mb-3 leading-relaxed">
                  {para}
                </p>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── learning safeguard (Life in Japan) ── */}
      {item.learningSafeguard ? (
        <section className="mb-6 rounded-2xl border border-amber-800/20 bg-amber-50/50 p-4 space-y-2">
          <p className="text-xs text-amber-950">
            <strong>{dailyLabels.lifeLearningObjectiveLabel}: </strong>
            {item.learningSafeguard.learningObjective}
          </p>
          <p className="text-xs text-amber-950">
            <strong>{dailyLabels.lifeDisclaimerLabel}: </strong>
            {item.learningSafeguard.riskDisclaimer}
          </p>
          {(item.learningSafeguard.sourceTitle || item.learningSafeguard.sourceUrl) ? (
            <p className="text-xs text-amber-900">
              <strong>{dailyLabels.lifeSourceLabel}: </strong>
              {item.learningSafeguard.sourceTitle ?? ""}
              {item.learningSafeguard.sourceUrl ? (
                <> — <a className="underline underline-offset-2" href={item.learningSafeguard.sourceUrl} rel="noreferrer" target="_blank">{item.learningSafeguard.sourceUrl}</a></>
              ) : null}
            </p>
          ) : null}
          {item.learningSafeguard.remediationLinks.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-900">{dailyLabels.lifeRemediationLabel}</p>
              <ul className="space-y-1">
                {item.learningSafeguard.remediationLinks.slice(0, 5).map((link) => (
                  <li key={link.href}>
                    <a className="text-xs text-amber-900 underline underline-offset-2" href={link.href} rel="noreferrer" target="_blank">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── source info ── */}
      {(item.sourceProvider || item.sourceRef) ? (
        <div className="mb-6 text-xs text-muted">
          {item.sourceProvider ? <span>{t("source")}: {item.sourceProvider}</span> : null}
          {item.sourceRef ? <span className="ml-2">({item.sourceRef})</span> : null}
        </div>
      ) : null}

      {/* ── learner actions ── */}
      {userId ? (
        <section className="mb-8 flex flex-wrap gap-3 border-t border-ink/8 pt-4">
          <button
            className="rounded-xl border border-ink/12 bg-paper/80 px-4 py-2.5 text-sm font-medium text-ink hover:bg-paper transition-colors"
            type="button"
            onClick={() => void postAction("generate-flashcards")}
          >
            {dailyLabels.addCards}
          </button>
          <button
            className="rounded-xl border border-ink/12 bg-paper/80 px-4 py-2.5 text-sm font-medium text-ink hover:bg-paper transition-colors"
            type="button"
            onClick={() => void postAction("quick-quiz")}
          >
            {dailyLabels.quickQuiz}
          </button>
          <button
            className="rounded-xl border border-ink/12 bg-paper/80 px-4 py-2.5 text-sm font-medium text-ink hover:bg-paper transition-colors"
            type="button"
            onClick={() => void postAction("mark-useful")}
          >
            {dailyLabels.markUseful}
          </button>
        </section>
      ) : null}

      {actionMsg ? (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {actionMsg}
        </div>
      ) : null}

      {/* back link */}
      <nav className="border-t border-ink/8 pt-4">
        <Link
          className="text-sm font-medium text-accent hover:underline"
          href={`/${locale}`}
        >
          ← {t("backToHome")}
        </Link>
      </nav>
    </article>
  );
}
