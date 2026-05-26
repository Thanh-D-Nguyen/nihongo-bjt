import type { Metadata } from "next";
import { Suspense } from "react";

import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { MagazinePageClient } from "./_components/magazine-page-client";
import { MagazineGridSkeleton } from "./_components/magazine-skeleton";

const messages: Record<string, typeof vi> = { ja, vi, en };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return {
    title: `${t.magazine.title} — NihonGo BJT`,
    description: t.magazine.subtitle,
  };
}

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

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
    const params = new URLSearchParams();
    if (kind && kind !== "all") params.set("kind", kind);
    params.set("page", String(page));
    params.set("limit", "12");

    const res = await fetch(`${apiBaseUrl}/api/magazine?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as MagazineResponse;
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
  const kind = sp.kind ?? "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const t = messages[locale] ?? messages.vi;

  const result = await fetchMagazine(kind, page);
  const articles = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / 12);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header with glassmorphic accent */}
        <header className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-accent/10 to-transparent p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl backdrop-blur-sm">
                📰
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {t.magazine.title}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">
                  {t.magazine.subtitle}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <Suspense fallback={<MagazineGridSkeleton />}>
          <MagazinePageClient
            articles={articles}
            locale={locale}
            kind={kind}
            page={page}
            totalPages={totalPages}
            t={t.magazine}
          />
        </Suspense>
      </div>
    </main>
  );
}
