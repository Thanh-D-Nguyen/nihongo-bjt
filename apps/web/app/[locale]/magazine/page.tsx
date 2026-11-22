import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { getServerApiBaseUrl } from "../../../lib/server-api-url";
import { MagazinePageClient } from "./_components/magazine-page-client";
import { MagazineGridSkeleton } from "./_components/magazine-skeleton";
import { buildMagazineHref, normalizeMagazineKind } from "./magazine-kinds";

const messages: Record<string, typeof vi> = { ja, vi, en };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return {
    title: `${t.magazine.title} — Kiokoto`,
    description: t.magazine.subtitle,
  };
}

const apiBaseUrl = getServerApiBaseUrl();

/* ─── Types ─── */

interface VocabWord {
  word: string;
  reading?: string;
  meaning?: string;
}

interface MagazineArticle {
  id: string;
  slug: string;
  widgetKind: string;
  titleJp: string;
  titleVi: string;
  summaryVi: string | null;
  jlptLevel: string | null;
  publishDate: string;
  vocabWords: VocabWord[];
}

interface MagazineResponse {
  data: MagazineArticle[];
  total: number;
  page: number;
  limit: number;
}

/* ─── Data fetching ─── */

async function fetchMagazine(kind?: string, page = 1): Promise<MagazineResponse | null> {
  try {
    const normalizedKind = normalizeMagazineKind(kind);
    const params = new URLSearchParams();
    if (normalizedKind !== "all") params.set("kind", normalizedKind);
    params.set("page", String(page));
    params.set("limit", "12");

    const res = await fetch(`${apiBaseUrl}/api/magazine?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const result: unknown = await res.json();
    if (typeof result !== "object" || result === null || !Array.isArray((result as MagazineResponse).data)) {
      return null;
    }
    return result as MagazineResponse;
  } catch {
    return null;
  }
}

/* ─── Page ─── */

export default async function MagazinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const kind = normalizeMagazineKind(sp.kind);
  const pageParam = Number(sp.page);
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const t = messages[locale] ?? messages.vi;

  const result = await fetchMagazine(kind, page);
  const retryHref = buildMagazineHref(locale, kind, page);

  return (
    <main className="min-h-screen bg-gradient-to-b from-paper via-paper to-accent/5 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header with glassmorphic accent */}
        <header className="relative mb-8 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-surface via-surface to-accent/10 p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-2xl backdrop-blur-sm">
                📰
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  {t.magazine.title}
                </h1>
                <p className="mt-0.5 text-sm text-muted sm:text-base">
                  {t.magazine.subtitle}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <Suspense fallback={<MagazineGridSkeleton />}>
          {result ? (
            <MagazinePageClient
              articles={result.data}
              locale={locale}
              kind={kind}
              page={result.page}
              totalPages={Math.ceil(result.total / result.limit)}
              t={t.magazine}
            />
          ) : (
            <section role="alert" className="mt-12 rounded-3xl border border-border bg-surface p-8 text-center">
              <h2 className="text-xl font-bold text-ink">{t.magazine.loadErrorTitle}</h2>
              <p className="mt-2 text-sm text-muted">{t.magazine.loadErrorDescription}</p>
              <Link href={retryHref} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-action px-5 py-2.5 text-sm font-semibold text-white hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35">
                {t.magazine.retry}
              </Link>
            </section>
          )}
        </Suspense>
      </div>
    </main>
  );
}
