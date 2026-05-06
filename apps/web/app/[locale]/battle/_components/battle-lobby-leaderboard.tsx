"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { learnerApiFetch } from "../../../../lib/learner-api";
import type { BattlePageLabels } from "./battle-types";

export type BattleLeaderboardWindow = "30d" | "90d" | "all";

type LeaderboardRow = {
  avgScore: number;
  displayName: string;
  isYou: boolean;
  losses: number;
  rank: number;
  totalMatches: number;
  winRate: number;
  wins: number;
};

type LeaderboardPayload = {
  items: LeaderboardRow[];
  page: number;
  pageSize: number;
  summary: {
    completedMatches: number;
    since: string | null;
    totalParticipants: number;
    window: string;
  };
  total: number;
  viewerRank: {
    avgScore: number;
    displayName: string;
    losses: number;
    rank: number;
    totalMatches: number;
    winRate: number;
    wins: number;
  } | null;
};

function clipDisplay(name: string, max = 22): string {
  const t = name.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function BattleLobbyLeaderboardPanel({
  labels,
  className = "",
  hideIntro = false
}: {
  className?: string;
  hideIntro?: boolean;
  labels: BattlePageLabels;
}) {
  const [windowKey, setWindowKey] = useState<BattleLeaderboardWindow>("30d");
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (w: BattleLeaderboardWindow) => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ window: w, page: "1", pageSize: "15" });
      const r = await learnerApiFetch(`/api/battle/leaderboard?${params.toString()}`);
      if (!r.ok) throw new Error("leaderboard_failed");
      setData((await r.json()) as LeaderboardPayload);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(windowKey);
  }, [windowKey, load]);

  const windowOptions: Array<{ key: BattleLeaderboardWindow; label: string }> = [
    { key: "30d", label: labels.leaderboardWindow30d },
    { key: "90d", label: labels.leaderboardWindow90d },
    { key: "all", label: labels.leaderboardWindowAll }
  ];

  return (
    <section
      className={cn(
        "rounded-[1.5rem] border border-amber-200/40 bg-gradient-to-br from-amber-50/35 via-surface to-indigo-50/30 p-5 shadow-sm",
        hideIntro ? "mt-0" : "mt-4",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {hideIntro ? null : (
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">{labels.leaderboardHeading}</h2>
            <p className="mt-1 text-sm font-medium text-muted">{labels.leaderboardSubtitle}</p>
          </div>
        )}
        <div
          className={`flex flex-wrap gap-1 rounded-xl border border-ink/10 bg-paper/90 p-1 ${hideIntro ? "w-full justify-between sm:justify-end" : ""}`}
          role="group"
          aria-label={labels.leaderboardHeading}
        >
          {windowOptions.map((opt) => (
            <button
              className={`min-h-9 rounded-lg px-3 text-xs font-black transition ${
                opt.key === windowKey
                  ? "bg-ink text-surface shadow-sm"
                  : "text-ink hover:bg-white"
              }`}
              key={opt.key}
              onClick={() => setWindowKey(opt.key)}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm font-semibold text-amber-900">{labels.leaderboardLoadError}</p>
      ) : null}

      {!error && data?.viewerRank ? (
        <p className="mt-4 rounded-xl border border-leaf/25 bg-leaf/10 px-4 py-2 text-sm font-bold text-leaf">
          {labels.leaderboardYourRank
            .replace("{rank}", String(data.viewerRank.rank))
            .replace("{total}", String(data.total))}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div className="h-10 animate-pulse rounded-lg bg-ink/5" key={i} />
          ))}
        </div>
      ) : null}

      {!loading && data && data.items.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-muted">{labels.leaderboardEmpty}</p>
      ) : null}

      {!loading && data && data.items.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-ink/10 bg-white/85">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-paper/90 text-[11px] font-black uppercase tracking-wide text-muted">
                <th className="px-3 py-2">{labels.leaderboardRank}</th>
                <th className="px-3 py-2">{labels.leaderboardPlayer}</th>
                <th className="px-3 py-2 tabular-nums">{labels.leaderboardWinsShort}</th>
                <th className="px-3 py-2 tabular-nums">{labels.leaderboardLossesShort}</th>
                <th className="px-3 py-2 tabular-nums">{labels.leaderboardMatchesShort}</th>
                <th className="px-3 py-2 tabular-nums">{labels.leaderboardWinRate}</th>
                <th className="px-3 py-2 tabular-nums">{labels.leaderboardAvgScore}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const top = row.rank <= 3;
                return (
                  <tr
                    className={`border-b border-ink/5 last:border-0 ${
                      row.isYou
                        ? "bg-leaf/12 ring-1 ring-inset ring-leaf/25"
                        : top
                          ? "bg-amber-50/50"
                          : ""
                    }`}
                    key={`${row.rank}-${row.displayName}`}
                  >
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex min-w-[2rem] justify-center rounded-full px-2 py-0.5 text-xs font-black tabular-nums ${
                          row.rank === 1
                            ? "bg-amber-100 text-amber-900"
                            : row.rank === 2
                              ? "bg-paper text-ink"
                              : row.rank === 3
                                ? "bg-orange-50 text-orange-900"
                                : "text-muted"
                        }`}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2.5 font-bold text-ink">
                      <span className="truncate">{clipDisplay(row.displayName)}</span>
                      {row.isYou ? (
                        <span className="ml-2 rounded-md bg-ink/10 px-1.5 py-0.5 text-[10px] font-black uppercase text-ink">
                          {labels.leaderboardYou}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 font-bold tabular-nums text-leaf">{row.wins}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink">{row.losses}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted">{row.totalMatches}</td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-ink">{row.winRate}%</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted">{row.avgScore}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
