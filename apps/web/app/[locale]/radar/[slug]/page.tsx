import type { Metadata } from "next";
import Link from "next/link";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { BackNavigation } from "../../_components/back-navigation";
import { DetailHeroHeader, themeGradients, defaultTheme } from "../../_components/detail-hero-header";
import { VocabExpressionList } from "./_components/vocab-expression-list";
import type { VocabExpression } from "./_components/vocab-expression-list";

const messagesMap = { en, ja, vi } as const;
type Locale = keyof typeof messagesMap;
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

/* ─── Types ─── */

type CardDetail = {
  badgeTextVi: string | null;
  category: string;
  ctaLabelVi: string;
  descriptionVi: string;
  estimatedMinutes: number | null;
  id: string;
  levelLabel: string | null;
  metadata: Record<string, unknown> | null;
  module: {
    disclaimerVi: string | null;
    moduleKey: string;
    titleJa: string;
    titleVi: string;
  };
  moduleType: string;
  recommendationReasonVi: string | null;
  slug: string;
  targetRoute: string | null;
  titleJa: string | null;
  titleVi: string;
  visualTheme: string | null;
};

/* ─── Data fetching ─── */

async function fetchCard(slug: string): Promise<CardDetail | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/daily-radar/cards/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as CardDetail;
  } catch {
    return null;
  }
}

/* ─── SEO Metadata ─── */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const card = await fetchCard(slug);
  if (!card) return { title: "Not Found" };

  const title = `${card.titleVi} | NihonGo BJT`;
  const description = card.descriptionVi;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      locale: locale === "ja" ? "ja_JP" : locale === "en" ? "en_US" : "vi_VN",
      type: "article",
    },
  };
}

/* ─── Helpers ─── */

function parseExpressions(meta: Record<string, unknown>): VocabExpression[] {
  const raw = meta.japaneseExpressions;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && "word" in item)
    .map((item) => ({
      word: String(item.word ?? ""),
      reading: String(item.reading ?? ""),
      meaning: String(item.meaning ?? ""),
      jlptLevel: typeof item.jlptLevel === "string" ? item.jlptLevel : undefined,
      example: typeof item.example === "string" ? item.example : undefined,
      exampleReading: typeof item.exampleReading === "string" ? item.exampleReading : undefined,
      exampleMeaning: typeof item.exampleMeaning === "string" ? item.exampleMeaning : undefined,
      usageNote: typeof item.usageNote === "string" ? item.usageNote : undefined,
    }));
}

/* ─── Page component ─── */

export default async function RadarCardPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = messagesMap[locale] ?? messagesMap.vi;
  const labels = t.homepage.dailyRadar;
  const detail = t.homepage.radarDetail;
  const card = await fetchCard(slug);

  if (!card) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
        <div className="rounded-full bg-slate-100 p-4">
          <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">{detail.notFound}</h1>
        <p className="mt-2 text-sm text-slate-600">{detail.notFoundDesc}</p>
        <Link
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-95"
          href={`/${locale}`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {detail.backHome}
        </Link>
      </main>
    );
  }

  const meta = card.metadata ?? {};
  const expressions = parseExpressions(meta);
  const skills = Array.isArray(meta.skills) ? (meta.skills as string[]) : [];
  const contentGoal = typeof meta.contentGoal === "string" ? meta.contentGoal : null;
  const usageNote = typeof meta.usageNote === "string" ? meta.usageNote : null;
  const theme = themeGradients[card.visualTheme ?? ""] ?? defaultTheme;
  const categoryLabel =
    labels[`category${card.category.charAt(0).toUpperCase()}${card.category.slice(1)}` as keyof typeof labels] ??
    card.category;

  const expressionLabels = {
    addToFlashcard: detail.addToFlashcard,
    addedToFlashcard: detail.addedToFlashcard,
    example: detail.example,
    exampleMeaning: detail.exampleMeaning,
    listenPronunciation: detail.listenPronunciation,
    meaning: detail.meaning,
    reading: detail.reading,
    tapToExpand: detail.tapToExpand,
    usageNote: detail.usageNote,
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <BackNavigation href={`/${locale}`} label={card.module.titleVi} />

      <article className="space-y-6">
        {/* Hero header */}
        <DetailHeroHeader
          bgGradient={theme.bg}
          badges={
            <>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-widest ring-1 ring-white/25 backdrop-blur-sm">
                {categoryLabel}
              </span>
              {card.levelLabel && (
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                  {card.levelLabel}
                </span>
              )}
              {card.badgeTextVi && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900">
                  {card.badgeTextVi}
                </span>
              )}
            </>
          }
          title={card.titleVi}
          titleJa={card.titleJa}
          metaInfo={
            <>
              {card.estimatedMinutes && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {detail.duration.replace("{n}", String(card.estimatedMinutes))}
                </span>
              )}
              {expressions.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M4 6h16M4 12h16M4 18h7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {detail.expressionCount.replace("{n}", String(expressions.length))}
                </span>
              )}
            </>
          }
        />

        {/* Disclaimer */}
        {card.module.disclaimerVi && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
            <svg className="h-5 w-5 shrink-0 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm font-medium text-amber-900">{card.module.disclaimerVi}</p>
          </div>
        )}

        {/* Content goal */}
        {contentGoal && (
          <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {detail.objective}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-blue-900 font-medium">{contentGoal}</p>
          </section>
        )}

        {/* Description */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">{detail.content}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{card.descriptionVi}</p>
        </section>

        {/* Usage note (general context) */}
        {usageNote && (
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {detail.usageNote}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-emerald-900">{usageNote}</p>
          </section>
        )}

        {/* Japanese Expressions - the main learning content */}
        {expressions.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{detail.expressions}</h2>
              <span className="text-xs font-medium text-slate-500">{detail.tapToExpand}</span>
            </div>
            <VocabExpressionList
              expressions={expressions}
              gradient={theme.badge}
              labels={expressionLabels}
            />
          </section>
        )}

        {/* Recommendation reason */}
        {card.recommendationReasonVi && (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {detail.whyLearn}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{card.recommendationReasonVi}</p>
          </section>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{detail.skills}</h2>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  className="rounded-full bg-gradient-to-r from-slate-100 to-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
                  key={skill}
                >
                  {skill.replace(/_/gu, " ")}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Footer navigation */}
        <footer className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
            href={`/${locale}`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {detail.backModule}
          </Link>
        </footer>
      </article>
    </main>
  );
}
