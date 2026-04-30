/**
 * Typed shapes for `GET /api/admin/analytics` (executive) and adjacent admin APIs.
 * Align with `apps/api/src/analytics/analytics.repository.ts` `adminExecutive` return.
 */
export type KpiModel = {
  available: boolean;
  deltaRatio: number | null;
  format: "int" | "percent" | "time";
  previous: number | null;
  sparkline?: (number | null)[] | null;
  unavailableCode?: string;
  value: number | null;
};

export type AdminExecutiveKpi = {
  activeToday: KpiModel;
  bjtCompletions: KpiModel;
  d7: KpiModel;
  dataFreshness: {
    available: boolean;
    completedAt: string | null;
    format: "time";
    runStatus: string | null;
  };
  flashcardReviews: KpiModel;
  mau: KpiModel;
  monetization: Record<string, unknown>;
  newUsers: KpiModel;
  searchSuccessRate: KpiModel;
  wau: KpiModel;
};

export type AdminAnalyticsExecutiveResponse = {
  activeContentCount: number;
  executive: {
    compareLabel: { days: number; key: string };
    globalRollup: { studyMinutes: { available: false; code: string } };
    insights: {
      anomalyKey: string | null;
      biggestNegative: { d: number; k: string } | null;
      biggestPositive: { d: number; k: string } | null;
      freshnessStale: boolean;
      recommendedKey: string | null;
      searchZeroShare: number | null;
    };
    kpi: AdminExecutiveKpi;
    lastRollup: { completedAt: string | null; status: string } | null;
    mauDauWau: {
      byDay: Array<{
        bjtCompletions: number;
        dau: number;
        day: string;
        reviews: number;
        searchEventsRollup: number;
      }>;
      noteKey: string;
    };
    previousMetricTotals: Record<string, number>;
    previousRange: { end: string; start: string };
    search: { current: { total: number; zero: number }; previous: unknown };
    studyMinutes: { available: false; code: string };
  };
  latestRun: { completedAt: Date | null; status: string; startedAt?: Date } | null;
  metricTotals: Record<string, number>;
  range: { days: number; end: string; start: string };
  rawEvents: number;
  rollupAlignment: { rawMetricKeysRespectUserFilters: boolean; respectsFilters: boolean };
  userProfiles: number;
};

export type HealthReadyResponse = {
  checkedAt: string;
  service: string;
  status: "degraded" | "ok";
  version: string;
  checks?: Record<string, { message?: string; status: "degraded" | "ok" }>;
};

export type AdminAuditLogRow = {
  action: string;
  actor?: { displayName?: string | null } | null;
  createdAt: string;
  id: string;
  reason?: string | null;
  targetId: string;
  targetType: string;
};

export type AdminContentSummaryResponse = {
  byStatus: Record<string, number>;
  lastUpdatedAt: string | null;
  total: number;
  type: string;
};

export type AppHealthUiStatus = "healthy" | "degraded" | "down" | "unknown";

export type DateRangeKey = 7 | 30 | 90;
