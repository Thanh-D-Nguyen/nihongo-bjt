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
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { adminApiFetch } from "@/lib/admin-api";

const LEVEL_BAR_PALETTE = [
  "#4f46e5",
  "#6366f1",
  "#0d9488",
  "#0f766e",
  "#7c3aed",
  "#a78bfa",
  "#0ea5e9",
  "#0284c7"
];

type CommonLabels = { error: string; loading: string; noChartData: string };

export type ExecutiveAnalyticsPageLabels = {
  chartDau: string;
  chartDauDescription: string;
  chartEmpty: string;
  chartMonetization: string;
  chartMonetizationDescription: string;
  chartQuiz: string;
  chartQuizDescription: string;
  chartRetention: string;
  chartRetentionDescription: string;
  chartSearch: string;
  chartSearchDescription: string;
  chartReview: string;
  chartReviewDescription: string;
  cohortCohort: string;
  cohortSignups: string;
  cohortW1: string;
  compare: string;
  dataHealthTitle: string;
  drillContent: string;
  drillLearning: string;
  drillMonetization: string;
  drillSearch: string;
  drillUsers: string;
  engagementTitle: string;
  error: string;
  filterApply: string;
  filterDays: string;
  filterLocale: string;
  filterPlan: string;
  filterPlanPlaceholder: string;
  filterSegment: string;
  filterSegmentAll: string;
  filterSegmentNew: string;
  filterSegmentReturning: string;
  filtersNote: string;
  freshnessStale: string;
  glossaryClose: string;
  glossaryKpi: string;
  glossaryOpen: string;
  glossaryTitle: string;
  growthTitle: string;
  insightAnomaly: string;
  insightNegative: string;
  insightPositive: string;
  insightRecommended: string;
  insightTitle: string;
  insightsTitle: string;
  kpiUnavailable: string;
  learningOutcomesTitle: string;
  loading: string;
  metricTableDescription: string;
  metricTableTitle: string;
  monetizationGated: string;
  monetizationTitle: string;
  noMetricsRows: string;
  noRollup: string;
  notAvailable: string;
  pipelineStatus: string;
  periodCurrent: string;
  rawMetricsToggle: string;
  searchHealthTitle: string;
  sectionContentHealth: string;
  subtitle: string;
  systemHealthTitle: string;
  tableMetric: string;
  tableValue: string;
  title: string;
  trendDown: string;
  trendUp: string;
  unknownKey: string;
  rollupNote: string;
  kpiId_newUsers: string;
  kpiId_wau: string;
  kpiId_mau: string;
  kpiId_activeToday: string;
  kpiId_d7: string;
  kpiId_flashcardReviews: string;
  kpiId_bjtCompletions: string;
  kpiId_searchSuccessRate: string;
  kpiId_paid: string;
  kpiId_dataFreshness: string;
  kpiId_activeContent: string;
  kpiId_userProfiles: string;
  kpiId_rawEvents: string;
  studyMinutesUnavailable: string;
} & Record<string, string>;

type Kpi = {
  available: boolean;
  deltaRatio: number | null;
  format: "int" | "percent" | "time";
  previous: number | null;
  sparkline?: (number | null)[] | null;
  unavailableCode?: string;
  value: number | null;
};

type AdminAnalyticsResponse = {
  activeContentCount: number;
  executive?: {
    studyMinutes?: { available: boolean; code?: string };
    cohort: {
      available: boolean;
      reason?: string;
      weeks: { label: string; signups: number; w1: number }[];
    };
    compareLabel: { days: number; key: string };
    filters: { applied: { locale: boolean; plan: boolean; segment: boolean } };
    globalRollup?: { searchByDay?: unknown; studyMinutes: { available: boolean; code: string } };
    insights: {
      anomalyKey: string | null;
      biggestNegative: { d: number; k: string } | null;
      biggestPositive: { d: number; k: string } | null;
      recommendedKey: string | null;
      freshnessStale: boolean;
      searchZeroShare: number | null;
    };
    kpi: Record<string, Kpi | Record<string, unknown>>;
    mauDauWau: { byDay: { day: string; dau: number; reviews: number; bjtCompletions: number; searchEventsRollup: number }[]; noteKey: string };
    previousMetricTotals: Record<string, number>;
    previousRange: { start: string; end: string };
    search: { current: { total: number; zero: number }; seriesByDay: { d: string; total: number; zero: number }[] };
    segment: { warningKey: string | null; value: string };
  };
  latestRun: { completedAt: string | null; status: string } | null;
  metricTotals: Record<string, number>;
  metrics: { metricName: string; value: number; metricDate: string }[];
  range: { days: number; end: string; start: string };
  rawEvents: number;
  rollupAlignment?: { respectsFilters: boolean; rawMetricKeysRespectUserFilters: boolean };
  userProfiles: number;
};

