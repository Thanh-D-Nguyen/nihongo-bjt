"use client";

import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  cn
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type Labels = Record<string, string>;
type CommonLabels = { empty: string; error: string; loading: string; records: string };

type LeaderboardRow = {
  rank: number;
  userId: string;
  wins: number;
  losses: number;
  totalMatches: number;
  winRate: number;
  avgScore: number;
};

type ListResponse = {
  items: LeaderboardRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    completedMatches: number;
    since: string | null;
    totalParticipants: number;
    window: "all" | "30d" | "90d";
  };
};

type Window = "all" | "30d" | "90d";
const PAGE_SIZE = 25;

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BattleLeaderboardClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
  locale: string;
}) {
  const t = useCallback((k: string) => labels[k] ?? k, [labels]);

  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [windowFilter, setWindowFilter] = useState<Window>("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("window", windowFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/battle/leaderboard?${params.toString()}`);
      if (!r.ok) {
        setData(null);
        setError(t("errorLoad"));
        return;
      }
      setData((await r.json()) as ListResponse);
    } catch {
      setData(null);
      setError(t("errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [windowFilter, page, t]);

  useEffect(() => {
    setPage(1);
  }, [windowFilter]);
  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(
      `battle-leaderboard-${windowFilter}-page-${data.page}.csv`,
      [t("colRank"), t("colUser"), t("colWins"), t("colLosses"), t("colTotal"), t("colWinRate"), t("colAvgScore")],
      data.items.map((row) => [
        String(row.rank),
        row.userId,
        String(row.wins),
        String(row.losses),
        String(row.totalMatches),
        String(row.winRate),
        String(row.avgScore)
      ])
    );
  };

  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />

      <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
        {t("seasonsPendingNotice")}
      </div>

      <AdminSection
        description={`${t("summaryParticipants")}: ${data?.summary.totalParticipants ?? 0} · ${t("summaryMatches")}: ${data?.summary.completedMatches ?? 0}`}
        title={t("title")}
      >
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-slate-600">{t("filterWindow")}:</span>
            {(["all", "30d", "90d"] as const).map((w) => (
              <button
                key={w}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium",
                  windowFilter === w
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
                onClick={() => setWindowFilter(w)}
                type="button"
              >
                {t(`window_${w}`)}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-end gap-2">
            <button
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => void load()}
              type="button"
            >
              {t("actionRefresh")}
            </button>
            <button
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={exportCsv}
              type="button"
            >
              {t("actionExportCsv")}
            </button>
          </div>
        </div>

        {loading && !data ? (
          <p className="text-sm text-slate-600">{common.loading}</p>
        ) : error ? (
          <AdminEmptyState title={common.error}>{error}</AdminEmptyState>
        ) : items.length === 0 ? (
          <AdminEmptyState title={t("empty")}>{t("emptyHint")}</AdminEmptyState>
        ) : (
          <>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{t("colRank")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colUser")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colWins")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colLosses")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colTotal")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colWinRate")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colAvgScore")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {items.map((row) => (
                  <AdminDataTableRow key={row.userId}>
                    <AdminDataTableTd>
                      <span className="font-semibold text-slate-700">#{row.rank}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-mono text-[10px] text-slate-500">{row.userId.slice(0, 12)}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{row.wins}</AdminDataTableTd>
                    <AdminDataTableTd>{row.losses}</AdminDataTableTd>
                    <AdminDataTableTd>{row.totalMatches}</AdminDataTableTd>
                    <AdminDataTableTd>{row.winRate}%</AdminDataTableTd>
                    <AdminDataTableTd>{row.avgScore}</AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span>
                {t("pageLabel")}: {data?.page ?? page} / {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  {t("prevPage")}
                </button>
                <button
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  type="button"
                >
                  {t("nextPage")}
                </button>
              </div>
            </div>
          </>
        )}
      </AdminSection>
    </div>
  );
}
