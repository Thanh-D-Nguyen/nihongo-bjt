"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { LotoPromoBanner } from "./loto-promo-banner";

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

interface MagazineTranslations {
  title: string;
  subtitle: string;
  filterAll: string;
  filterVocab: string;
  filterWeather: string;
  filterHoroscope: string;
  filterLoto: string;
  filterBjt: string;
  emptyTitle: string;
  emptyDescription: string;
  prevPage: string;
  nextPage: string;
  readMore: string;
  todayTitle: string;
  [key: string]: string;
}

/* ─── Filter bar ─── */

const filterKeys = [
  { key: "all", icon: "📰", labelKey: "filterAll" },
  { key: "vocab", icon: "🌸", labelKey: "filterVocab" },
  { key: "weather", icon: "☀️", labelKey: "filterWeather" },
  { key: "horoscope", icon: "⭐", labelKey: "filterHoroscope" },
  { key: "loto", icon: "🎰", labelKey: "filterLoto" },
  { key: "bjt_phrase", icon: "💼", labelKey: "filterBjt" },
] as const;

function MagazineFilter({ activeKind, t }: { activeKind: string; t: MagazineTranslations }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilter = useCallback(
    (kind: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (kind === "all") {
        params.delete("kind");
      } else {
        params.set("kind", kind);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="-mx-4 mb-6 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
      <div className="flex gap-2 pb-1">
        {filterKeys.map((f) => {
          const isActive = activeKind === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => handleFilter(f.key)}
              className={`flex min-h-[48px] shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-200 motion-reduce:transition-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 sm:min-h-[44px] ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "border border-border/40 bg-card/80 text-muted-foreground backdrop-blur-sm hover:border-primary/30 hover:bg-accent hover:text-foreground"
              }`}
            >
              <span className="text-base">{f.icon}</span>
              <span>{t[f.labelKey]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Bento Card ─── */

const kindIcons: Record<string, string> = {
  magazine_vocab: "🌸",
  magazine_weather: "☀️",
  magazine_horoscope: "⭐",
  magazine_loto: "🎰",
  magazine_loto6: "⑥",
  magazine_loto7: "⑦",
  magazine_bjt_phrase: "💼",
  vocab: "🌸",
  weather: "☀️",
  horoscope: "⭐",
  loto: "🎰",
  bjt_phrase: "💼",
};

const kindGradients: Record<string, string> = {
  magazine_vocab: "from-pink-500/10 to-rose-500/5",
  magazine_weather: "from-amber-500/10 to-orange-500/5",
  magazine_horoscope: "from-violet-500/10 to-purple-500/5",
  magazine_loto: "from-emerald-500/10 to-teal-500/5",
  magazine_loto6: "from-emerald-500/10 to-teal-500/5",
  magazine_loto7: "from-cyan-500/10 to-sky-500/5",
  magazine_bjt_phrase: "from-blue-500/10 to-indigo-500/5",
  vocab: "from-pink-500/10 to-rose-500/5",
  weather: "from-amber-500/10 to-orange-500/5",
  horoscope: "from-violet-500/10 to-purple-500/5",
  loto: "from-emerald-500/10 to-teal-500/5",
  bjt_phrase: "from-blue-500/10 to-indigo-500/5",
};

function BentoCard({
  article,
  locale,
  isHero = false,
  t,
}: {
  article: MagazineArticle;
  locale: string;
  isHero?: boolean;
  t: MagazineTranslations;
}) {
  const icon = kindIcons[article.widgetKind] ?? "📄";
  const gradient = kindGradients[article.widgetKind] ?? "from-primary/10 to-accent/5";
  const isToday = new Date(article.publishDate).toDateString() === new Date().toDateString();

  const formattedDate = new Date(article.publishDate).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Link
      href={`/${locale}/magazine/${article.slug}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card transition-all duration-300 motion-reduce:transition-none hover:-translate-y-1 motion-reduce:hover:translate-y-0 hover:border-border/80 hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
        isHero ? "row-span-2 bg-gradient-to-br from-card to-accent/5 sm:col-span-2" : ""
      }`}
    >
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

      <div className={`relative flex flex-1 flex-col ${isHero ? "p-6 sm:p-8" : "p-5"}`}>
        {/* Top row: icon + badges */}
        <div className="flex items-center justify-between">
          <span className={isHero ? "text-3xl" : "text-2xl"}>{icon}</span>
          <div className="flex items-center gap-2">
            {isToday && (
              <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                {t.todayTitle}
              </span>
            )}
            {article.jlptLevel && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {article.jlptLevel}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3
          className={`mt-3 font-bold leading-[1.8] text-foreground ${
            isHero ? "text-xl sm:text-2xl" : "text-base sm:text-lg"
          }`}
        >
          {article.titleJp}
        </h3>
        <p className={`mt-1 text-muted-foreground ${isHero ? "text-base" : "text-sm"}`}>
          {article.titleVi}
        </p>

        {/* Summary (hero only) */}
        {isHero && article.summaryVi && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground/80">
            {article.summaryVi}
          </p>
        )}

        {/* Vocab tags */}
        {article.vocabWords.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {article.vocabWords.slice(0, isHero ? 5 : 3).map((w) => (
              <span
                key={w.word}
                className="rounded-lg bg-accent/60 px-2.5 py-1 text-xs font-medium text-accent-foreground backdrop-blur-sm"
              >
                {w.word}
                {w.reading && (
                  <span className="ml-1 text-muted-foreground/70">({w.reading})</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Bottom: date + read more */}
        <div className="mt-auto flex items-center justify-between pt-5">
          <time className="text-xs text-muted-foreground/60">{formattedDate}</time>
          <span className="text-xs font-medium text-primary opacity-70 transition-opacity duration-200 group-hover:opacity-100 sm:opacity-0">
            {t.readMore} →
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ─── Empty State ─── */

function MagazineEmptyState({ t }: { t: MagazineTranslations }) {
  return (
    <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/50 bg-accent/5 p-12 text-center sm:mt-16">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-primary/5 text-4xl">
        📖
      </div>
      <h2 className="mt-6 text-xl font-bold text-foreground">
        {t.emptyTitle}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t.emptyDescription}
      </p>
    </div>
  );
}

/* ─── Pagination ─── */

function Pagination({
  locale,
  kind,
  page,
  totalPages,
  t,
}: {
  locale: string;
  kind: string;
  page: number;
  totalPages: number;
  t: MagazineTranslations;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-10 flex items-center justify-center gap-3">
      {page > 1 && (
        <Link
          href={`/${locale}/magazine?kind=${kind}&page=${page - 1}`}
          scroll
          className="flex min-h-[48px] items-center rounded-xl border border-border/50 bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all duration-200 motion-reduce:transition-none hover:border-primary/30 hover:bg-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          {t.prevPage}
        </Link>
      )}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const pageNum = page <= 3 ? i + 1 : page + i - 2;
          if (pageNum < 1 || pageNum > totalPages) return null;
          return (
            <Link
              key={pageNum}
              href={`/${locale}/magazine?kind=${kind}&page=${pageNum}`}
              scroll
              className={`flex size-12 items-center justify-center rounded-xl text-sm font-medium transition-all duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                pageNum === page
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {pageNum}
            </Link>
          );
        })}
      </div>
      {page < totalPages && (
        <Link
          href={`/${locale}/magazine?kind=${kind}&page=${page + 1}`}
          scroll
          className="flex min-h-[48px] items-center rounded-xl border border-border/50 bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all duration-200 motion-reduce:transition-none hover:border-primary/30 hover:bg-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          {t.nextPage}
        </Link>
      )}
    </nav>
  );
}

/* ─── Main Client Component ─── */

export function MagazinePageClient({
  articles,
  locale,
  kind,
  page,
  totalPages,
  t,
}: {
  articles: MagazineArticle[];
  locale: string;
  kind: string;
  page: number;
  totalPages: number;
  t: MagazineTranslations;
}) {
  const todayStr = new Date().toDateString();
  const { todayArticles, olderArticles } = useMemo(() => {
    if (page !== 1) return { todayArticles: [], olderArticles: articles };
    const today: MagazineArticle[] = [];
    const older: MagazineArticle[] = [];
    for (const a of articles) {
      if (new Date(a.publishDate).toDateString() === todayStr) today.push(a);
      else older.push(a);
    }
    return { todayArticles: today, olderArticles: older };
  }, [articles, page, todayStr]);

  return (
    <>
      <MagazineFilter activeKind={kind} t={t} />

      {/* Loto Promo Banner — show on page 1 when not filtered to loto specifically */}
      {page === 1 && kind !== "loto" && (
        <LotoPromoBanner
          locale={locale}
          labels={{
            title: t.lotoPromoTitle ?? "🎰 Loto Lab — Dự đoán & Học tiếng Nhật",
            subtitle: t.lotoPromoSubtitle ?? "Xem dự đoán Loto6/Loto7 hàng tuần kèm từ vựng & câu tiếng Nhật thực tế",
            cta: t.lotoPromoCta ?? "Xem ngay",
          }}
        />
      )}

      {articles.length > 0 ? (
        <>
          {/* Today's articles section */}
          {todayArticles.length > 0 && (
            <section className="mb-8">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-green-500/10 text-sm">✨</span>
                <h2 className="text-base font-bold text-foreground">{t.todayTitle}</h2>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {todayArticles.map((article, idx) => (
                  <BentoCard
                    key={article.id}
                    article={article}
                    locale={locale}
                    isHero={idx === 0}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Older articles */}
          {olderArticles.length > 0 && (
            <section>
              {todayArticles.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-sm">📚</span>
                  <h2 className="text-base font-bold text-muted-foreground">{t.olderTitle ?? "Earlier"}</h2>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {olderArticles.map((article, idx) => (
                  <BentoCard
                    key={article.id}
                    article={article}
                    locale={locale}
                    isHero={idx === 0 && page === 1 && todayArticles.length === 0}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}

          <Pagination locale={locale} kind={kind} page={page} totalPages={totalPages} t={t} />
        </>
      ) : (
        <MagazineEmptyState t={t} />
      )}
    </>
  );
}