function formatKpi(
  k: Kpi,
  t: { na: string; percent: (n: number) => string; int: (n: number) => string; compare: (r: number | null) => string }
) {
  if (!k.available || k.value == null) {
    return { main: t.na, sub: k.unavailableCode ? k.unavailableCode : "" };
  }
  if (k.format === "percent") {
    return { main: t.percent(k.value), sub: t.compare(k.deltaRatio) };
  }
  if (k.format === "int") {
    return { main: t.int(k.value), sub: t.compare(k.deltaRatio) };
  }
  return { main: t.int(k.value), sub: "" };
}

function execSpark(data: (number | null)[] | null | undefined) {
  if (!data?.length) {
    return null;
  }
  const clean = data.map((n) => (n == null ? 0 : n));
  return (
    <div className="mt-2 h-10 w-full min-w-0">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={clean.map((v, i) => ({ i, v }))} margin={{ bottom: 0, left: 0, right: 0, top: 4 }}>
          <Line dataKey="v" dot={false} stroke="#4f46e5" strokeWidth={1.5} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdminAnalyticsClient({
  common,
  labels,
  locale
}: {
  common: CommonLabels;
  labels: ExecutiveAnalyticsPageLabels;
  locale: "ja" | "vi";
}) {
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [filterLocale, setFilterLocale] = useState<"all" | "vi" | "ja">("all");
  const [plan, setPlan] = useState("");
  const [segment, setSegment] = useState<"all" | "new" | "returning">("all");
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  const ns = useMemo(
    () => ({
      int: (n: number) => n.toLocaleString(locale === "ja" ? "ja-JP" : "vi-VN"),
      percent: (n: number) =>
        (n * 100).toLocaleString(locale === "ja" ? "ja-JP" : "vi-VN", { maximumFractionDigits: 1 }) + "%",
      compare: (r: number | null) => {
        if (r == null || Number.isNaN(r)) {
          return "—";
        }
        const pct = (r * 100).toLocaleString(locale === "ja" ? "ja-JP" : "vi-VN", { maximumFractionDigits: 1 });
        if (r > 0) {
          return labels.trendUp.replace("{pct}", `${pct}`);
        }
        if (r < 0) {
          return labels.trendDown.replace("{pct}", `${pct}`);
        }
        return "0%";
      }
    }),
    [labels.trendDown, labels.trendUp, locale]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    params.set("days", String(days));
    params.set("locale", filterLocale);
    if (plan.trim()) {
      params.set("plan", plan.trim());
    }
    params.set("segment", segment);
    try {
      const res = await adminApiFetch(`/api/admin/analytics?${params.toString()}`);
      if (!res.ok) {
        throw new Error("failed");
      }
      setData((await res.json()) as AdminAnalyticsResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [days, filterLocale, plan, segment]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!glossaryOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGlossaryOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [glossaryOpen]);

  const ex = data?.executive;
  const kpi = ex?.kpi as Record<string, Kpi & Record<string, unknown>> | undefined;
  const monet = kpi?.monetization as
    | { visible?: boolean; reason?: string; paidSubscribers?: number; conversionPercent?: number | null; planDistribution?: { count: number; planSlug: string }[] }
    | undefined;

  const comparePeriod = useMemo(() => labels.compare.replace("{days}", String(days)), [days, labels.compare]);

  const dauData = ex?.mauDauWau?.byDay ?? [];
  const searchSeries = ex?.search?.seriesByDay ?? [];
  const cohort = ex?.cohort;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AdminPageHeader description={labels.subtitle} title={labels.title} />
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            onClick={() => setGlossaryOpen(true)}
            type="button"
          >
            {labels.glossaryOpen}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900 shadow-sm" role="alert">
          {labels.error}
        </div>
      ) : null}

      <AdminFilterBar>
        <label className="flex min-w-0 flex-col text-xs text-slate-500">
          <span>{labels.filterDays}</span>
          <select
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            onChange={(e) => setDays(Number(e.target.value))}
            value={days}
          >
            <option value={7}>7</option>
            <option value={14}>14</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={90}>90</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col text-xs text-slate-500">
          <span>{labels.filterLocale}</span>
          <select
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            onChange={(e) => setFilterLocale(e.target.value as "all" | "vi" | "ja")}
            value={filterLocale}
          >
            <option value="all">all</option>
            <option value="vi">vi</option>
            <option value="ja">ja</option>
          </select>
        </label>
        <label className="flex min-w-[8rem] flex-1 flex-col text-xs text-slate-500">
          <span>{labels.filterPlan}</span>
          <input
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            onChange={(e) => setPlan(e.target.value)}
            placeholder={labels.filterPlanPlaceholder}
            type="text"
            value={plan}
          />
        </label>
        <label className="flex min-w-0 flex-col text-xs text-slate-500">
          <span>{labels.filterSegment}</span>
          <select
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            onChange={(e) => setSegment(e.target.value as "all" | "new" | "returning")}
            value={segment}
          >
            <option value="all">{labels.filterSegmentAll}</option>
            <option value="new">{labels.filterSegmentNew}</option>
            <option value="returning">{labels.filterSegmentReturning}</option>
          </select>
        </label>
        <button
          className="self-end rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
          onClick={() => void load()}
          type="button"
        >
          {labels.filterApply}
        </button>
      </AdminFilterBar>

      {ex?.segment?.warningKey ? (
        <p className="text-xs text-amber-800">{labels.filtersNote}</p>
      ) : null}
      {data?.rollupAlignment?.respectsFilters === false && (ex?.filters?.applied?.locale || ex?.filters?.applied?.plan) ? (
        <p className="text-xs text-slate-600">{labels.rollupNote}</p>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">{common.loading}</div>
      ) : null}

      {!loading && data && kpi ? (
        <>
          <p className="text-xs text-slate-500">{comparePeriod}</p>

          <AdminSection title={labels.growthTitle}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {renderKpiCard("newUsers", kpi, ns, labels)}
              {renderKpiCard("wau", kpi, ns, labels)}
              {renderKpiCard("mau", kpi, ns, labels)}
            </div>
          </AdminSection>

          <AdminSection title={labels.engagementTitle}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {renderKpiCard("activeToday", kpi, ns, labels)}
            </div>
          </AdminSection>

          <AdminSection title={labels.learningOutcomesTitle}>
            {ex?.studyMinutes && !ex.studyMinutes.available ? (
              <p className="mb-3 text-sm text-amber-900">{labels.studyMinutesUnavailable}</p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {renderKpiCard("d7", kpi, ns, labels)}
              {renderKpiCard("flashcardReviews", kpi, ns, labels)}
              {renderKpiCard("bjtCompletions", kpi, ns, labels)}
            </div>
          </AdminSection>

          <AdminSection title={labels.searchHealthTitle}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {renderKpiCard("searchSuccessRate", kpi, ns, labels)}
            </div>
          </AdminSection>

          <AdminSection title={labels.monetizationTitle}>
            {monet?.visible ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <AdminKpiCard
                  label={labels.kpiId_paid}
                  trend={
                    typeof monet.conversionPercent === "number" ? (
                      <span className="text-slate-600">{ns.percent(monet.conversionPercent / 100)}</span>
                    ) : undefined
                  }
                  value={ns.int(monet.paidSubscribers ?? 0)}
                />
                <div className="text-sm text-slate-600">{(monet.planDistribution ?? []).map((p) => `${p.planSlug}: ${p.count}`).join(" · ")}</div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">{labels.monetizationGated}</p>
            )}
          </AdminSection>

          <AdminSection title={labels.dataHealthTitle}>
            {renderKpiDataFreshness(kpi, labels, data)}
            {ex?.insights?.freshnessStale ? <p className="mt-2 text-sm text-amber-800">{labels.freshnessStale}</p> : null}
          </AdminSection>

          <AdminSection title={labels.sectionContentHealth}>
            <p className="text-sm text-slate-600">
              {labels.kpiId_activeContent}: {ns.int(data.activeContentCount)} · {labels.kpiId_userProfiles}: {ns.int(data.userProfiles)} ·
              {labels.kpiId_rawEvents}: {ns.int(data.rawEvents)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <a className="text-indigo-700 underline" href={`/${locale}/analytics/learning`}>
                {labels.drillLearning}
              </a>
              <a className="text-indigo-700 underline" href={`/${locale}/analytics/content`}>
                {labels.drillContent}
              </a>
              <a className="text-indigo-700 underline" href={`/${locale}/analytics/search`}>
                {labels.drillSearch}
              </a>
              <a className="text-indigo-700 underline" href={`/${locale}/monetization`}>
                {labels.drillMonetization}
              </a>
              <a className="text-indigo-700 underline" href={`/${locale}/users`}>
                {labels.drillUsers}
              </a>
            </div>
          </AdminSection>

          <AdminSection title={labels.systemHealthTitle}>
            <p className="text-sm text-slate-700">
              {data.latestRun?.status
                ? labels.pipelineStatus.replace("{status}", data.latestRun.status)
                : labels.notAvailable}
            </p>
          </AdminSection>

          <AdminSection title={labels.insightsTitle}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">{labels.insightPositive}</p>
                <p className="mt-2">
                  {ex?.insights?.biggestPositive
                    ? `${ex.insights.biggestPositive.k}: ${(ex.insights.biggestPositive.d * 100).toFixed(1)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">{labels.insightNegative}</p>
                <p className="mt-2">
                  {ex?.insights?.biggestNegative
                    ? `${ex.insights.biggestNegative.k}: ${(ex.insights.biggestNegative.d * 100).toFixed(1)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">{labels.insightAnomaly}</p>
                <p className="mt-2">{ex?.insights?.anomalyKey ?? "—"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">{labels.insightRecommended}</p>
                <p className="mt-2">{ex?.insights?.recommendedKey ?? "—"}</p>
              </div>
            </div>
          </AdminSection>

          {dauData.length > 0 ? (
            <AdminChartCard description={labels.chartDauDescription} title={labels.chartDau}>
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={dauData} margin={{ bottom: 8, left: 4, right: 8, top: 8 }}>
                    <XAxis dataKey="day" fontSize={10} tickLine={false} />
                    <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
                    <Tooltip />
                    <Legend />
                    <Line dataKey="dau" name="DAU (rollup)" stroke="#4f46e5" strokeWidth={2} type="monotone" />
                    <Line dataKey="reviews" name={labels.chartReview} stroke="#0d9488" type="monotone" />
                    <Line dataKey="bjtCompletions" name={labels.chartQuiz} stroke="#a78bfa" type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AdminChartCard>
          ) : (
            <AdminEmptyState title={labels.chartEmpty} />
          )}

          <AdminChartCard description={labels.chartSearchDescription} title={labels.chartSearch}>
            {searchSeries.length > 0 ? (
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={searchSeries.map((s) => ({ day: s.d, rate: s.total > 0 ? 1 - s.zero / s.total : 0 }))} margin={{ bottom: 8, left: 4, right: 8, top: 8 }}>
                    <XAxis dataKey="day" fontSize={10} />
                    <YAxis allowDecimals fontSize={10} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                    <Tooltip
                      formatter={(v) =>
                        v === undefined || v === null
                          ? ["—", labels.chartSearch]
                          : [String((Number(v) * 100).toFixed(1)) + "%", labels.chartSearch]
                      }
                    />
                    <Line dataKey="rate" dot={false} name={labels.chartSearch} stroke="#0ea5e9" strokeWidth={2} type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <AdminEmptyState title={common.noChartData} />
            )}
          </AdminChartCard>

          {cohort?.available && cohort.weeks.length > 0 ? (
            <AdminChartCard description={labels.chartRetentionDescription} title={labels.chartRetention}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="py-2 pr-2">{labels.cohortCohort}</th>
                      <th className="py-2 pr-2">{labels.cohortSignups}</th>
                      <th className="py-2">{labels.cohortW1}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohort.weeks.map((w) => (
                      <tr className="border-b border-slate-100" key={w.label}>
                        <td className="py-2 pr-2 font-mono text-xs text-slate-800">{w.label}</td>
                        <td className="py-2 pr-2 tabular-nums">{ns.int(w.signups)}</td>
                        <td className="py-2 tabular-nums">{ns.percent(w.w1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminChartCard>
          ) : null}

          {monet?.visible && (monet.planDistribution?.length ?? 0) > 0 ? (
            <AdminChartCard description={labels.chartMonetizationDescription} title={labels.chartMonetization}>
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={monet!.planDistribution!.map((p) => ({ name: p.planSlug, value: p.count }))} layout="vertical" margin={{ left: 8, right: 8 }} barSize={18}>
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" name={labels.chartMonetization}>
                      {monet!.planDistribution!.map((row, i) => (
                        <Cell fill={LEVEL_BAR_PALETTE[i % LEVEL_BAR_PALETTE.length]} key={row.planSlug} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AdminChartCard>
          ) : null}

          <details className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4" onToggle={(e) => setRawOpen((e.target as HTMLDetailsElement).open)} open={rawOpen}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">{labels.rawMetricsToggle}</summary>
            <div className="mt-4 space-y-4">
              {Object.keys(data.metricTotals).length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <AdminDataTable>
                    <AdminDataTableHead>
                      <AdminDataTableRow>
                        <AdminDataTableTh>{labels.tableMetric}</AdminDataTableTh>
                        <AdminDataTableTh>{labels.tableValue}</AdminDataTableTh>
                      </AdminDataTableRow>
                    </AdminDataTableHead>
                    <AdminDataTableBody>
                      {Object.entries(data.metricTotals)
                        .sort((a, b) => b[1] - a[1])
                        .map(([name, value]) => (
                          <AdminDataTableRow key={name}>
                            <AdminDataTableTd>
                              <code className="text-sm text-ink">{name}</code>
                            </AdminDataTableTd>
                            <AdminDataTableTd>
                              <span className="font-medium text-ink tabular-nums">
                                {typeof value === "number" ? value.toLocaleString() : String(value)}
                              </span>
                            </AdminDataTableTd>
                          </AdminDataTableRow>
                        ))}
                    </AdminDataTableBody>
                  </AdminDataTable>
                </div>
              ) : (
                <p className="text-sm text-slate-600">{labels.noMetricsRows}</p>
              )}
            </div>
          </details>
        </>
      ) : null}

      {glossaryOpen ? (
        <div
          aria-labelledby="glossary-kpi-title"
          aria-modal="true"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
        >
          <button
            aria-label={labels.glossaryClose}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
            onClick={() => setGlossaryOpen(false)}
            type="button"
          />
          <div
            className="relative z-[1] max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-h-[80vh] overflow-y-auto p-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-base font-semibold text-slate-900" id="glossary-kpi-title">
                  {labels.glossaryTitle}
                </h2>
                <button
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                  onClick={() => setGlossaryOpen(false)}
                  type="button"
                >
                  {labels.glossaryClose}
                </button>
              </div>
              <ul className="mt-4 list-disc space-y-2 pl-4 text-sm text-slate-700">
                {["kpiDau", "kpiWau", "kpiMau", "kpiD7", "kpiNew", "kpiSearch", "kpiBjt", "kpiReviews", "kpiMonet", "kpiFresh"].map(
                  (k) => (
                    <li key={k}>
                      <span className="font-medium">{k}</span> — {labels[k] ?? k}
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function renderKpiDataFreshness(
  kpi: Record<string, Kpi & Record<string, unknown>> | undefined,
  labels: ExecutiveAnalyticsPageLabels,
  data: AdminAnalyticsResponse
) {
  const d = kpi?.dataFreshness;
  if (!d) {
    return <p className="text-sm text-slate-600">{labels.notAvailable}</p>;
  }
  const completed = (d as { completedAt?: string | null }).completedAt;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <AdminKpiCard
        label={labels.kpiId_dataFreshness}
        trend={data.latestRun ? <AdminStatusBadge tone="neutral">{String(data.latestRun.status)}</AdminStatusBadge> : undefined}
        value={completed ? new Date(completed).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : labels.noRollup}
      />
    </div>
  );
}

function renderKpiCard(
  id: string,
  kpi: Record<string, Kpi & Record<string, unknown>> | undefined,
  ns: { int: (n: number) => string; percent: (n: number) => string; compare: (r: number | null) => string },
  labels: ExecutiveAnalyticsPageLabels
) {
  const row = kpi?.[id] as Kpi | undefined;
  if (!row) {
    return null;
  }
  const label = (labels as Record<string, string>)[`kpiId_${id}`] ?? labels.unknownKey;
  const f = formatKpi(row, { ...ns, na: labels.kpiUnavailable });
  const deltaTone = row.deltaRatio == null || !row.available ? "neutral" : row.deltaRatio >= 0 ? "up" : "down";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{f.main}</p>
      {row.available ? (
        <div className="mt-2 text-xs text-slate-600">
          <AdminMetricTrend tone={deltaTone}>{f.sub}</AdminMetricTrend>
        </div>
      ) : null}
      {row.sparkline?.length ? execSpark(row.sparkline) : null}
    </div>
  );
}
