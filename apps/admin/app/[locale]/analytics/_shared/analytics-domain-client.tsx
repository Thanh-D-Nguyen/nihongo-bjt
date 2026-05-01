"use client";

import {
  AdminChartCard,
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiCard,
  AdminMetricTrend,
  AdminPageHeader,
  AdminSection,
  AdminSelect,
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { adminApiFetch } from "@/lib/admin-api";

export type AnalyticsDomainLabels = {
  title: string;
  description: string;
  filterRange: string;
  filterRange7d: string;
  filterRange30d: string;
  filterRange90d: string;
  filterRangeCustom: string;
  filterFrom: string;
  filterTo: string;
  filterMetric: string;
  filterDimension: string;
  filterApply: string;
  refresh: string;
  refreshHelp: string;
  refreshSuccess: string;
  refreshFailed: string;
  refreshThrottled: string;
  export: string;
  exportPrompt: string;
  exportSuccess: string;
  exportFailed: string;
  reasonRequired: string;
  loading: string;
  error: string;
  empty: string;
  noChart: string;
  freshnessLabel: string;
  freshnessNever: string;
  partialNotice: string;
  kpiUnavailable: string;
  trendUp: string;
  trendDown: string;
  vs: string;
  charTitle: string;
  chartDescription: string;
  breakdownTitle: string;
  breakdownDescription: string;
  paginationPrev: string;
  paginationNext: string;
  paginationOf: string;
  metricLabels: Record<string, string>;
  dimensionLabels: Record<string, string>;
  kpiLabels: Record<string, string>;
};

type Kpi = {
  id: string;
  value: number | null;
  previous: number | null;
  deltaRatio: number | null;
  format: "int" | "percent" | "ms";
  available: boolean;
  unavailableCode?: string | null;
};

type Summary = {
  range: { days?: number; from: string; to: string };
  kpis: Kpi[];
  freshness?: { lastRollupAt: string | null; lagMs?: number | null };
  notices?: string[];
  filtersApplied?: Record<string, boolean>;
};

type Timeseries = {
  metric: string;
  granularity: "day" | "week" | "month";
  series: { t: string; value: number | null }[];
};

type BreakdownRow = {
  key: string;
  label?: string | null;
  value: number;
  rate?: number | null;
  meta?: Record<string, unknown>;
};

type Breakdown = {
  dimension: string;
  rows: BreakdownRow[];
  total: number;
  page?: number;
  pageSize?: number;
};

type Range = "7d" | "30d" | "90d" | "custom";

function fmtInt(n: number | null) {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
function fmtPct(n: number | null) {
  if (n == null || !isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
function fmtMs(n: number | null) {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 60_000) return `${(n / 60_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}s`;
  return `${Math.round(n)}ms`;
}
function fmtKpi(k: Kpi) {
  if (!k.available) return null;
  if (k.format === "percent") return fmtPct(k.value);
  if (k.format === "ms") return fmtMs(k.value);
  return fmtInt(k.value);
}
function deltaTone(d: number | null): "neutral" | "up" | "down" {
  if (d == null) return "neutral";
  if (d > 0.001) return "up";
  if (d < -0.001) return "down";
  return "neutral";
}

export function AnalyticsDomainClient(props: {
  domain: "battle" | "bjt" | "content" | "flashcards" | "growth" | "learning" | "search" | "system";
  defaultMetric: string;
  metricOptions: { value: string; label: string }[];
  dimensionOptions: { value: string; label: string }[];
  defaultDimension: string;
  labels: AnalyticsDomainLabels;
}) {
  const { domain, defaultMetric, metricOptions, dimensionOptions, defaultDimension, labels } = props;
  const base = `/api/admin/analytics/${domain}`;

  const [range, setRange] = useState<Range>("30d");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [metric, setMetric] = useState<string>(defaultMetric);
  const [dimension, setDimension] = useState<string>(defaultDimension);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<Timeseries | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"refresh" | "export" | null>(null);
  const [toast, setToast] = useState<{ tone: "good" | "warning" | "danger"; message: string } | null>(null);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("range", range);
    if (range === "custom" && from) sp.set("from", from);
    if (range === "custom" && to) sp.set("to", to);
    return sp.toString();
  }, [range, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t, b] = await Promise.all([
        adminApiFetch(`${base}/summary?${queryString}`),
        adminApiFetch(`${base}/timeseries?${queryString}&metric=${encodeURIComponent(metric)}`),
        adminApiFetch(`${base}/breakdown?${queryString}&dimension=${encodeURIComponent(dimension)}&pageSize=25`)
      ]);
      if (!s.ok) throw new Error(`summary ${s.status}`);
      if (!t.ok) throw new Error(`timeseries ${t.status}`);
      if (!b.ok) throw new Error(`breakdown ${b.status}`);
      setSummary((await s.json()) as Summary);
      setSeries((await t.json()) as Timeseries);
      setBreakdown((await b.json()) as Breakdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [base, queryString, metric, dimension]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    const reason = window.prompt(labels.refreshHelp, "manual refresh");
    if (!reason || reason.trim().length < 3) {
      setToast({ tone: "warning", message: labels.reasonRequired });
      return;
    }
    setBusy("refresh");
    try {
      const r = await adminApiFetch(`${base}/refresh`, {
        body: JSON.stringify({ reason: reason.trim() }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (r.status === 503) {
        setToast({ tone: "warning", message: labels.refreshThrottled });
      } else if (!r.ok) {
        setToast({ tone: "danger", message: labels.refreshFailed });
      } else {
        setToast({ tone: "good", message: labels.refreshSuccess });
        void load();
      }
    } catch {
      setToast({ tone: "danger", message: labels.refreshFailed });
    } finally {
      setBusy(null);
    }
  }, [base, labels, load]);

  const onExport = useCallback(
    async (view: "summary" | "timeseries" | "breakdown") => {
      const reason = window.prompt(labels.exportPrompt, `${domain}-${view}`);
      if (!reason || reason.trim().length < 3) {
        setToast({ tone: "warning", message: labels.reasonRequired });
        return;
      }
      setBusy("export");
      try {
        const body: Record<string, unknown> = {
          range,
          reason: reason.trim(),
          view
        };
        if (range === "custom" && from) body.from = from;
        if (range === "custom" && to) body.to = to;
        if (view === "timeseries") body.metric = metric;
        if (view === "breakdown") body.dimension = dimension;
        const r = await adminApiFetch(`${base}/export`, {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        if (!r.ok) {
          setToast({ tone: "danger", message: labels.exportFailed });
          return;
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics-${domain}-${view}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setToast({ tone: "good", message: labels.exportSuccess });
      } catch {
        setToast({ tone: "danger", message: labels.exportFailed });
      } finally {
        setBusy(null);
      }
    },
    [base, dimension, domain, from, labels, metric, range, to]
  );

  const freshness =
    summary?.freshness?.lastRollupAt ?
      new Date(summary.freshness.lastRollupAt).toLocaleString()
    : labels.freshnessNever;

  return (
    <div className="space-y-6 p-6">
      <AdminPageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={busy === "refresh" || loading}
              onClick={() => void onRefresh()}
              type="button"
            >
              {busy === "refresh" ? labels.loading : labels.refresh}
            </button>
            <button
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={busy === "export" || loading}
              onClick={() => void onExport("breakdown")}
              type="button"
            >
              {labels.export}
            </button>
          </div>
        }
        description={labels.description}
        title={labels.title}
      />

      <AdminFilterBar>
        <label className="flex flex-col text-xs font-medium text-slate-700">
          {labels.filterRange}
          <AdminSelect onChange={(e) => setRange(e.target.value as Range)} value={range}>
            <option value="7d">{labels.filterRange7d}</option>
            <option value="30d">{labels.filterRange30d}</option>
            <option value="90d">{labels.filterRange90d}</option>
            <option value="custom">{labels.filterRangeCustom}</option>
          </AdminSelect>
        </label>
        {range === "custom" && (
          <>
            <label className="flex flex-col text-xs font-medium text-slate-700">
              {labels.filterFrom}
              <input
                className="min-h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-accent focus:ring-2 focus:ring-accent/15"
                onChange={(e) => setFrom(e.target.value)}
                type="date"
                value={from}
              />
            </label>
            <label className="flex flex-col text-xs font-medium text-slate-700">
              {labels.filterTo}
              <input
                className="min-h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-accent focus:ring-2 focus:ring-accent/15"
                onChange={(e) => setTo(e.target.value)}
                type="date"
                value={to}
              />
            </label>
          </>
        )}
        <label className="flex flex-col text-xs font-medium text-slate-700">
          {labels.filterMetric}
          <AdminSelect onChange={(e) => setMetric(e.target.value)} value={metric}>
            {metricOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </AdminSelect>
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-700">
          {labels.filterDimension}
          <AdminSelect onChange={(e) => setDimension(e.target.value)} value={dimension}>
            {dimensionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </AdminSelect>
        </label>
        <div className="ml-auto flex flex-col text-xs text-slate-600 md:items-end">
          <span>
            {labels.freshnessLabel}: {freshness}
          </span>
          {summary?.notices?.length ?
            <AdminStatusBadge tone="warning">{labels.partialNotice}</AdminStatusBadge>
          : null}
        </div>
      </AdminFilterBar>

      {toast ? (
        <div
          className={
            toast.tone === "good" ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            : toast.tone === "warning" ? "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          }
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {labels.error}: {error}
        </div>
      ) : null}

      <AdminSection title={labels.title}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(summary?.kpis ?? []).map((k) => {
            const value = fmtKpi(k);
            const tone =
              !k.available ? "warning"
              : k.format === "percent" && (k.value ?? 0) >= 0.8 ? "good"
              : "neutral";
            return (
              <AdminKpiCard
                key={k.id}
                label={labels.kpiLabels[k.id] ?? k.id}
                tone={tone}
                trend={
                  k.available && k.deltaRatio != null ?
                    <AdminMetricTrend tone={deltaTone(k.deltaRatio)}>
                      {k.deltaRatio > 0 ? "▲" : k.deltaRatio < 0 ? "▼" : "·"} {fmtPct(Math.abs(k.deltaRatio))}{" "}
                      <span className="ml-1 text-slate-500">{labels.vs}</span>
                    </AdminMetricTrend>
                  : k.available ? <span>—</span>
                  : <AdminStatusBadge tone="warning">{k.unavailableCode ?? labels.kpiUnavailable}</AdminStatusBadge>
                }
                value={value ?? labels.kpiUnavailable}
              />
            );
          })}
          {loading && !summary ?
            Array.from({ length: 4 }).map((_, i) => (
              <AdminKpiCard key={`skeleton-${i}`} label={labels.loading} tone="neutral" value={"…"} />
            ))
          : null}
        </div>
      </AdminSection>

      <AdminSection>
        <AdminChartCard description={labels.chartDescription} title={labels.charTitle}>
          {series && series.series.length > 0 ?
            <div className="h-72">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={series.series.map((p) => ({ t: p.t, v: p.value ?? 0 }))} margin={{ bottom: 8, left: 8, right: 16, top: 8 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="t" stroke="#475569" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line dataKey="v" dot={false} name={labels.metricLabels[metric] ?? metric} stroke="#4f46e5" strokeWidth={2} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          : <AdminEmptyState title={labels.noChart} />}
        </AdminChartCard>
      </AdminSection>

      <AdminSection
        actions={
          <div className="flex gap-2">
            <button
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => void onExport("timeseries")}
              type="button"
            >
              {labels.export}
            </button>
          </div>
        }
        description={labels.breakdownDescription}
        title={labels.breakdownTitle}
      >
        {breakdown && breakdown.rows.length > 0 ?
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{labels.filterDimension}</AdminDataTableTh>
                  <AdminDataTableTh>{labels.filterMetric}</AdminDataTableTh>
                  <AdminDataTableTh>%</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {breakdown.rows.map((row) => (
                  <AdminDataTableRow key={row.key}>
                    <AdminDataTableTd>
                      <span className="font-medium text-slate-900">{row.label ?? row.key}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{fmtInt(row.value)}</AdminDataTableTd>
                    <AdminDataTableTd>{row.rate != null ? fmtPct(row.rate) : "—"}</AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
          </div>
        : <AdminEmptyState title={labels.empty} />}
      </AdminSection>

      {breakdown && breakdown.rows.length > 0 ?
        <AdminSection>
          <AdminChartCard description={labels.breakdownDescription} title={labels.breakdownTitle}>
            <div className="h-64">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={breakdown.rows.map((r) => ({ name: r.label ?? r.key, v: r.value }))} margin={{ bottom: 24, left: 8, right: 16, top: 8 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} stroke="#475569" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="v" fill="#0d9488" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AdminChartCard>
        </AdminSection>
      : null}
    </div>
  );
}
