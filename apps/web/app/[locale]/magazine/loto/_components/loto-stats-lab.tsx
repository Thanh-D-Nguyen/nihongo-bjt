"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { LotoBall, LotoBonusBall } from "./loto-balls";
import type { LotoAccuracy, LotoGame, LotoLabels, LotoStats } from "./loto-types";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

const ACCENT_RGB: Record<LotoGame, string> = { loto6: "16,185,129", loto7: "6,182,212" };

type HeatMode = "all" | "recent";

function fill(
  template: string | undefined,
  fallback: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template ?? fallback
  );
}

function formatInt(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function SectionCard({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/30 bg-surface/60 p-4 shadow-sm sm:p-5">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function NumberChips({
  numbers,
  game,
  caption
}: {
  numbers: number[];
  game: LotoGame;
  caption: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{caption}</p>
      <div className="flex flex-wrap gap-1.5">
        {numbers.map((n) => (
          <LotoBall key={n} value={n} game={game} size="sm" state="result" />
        ))}
      </div>
    </div>
  );
}

function AccuracyChart({
  accuracy,
  labels,
  game
}: {
  accuracy: LotoAccuracy;
  labels: LotoLabels;
  game: LotoGame;
}) {
  const buckets = useMemo(() => {
    const total = Math.max(accuracy.samples, 1);
    const observed = accuracy.distribution.map((count) => count / total);
    const expected = accuracy.expectedDistribution;
    let last = 0;
    observed.forEach((value, index) => {
      if (value > 0 || (expected[index] ?? 0) >= 0.005) last = index;
    });
    const upto = Math.max(last, 3);
    return Array.from({ length: Math.min(upto + 1, observed.length) }, (_, hits) => ({
      hits,
      observed: observed[hits] ?? 0,
      expected: expected[hits] ?? 0
    }));
  }, [accuracy]);
  const peak = Math.max(...buckets.flatMap((b) => [b.observed, b.expected]), 0.01);
  const rgb = ACCENT_RGB[game];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-primary/10 p-3">
          <p className="text-[11px] font-medium text-muted">
            {labels.accuracyAvg ?? "Trung bình khớp"}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-primary">
            {accuracy.avgHits.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl bg-border/20 p-3">
          <p className="text-[11px] font-medium text-muted">
            {labels.accuracyBaseline ?? "Kỳ vọng nếu chọn ngẫu nhiên"}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-ink/80">
            {accuracy.baselineHits.toFixed(2)}
          </p>
        </div>
      </div>

      <ul className="space-y-2" aria-label={labels.accuracyTitle}>
        {buckets.map((bucket) => (
          <li key={bucket.hits} className="grid grid-cols-[3.5rem_1fr] items-center gap-3">
            <span className="text-xs font-semibold tabular-nums text-ink/70">
              {fill(labels.hitsLabel, "{n} số", { n: bucket.hits })}
            </span>
            <div className="space-y-1">
              <div className="h-2.5 rounded-full bg-border/15">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max((bucket.observed / peak) * 100, bucket.observed > 0 ? 2 : 0)}%`,
                    backgroundColor: `rgb(${rgb})`
                  }}
                />
              </div>
              <div className="h-2.5 rounded-full bg-border/15">
                <div
                  className="h-full rounded-full bg-muted/50"
                  style={{
                    width: `${Math.max((bucket.expected / peak) * 100, bucket.expected > 0 ? 2 : 0)}%`
                  }}
                />
              </div>
              <p className="text-[10px] tabular-nums text-muted">
                {(bucket.observed * 100).toFixed(1)}% · {(bucket.expected * 100).toFixed(1)}%
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: `rgb(${rgb})` }} />
          {labels.accuracyObserved ?? "Thực tế"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-muted/50" />
          {labels.accuracyExpected ?? "Ngẫu nhiên"}
        </span>
        <span>{fill(labels.accuracySamples, "{n} kỳ đã đối chiếu", { n: accuracy.samples })}</span>
      </div>
      <p className="rounded-xl bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200/80">
        {labels.accuracyNote ??
          "Mẫu nhỏ nên hai nhóm cột lệch nhau do ngẫu nhiên; mọi kỳ quay đều độc lập."}
      </p>
    </div>
  );
}

export function LotoStatsLab({ game, labels }: { game: LotoGame; labels: LotoLabels }) {
  const [stats, setStats] = useState<LotoStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [mode, setMode] = useState<HeatMode>("all");
  const [showAllResults, setShowAllResults] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setStats(null);
    setFailed(false);
    fetch(`${API}/api/magazine/loto/stats?game=${game}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Loto stats request failed: ${response.status}`);
        return response.json() as Promise<LotoStats>;
      })
      .then(setStats)
      .catch((error: unknown) => {
        if (!isAbortError(error)) setFailed(true);
      });
    return () => controller.abort();
  }, [game, retryKey]);

  const retry = useCallback(() => setRetryKey((value) => value + 1), []);

  const heat = useMemo(() => {
    if (!stats) return [];
    const values = stats.frequency.map((cell) => (mode === "all" ? cell.count : cell.recent));
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = Math.max(hi - lo, 1);
    return stats.frequency.map((cell, index) => ({
      cell,
      value: values[index],
      level: (values[index] - lo) / span
    }));
  }, [stats, mode]);

  if (failed) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">
          {labels.statsError ?? "Chưa tải được số liệu thống kê."}
        </p>
        <button
          type="button"
          onClick={retry}
          className="min-h-10 shrink-0 rounded-xl bg-destructive/10 px-4 text-sm font-semibold text-destructive transition hover:bg-destructive/15"
        >
          {labels.retry ?? "Thử lại"}
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <p className="sr-only">{labels.loadingStats ?? "Đang tải số liệu..."}</p>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface/60" />
        ))}
      </div>
    );
  }

  const rgb = ACCENT_RGB[game];
  const { spec } = stats;
  const oddRows = stats.oddDistribution ?? [];
  const oddPeak = Math.max(...oddRows, 1);
  const recentWindow = stats.recentWindow ?? 50;
  const combos = formatInt(spec.totalCombinations);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-ink">
          {labels.statsTitle ?? "Phòng thí nghiệm xác suất"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {labels.statsSubtitle ?? "Số liệu thật từ các kỳ quay chính thức."}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-primary/10 p-3.5">
          <p className="text-[11px] font-medium text-muted">
            {labels.totalDraws ?? "Số kỳ đã quay"}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-primary">
            {formatInt(stats.totalDraws)}
          </p>
        </div>
        <div className="rounded-2xl bg-border/20 p-3.5">
          <p className="text-[11px] font-medium text-muted">{labels.latestDraw ?? "Kỳ gần nhất"}</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-ink/80">
            {stats.latestDraw ?? "—"}
          </p>
        </div>
        <div className="col-span-2 rounded-2xl bg-amber-500/10 p-3.5 sm:col-span-1">
          <p className="text-[11px] font-medium text-muted">
            {fill(labels.jackpotOdds, "1 trên {odds}", { odds: combos })}
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">
            C({spec.maxNumber},{spec.mainCount})
          </p>
        </div>
      </div>

      <SectionCard title={labels.resultsTitle ?? "Kết quả chính thức gần đây"}>
        <ul className="space-y-3">
          {(showAllResults ? stats.recentDraws : stats.recentDraws.slice(0, 5)).map((draw) => (
            <li key={draw.drawNumber} className="rounded-xl bg-white/40 p-3 dark:bg-white/5">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-semibold tabular-nums text-primary">
                  #{draw.drawNumber}
                </span>
                <span className="text-muted">
                  {draw.drawDate}
                  {draw.drawDayJp ? `（${draw.drawDayJp}）` : ""}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {draw.mainNumbers.map((n) => (
                  <LotoBall key={n} value={n} game={game} size="md" />
                ))}
                {draw.bonusNumbers.length > 0 && (
                  <>
                    <span
                      className="mx-0.5 text-xs text-muted"
                      aria-label={labels.bonus ?? "Bonus"}
                    >
                      +
                    </span>
                    {draw.bonusNumbers.map((n) => (
                      <LotoBonusBall key={n} value={n} size="md" />
                    ))}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        {stats.recentDraws.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAllResults((value) => !value)}
            aria-expanded={showAllResults}
            className="mt-3 mr-4 min-h-10 rounded-lg px-2 text-xs font-medium text-primary transition hover:bg-primary/10"
          >
            {showAllResults
              ? `${labels.collapse ?? "Thu gọn"} ↑`
              : `${labels.loadMore ?? "Tải thêm"} ↓`}
          </button>
        )}
        {stats.officialVerificationUrl && (
          <a
            href={stats.officialVerificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-10 items-center text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {labels.verifyOfficial ?? "Đối chiếu kết quả chính thức"} ↗
          </a>
        )}
      </SectionCard>

      <SectionCard title={labels.heatmapTitle ?? "Bản đồ nhiệt tần suất"} hint={labels.heatmapHint}>
        <div role="group" className="mb-3 inline-flex rounded-xl bg-border/15 p-1">
          {(["all", "recent"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${
                mode === option ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {option === "all"
                ? (labels.heatmapAll ?? "Toàn bộ lịch sử")
                : fill(labels.heatmapRecent, "{n} kỳ gần nhất", { n: recentWindow })}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
          {heat.map(({ cell, value, level }) => (
            <div
              key={cell.number}
              data-testid="frequency-cell"
              title={`${cell.number}: ${value}`}
              className="flex aspect-square flex-col items-center justify-center rounded-lg text-ink"
              style={{ backgroundColor: `rgba(${rgb},${(0.08 + level * 0.62).toFixed(2)})` }}
            >
              <span className="text-sm font-bold tabular-nums leading-none">{cell.number}</span>
              <span className="mt-0.5 text-[9px] tabular-nums leading-none text-ink/60">
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <NumberChips
            numbers={stats.hotNumbers}
            game={game}
            caption={labels.hot ?? "Hay xuất hiện"}
          />
          <NumberChips
            numbers={stats.coldNumbers}
            game={game}
            caption={labels.cold ?? "Ít xuất hiện"}
          />
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">
              {labels.overdue ?? "Lâu chưa ra"}
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.overdueNumbers.map((n) => {
                const gap = stats.frequency[n - 1]?.gap ?? 0;
                return (
                  <span
                    key={n}
                    className="inline-flex items-center gap-1.5 rounded-full bg-border/20 py-0.5 pl-0.5 pr-2.5"
                  >
                    <LotoBall value={n} game={game} size="sm" state="result" />
                    <span className="text-[11px] tabular-nums text-muted">
                      {fill(labels.gapDraws, "{n} kỳ", { n: gap })}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {oddRows.length > 0 && (
        <SectionCard title={labels.parityTitle ?? "Cân bằng lẻ / chẵn"} hint={labels.parityHint}>
          <ul className="space-y-2">
            {oddRows.map((count, odd) => (
              <li key={odd} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3 text-xs">
                <span className="text-muted">
                  {fill(labels.parityRow, "{odd} lẻ · {even} chẵn", {
                    odd,
                    even: spec.mainCount - odd
                  })}
                </span>
                <div className="h-2.5 rounded-full bg-border/15">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(count / oddPeak) * 100}%`, backgroundColor: `rgb(${rgb})` }}
                  />
                </div>
                <span className="text-right tabular-nums text-ink/70">
                  {stats.totalDraws > 0 ? ((count / stats.totalDraws) * 100).toFixed(1) : "0.0"}%
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard
        title={labels.accuracyTitle ?? "Đối chiếu với ngẫu nhiên"}
        hint={labels.accuracyIntro}
      >
        {stats.accuracy.samples > 0 ? (
          <AccuracyChart accuracy={stats.accuracy} labels={labels} game={game} />
        ) : (
          <p className="text-sm text-muted">
            {labels.accuracyEmpty ?? "Chưa đủ dữ liệu đối chiếu."}
          </p>
        )}
      </SectionCard>

      <SectionCard title={labels.lessonTitle ?? "Bài học xác suất"}>
        <ul className="space-y-2 text-sm leading-relaxed text-ink/80">
          <li>🎲 {fill(labels.lessonOdds, "1/{combos}", { combos })}</li>
          <li>🔗 {labels.lessonIndependent}</li>
          <li>📉 {labels.lessonRegression}</li>
        </ul>
      </SectionCard>
    </div>
  );
}
