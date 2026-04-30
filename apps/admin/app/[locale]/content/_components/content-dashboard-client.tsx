"use client";

import type { AdminContentSummaryResponse, ContentSummary } from "@nihongo-bjt/shared";
import { AdminKpiCard, AdminPageHeader, AdminSection, Card, CardContent, cn } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

export interface ContentHubLabels {
  error: string;
  empty: string;
  examples: string;
  examplesNote: string;
  grammarPoints: string;
  kanji: string;
  kpiDescription: string;
  kpiTitle: string;
  lexemes: string;
  loading: string;
  moreDescription: string;
  moreTitle: string;
  subtitle: string;
  title: string;
  toolsDescription: string;
  toolsTitle: string;
  toolDictionaryDesc: string;
  toolDictionaryTitle: string;
  toolGrammarDesc: string;
  toolGrammarTitle: string;
  toolImportDesc: string;
  toolImportTitle: string;
  toolKanjiDesc: string;
  toolKanjiTitle: string;
  toolMediaDesc: string;
  toolMediaTitle: string;
  toolQualityReviewDesc: string;
  toolQualityReviewTitle: string;
}

export function ContentDashboardClient({
  labels,
  locale
}: {
  labels: ContentHubLabels;
  locale: string;
}) {
  const [summary, setSummary] = useState<ContentSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const base = `/${locale}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void (async () => {
      try {
        const loadSummary = async (type: "example" | "grammar" | "kanji" | "lexeme") => {
          const res = await adminApiFetch(`/api/admin/content/summary?type=${type}`);
          if (!res.ok) {
            throw new Error("summary_failed");
          }
          return (await res.json()) as AdminContentSummaryResponse;
        };

        const [lexemes, kanji, grammarPoints, examples] = await Promise.all([
          loadSummary("lexeme"),
          loadSummary("kanji"),
          loadSummary("grammar"),
          loadSummary("example")
        ]);

        const data: ContentSummary = {
          examples: examples.total,
          grammarPoints: grammarPoints.total,
          kanji: kanji.total,
          lexemes: lexemes.total
        };

        if (!cancelled) {
          setSummary(data);
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allZero =
    summary != null &&
    summary.lexemes + summary.kanji + summary.grammarPoints + summary.examples === 0;

  return (
    <div className="space-y-8">
      <AdminPageHeader description={labels.subtitle} title={labels.title} />

      {loadError ? (
        <p className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900" role="alert">
          {labels.error}
        </p>
      ) : null}

      <AdminSection description={labels.kpiDescription} title={labels.kpiTitle}>
        {loading && !loadError ? (
          <p className="text-sm text-slate-600">{labels.loading}</p>
        ) : null}
        {summary && !loadError ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AdminKpiCard label={labels.lexemes} value={summary.lexemes.toLocaleString()} />
              <AdminKpiCard label={labels.kanji} value={summary.kanji.toLocaleString()} />
              <AdminKpiCard label={labels.grammarPoints} value={summary.grammarPoints.toLocaleString()} />
              <AdminKpiCard label={labels.examples} value={summary.examples.toLocaleString()} />
            </div>
            {allZero ? <p className="text-sm text-slate-600">{labels.empty}</p> : null}
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{labels.examplesNote}</p>
          </>
        ) : null}
      </AdminSection>

      <AdminSection description={labels.toolsDescription} title={labels.toolsTitle}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ContentNavCard
            description={labels.toolDictionaryDesc}
            href={`${base}/dictionary`}
            title={labels.toolDictionaryTitle}
          />
          <ContentNavCard
            description={labels.toolKanjiDesc}
            href={`${base}/kanji`}
            title={labels.toolKanjiTitle}
          />
          <ContentNavCard
            description={labels.toolGrammarDesc}
            href={`${base}/grammar`}
            title={labels.toolGrammarTitle}
          />
        </div>
      </AdminSection>

      <AdminSection description={labels.moreDescription} title={labels.moreTitle}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ContentNavCard
            description={labels.toolMediaDesc}
            href={`${base}/media`}
            title={labels.toolMediaTitle}
          />
          <ContentNavCard
            description={labels.toolImportDesc}
            href={`${base}/import`}
            title={labels.toolImportTitle}
          />
          <ContentNavCard
            description={labels.toolQualityReviewDesc}
            href={`${base}/content/quality-review`}
            title={labels.toolQualityReviewTitle}
          />
        </div>
      </AdminSection>
    </div>
  );
}

const contentNavLinkClass = cn(
  "group block outline-none transition-transform duration-200 hover:-translate-y-0.5",
  "focus-visible:ring-2 focus-visible:ring-accent-mid focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
);

function ContentNavCard({ description, href, title }: { description: string; href: string; title: string }) {
  return (
    <Link className={contentNavLinkClass} href={href}>
      <Card className="h-full border-ink/8 transition-shadow group-hover:border-accent/25 group-hover:shadow-[0_16px_48px_rgba(79,70,229,0.08)]">
        <CardContent className="space-y-1 pt-5">
          <p className="font-semibold text-ink">{title}</p>
          <p className="text-sm leading-snug text-muted">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
