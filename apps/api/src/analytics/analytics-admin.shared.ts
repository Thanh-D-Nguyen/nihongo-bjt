import type { z } from "zod";
import type { adminAnalyticsCommonFilterSchema } from "@nihongo-bjt/shared";

import type { Response } from "express";

export type AnalyticsCommonFilter = z.infer<typeof adminAnalyticsCommonFilterSchema>;

export type AnalyticsRange = {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  days: number;
};

export type AnalyticsKpi = {
  id: string;
  value: number | null;
  previous: number | null;
  deltaRatio: number | null;
  format: "int" | "percent" | "duration_ms";
  available: boolean;
  unavailableCode?: string;
};

export type AnalyticsTimeseriesPoint = { t: string; value: number };

export type AnalyticsBreakdownRow = Record<string, string | number | boolean | null>;

const RANGE_PRESETS: Record<"7d" | "30d" | "90d", number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90
};

/**
 * Parse the `range` filter into an absolute window. For `custom`, requires `from` and `to`.
 * Returns a previous window of equal length immediately before `from`. All times are UTC.
 */
export function resolveAnalyticsRange(filter: AnalyticsCommonFilter): AnalyticsRange {
  const now = new Date();
  let to = now;
  let from: Date;
  if (filter.range === "custom") {
    if (!filter.from || !filter.to) {
      throw new Error("custom range requires from and to");
    }
    from = new Date(filter.from);
    to = new Date(filter.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error("invalid from/to");
    }
    if (to <= from) {
      throw new Error("to must be after from");
    }
  } else {
    const days = RANGE_PRESETS[filter.range];
    from = new Date(to.getTime() - days * 86_400_000);
  }
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const previousTo = new Date(from.getTime());
  const previousFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
  return { days, from, previousFrom, previousTo, to };
}

export function deltaRatio(value: number | null, previous: number | null): number | null {
  if (value == null || previous == null) return null;
  if (!Number.isFinite(value) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    return value > 0 ? 1 : 0;
  }
  return (value - previous) / previous;
}

export function buildKpi(input: {
  id: string;
  value: number | null;
  previous: number | null;
  format: AnalyticsKpi["format"];
  available?: boolean;
  unavailableCode?: string;
}): AnalyticsKpi {
  const available = input.available !== false && input.value != null;
  return {
    available,
    deltaRatio: available ? deltaRatio(input.value, input.previous) : null,
    format: input.format,
    id: input.id,
    previous: input.previous,
    unavailableCode: input.unavailableCode,
    value: available ? input.value : null
  };
}

export function dayBucketsBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(from);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Convert structured rows into RFC 4180 CSV. Empty rows produce just the header. */
export function rowsToCsv(rows: AnalyticsBreakdownRow[], orderedColumns?: string[]): string {
  const cols =
    orderedColumns ??
    (rows.length === 0 ? [] : Array.from(new Set(rows.flatMap((r) => Object.keys(r)))));
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const s = typeof val === "string" ? val : String(val);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
  return body.length > 0 ? `${header}\n${body}\n` : `${header}\n`;
}

export function setCsvDownloadHeaders(res: Response, filename: string): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
}

export const ANALYTICS_READ_PERMISSIONS = [
  "viewer.analytics",
  "admin.analytics.view",
  "analytics.view",
  "viewer.audit"
] as const;

export const ANALYTICS_EXPORT_PERMISSIONS = [
  "analytics.export",
  "analytics.manage",
  "admin.analytics.view",
  "iam.manage"
] as const;

export const ANALYTICS_REFRESH_PERMISSIONS = ANALYTICS_EXPORT_PERMISSIONS;

/**
 * Simple in-process throttle for analytics MV refresh. Per-actor + per-domain key, refuses
 * more than once per N seconds. Backend-only enforcement; UI is informational.
 */
const REFRESH_THROTTLE_MS = 30_000;
const lastRefresh = new Map<string, number>();
export function checkRefreshThrottle(actorId: string, domain: string): { allowed: boolean; retryAfterMs: number } {
  const key = `${actorId}::${domain}`;
  const now = Date.now();
  const last = lastRefresh.get(key) ?? 0;
  const wait = REFRESH_THROTTLE_MS - (now - last);
  if (wait > 0) {
    return { allowed: false, retryAfterMs: wait };
  }
  lastRefresh.set(key, now);
  return { allowed: true, retryAfterMs: 0 };
}
