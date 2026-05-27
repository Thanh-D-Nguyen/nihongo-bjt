"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RequireKeycloakAuth } from "../../../../../components/auth/require-keycloak-auth";
import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { LotoGameToggle } from "./loto-game-toggle";
import { LotoHeroPrediction } from "./loto-hero-prediction";
import { LotoHistoryCard } from "./loto-history-card";

type LotoGame = "loto6" | "loto7";

interface LotoLabels {
  title?: string;
  subtitle?: string;
  nextDraw?: string;
  drawNumber?: string;
  countdown?: string;
  history?: string;
  prediction?: string;
  result?: string;
  hitCount?: string;
  pending?: string;
  loadMore?: string;
  jpSentence?: string;
  vocab?: string;
  viewDetail?: string;
  confidence?: string;
  loginRequired?: string;
  set?: string;
  bonus?: string;
  loto6?: string;
  loto7?: string;
  tabLoto6?: string;
  tabLoto7?: string;
  disclaimer?: string;
  premiumCta?: string;
  premiumBenefit?: string;
}

interface FeedItem {
  id: string;
  drawNumber: number | null;
  drawDate: string;
  game: LotoGame;
  sets: Array<{ mainNumbers: number[]; bonusNumbers: number[]; score: number }>;
  result: { mainNumbers: number[]; bonusNumbers: number[] } | null;
  hitCount: number;
  bonusHit: boolean;
  jpSentence: { textJp: string; reading: string; textVi: string; vocabItems: Array<{ wordJp: string; reading: string; meaningVi: string }> } | null;
}

interface NextDrawData {
  id: string;
  drawNumber: number | null;
  drawDate: string;
  game: LotoGame;
  sets: Array<{ mainNumbers: number[]; bonusNumbers: number[]; score: number }>;
  jpSentence: { textJp: string; reading: string; textVi: string; vocabItems: Array<{ wordJp: string; reading: string; meaningVi: string }> } | null;
  vocabItems: Array<{ wordJp: string; reading: string; meaningVi: string }>;
  confidence: number | null;
  daysUntil: number;
}

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

/** Free users see limited history; premium users see all */
const FREE_HISTORY_LIMIT = 3;

export function LotoHubClient({ labels, locale }: { labels: LotoLabels; locale: string }) {
  return (
    <RequireKeycloakAuth locale={locale}>
      <LotoHubInner labels={labels} locale={locale} />
    </RequireKeycloakAuth>
  );
}

function LotoHubInner({ labels, locale }: { labels: LotoLabels; locale: string }) {
  const { accessToken } = useKeycloakAuth();
  const [game, setGame] = useState<LotoGame>("loto6");
  const [nextDraw, setNextDraw] = useState<NextDrawData | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const fetchHeaders = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) h.Authorization = `Bearer ${accessToken}`;
    return h;
  }, [accessToken]);

  // Fetch next draw hero
  useEffect(() => {
    if (!accessToken) return;
    setNextDraw(null);
    fetch(`${API}/api/magazine/loto/next-draw?game=${game}`, { headers: fetchHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setNextDraw(data))
      .catch(() => {});
  }, [game, accessToken, fetchHeaders]);

  // Fetch feed (reset on game change)
  useEffect(() => {
    if (!accessToken) return;
    setFeed([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
    fetch(`${API}/api/magazine/loto/feed?game=${game}&page=1&limit=10`, { headers: fetchHeaders() })
      .then((r) => (r.ok ? r.json() : { data: [], total: 0 }))
      .then((res) => {
        setFeed(res.data ?? []);
        setHasMore((res.data?.length ?? 0) < (res.total ?? 0));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [game, accessToken, fetchHeaders]);

  // Load more
  const loadMore = useCallback(() => {
    if (!hasMore || loading || !accessToken) return;
    const nextPage = page + 1;
    setLoading(true);
    fetch(`${API}/api/magazine/loto/feed?game=${game}&page=${nextPage}&limit=10`, { headers: fetchHeaders() })
      .then((r) => (r.ok ? r.json() : { data: [], total: 0 }))
      .then((res) => {
        setFeed((prev) => [...prev, ...(res.data ?? [])]);
        setPage(nextPage);
        setHasMore(feed.length + (res.data?.length ?? 0) < (res.total ?? 0));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [hasMore, loading, accessToken, page, game, fetchHeaders, feed.length]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl">
              🎰
            </div>
            <h1 className="text-xl font-bold text-ink sm:text-2xl">
              {labels.title ?? "Loto Lab"}
            </h1>
          </div>
        </header>

        {/* Disclaimer */}
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200/80">
            {labels.disclaimer ?? "⚠️ この予測はエンターテインメント目的のみです。宝くじの購入を推奨するものではありません。学習目的でお楽しみください。"}
          </p>
        </div>

        {/* Sticky game toggle */}
        <div className="sticky top-0 z-20 -mx-4 bg-background/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
          <LotoGameToggle
            game={game}
            onChange={setGame}
            labelLoto6={labels.tabLoto6 ?? "Loto6 (6/43)"}
            labelLoto7={labels.tabLoto7 ?? "Loto7 (7/37)"}
          />
        </div>

        {/* Hero prediction */}
        {nextDraw && (
          <section className="mb-8">
            <LotoHeroPrediction data={nextDraw} labels={labels} game={game} />
          </section>
        )}

        {/* History section */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-ink/80">
            {labels.history ?? "Lịch sử dự đoán"}
          </h2>

          {feed.length === 0 && !loading && (
            <div className="rounded-2xl border border-border/40 bg-surface/60 p-8 text-center">
              <p className="text-sm text-muted">Chưa có dữ liệu dự đoán</p>
            </div>
          )}

          <div className="space-y-4">
            {feed.slice(0, FREE_HISTORY_LIMIT).map((item) => (
              <LotoHistoryCard key={item.id} item={item} labels={labels} game={game} />
            ))}
          </div>

          {/* Premium gate — show after FREE_HISTORY_LIMIT items */}
          {feed.length > FREE_HISTORY_LIMIT && (
            <div className="relative mt-6">
              {/* Blurred preview of next items */}
              <div className="space-y-4 blur-[6px] pointer-events-none select-none" aria-hidden>
                {feed.slice(FREE_HISTORY_LIMIT, FREE_HISTORY_LIMIT + 2).map((item) => (
                  <LotoHistoryCard key={item.id} item={item} labels={labels} game={game} />
                ))}
              </div>
              {/* Premium CTA overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/20 bg-background/95 p-6 shadow-xl backdrop-blur-sm">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
                    ✨
                  </div>
                  <p className="text-center text-sm font-medium text-foreground">
                    {labels.premiumCta ?? "Nâng cấp Premium để xem toàn bộ lịch sử"}
                  </p>
                  <p className="max-w-[240px] text-center text-xs text-muted-foreground">
                    {labels.premiumBenefit ?? "Xem lịch sử đầy đủ, phân tích chi tiết & từ vựng exclusive"}
                  </p>
                  <button className="mt-1 flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:brightness-110 active:scale-95">
                    <span>⭐</span> Nâng cấp
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="mt-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface/60" />
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {hasMore && <div ref={observerRef} className="h-10" />}

          {/* Load more button fallback */}
          {hasMore && !loading && (
            <button
              onClick={loadMore}
              className="mx-auto mt-4 flex min-h-12 items-center gap-2 rounded-xl bg-primary/10 px-6 py-3 text-sm font-medium text-primary transition-all duration-150 hover:bg-primary/20 active:scale-95"
            >
              {labels.loadMore ?? "Tải thêm"} ↓
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
