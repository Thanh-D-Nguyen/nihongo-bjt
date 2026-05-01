import vi from "../../../../messages/vi.json";
import type { AnalyticsDomainLabels } from "./analytics-domain-client";

type DomainKey =
  | "analyticsBattle"
  | "analyticsBjt"
  | "analyticsContent"
  | "analyticsFlashcards"
  | "analyticsGrowth"
  | "analyticsLearning"
  | "analyticsSearch"
  | "analyticsSystem";

// vi.json is the canonical superset for type checking; ja/en are narrowed at runtime.
type AnalyticsCommonShape = (typeof vi)["adminConsole"]["analyticsCommon"];
type AnalyticsDomainShape = (typeof vi)["adminConsole"]["analyticsBattle"];
type LooseMessages = {
  adminConsole: { analyticsCommon: AnalyticsCommonShape } & Record<DomainKey, AnalyticsDomainShape>;
};

export function buildAnalyticsDomainLabels(t: unknown, domainKey: DomainKey): AnalyticsDomainLabels {
  const m = t as LooseMessages;
  const c = m.adminConsole.analyticsCommon;
  const d = m.adminConsole[domainKey];
  return {
    title: d.title,
    description: d.description,
    filterRange: c.filterRange,
    filterRange7d: c.filterRange7d,
    filterRange30d: c.filterRange30d,
    filterRange90d: c.filterRange90d,
    filterRangeCustom: c.filterRangeCustom,
    filterFrom: c.filterFrom,
    filterTo: c.filterTo,
    filterMetric: c.filterMetric,
    filterDimension: c.filterDimension,
    filterApply: c.filterApply,
    refresh: c.refresh,
    refreshHelp: c.refreshHelp,
    refreshSuccess: c.refreshSuccess,
    refreshFailed: c.refreshFailed,
    refreshThrottled: c.refreshThrottled,
    export: c.export,
    exportPrompt: c.exportPrompt,
    exportSuccess: c.exportSuccess,
    exportFailed: c.exportFailed,
    reasonRequired: c.reasonRequired,
    loading: c.loading,
    error: c.error,
    empty: c.empty,
    noChart: c.noChart,
    freshnessLabel: c.freshnessLabel,
    freshnessNever: c.freshnessNever,
    partialNotice: c.partialNotice,
    kpiUnavailable: c.kpiUnavailable,
    trendUp: c.trendUp,
    trendDown: c.trendDown,
    vs: c.vs,
    charTitle: d.chartTitle,
    chartDescription: d.chartDescription,
    breakdownTitle: d.breakdownTitle,
    breakdownDescription: d.breakdownDescription,
    paginationPrev: c.paginationPrev,
    paginationNext: c.paginationNext,
    paginationOf: c.paginationOf,
    metricLabels: d.metric as Record<string, string>,
    dimensionLabels: d.dimension as Record<string, string>,
    kpiLabels: d.kpi as Record<string, string>
  };
}
