"use client";

import {
  AdminEmptyState,
  AdminKpiCard,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type Snapshot = {
  generatedAt?: string;
  status?: string;
  dbStatus?: string;
  featureFlagsTotal?: number;
  deadLettersOpen?: number;
  importErrors24h?: number;
  importErrorsLast30Days?: number;
  scheduledOpsLast24h?: number;
};

type Labels = {
  title: string;
  description: string;
  refresh: string;
  loading: string;
  error: string;
  generatedAt: string;
  status: string;
  dbStatus: string;
  featureFlags: string;
  deadLetters: string;
  importErrors24h: string;
  scheduledOps24h: string;
  refreshHelp: string;
};

function tone(s?: string): "good" | "warning" | "danger" | "neutral" {
  if (!s) return "neutral";
  const v = s.toLowerCase();
  if (v.includes("ok") || v === "healthy" || v === "ready") return "good";
  if (v.includes("warn") || v.includes("degraded")) return "warning";
  if (v.includes("fail") || v.includes("down") || v.includes("error")) return "danger";
  return "neutral";
}

const REFRESH_MS = 30000;

export function SystemHealthClient({ labels }: { labels: Labels }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApiFetch("/api/admin/operations/system/health");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as Snapshot;
      setData(j);
      setError(null);
      setUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={labels.title}
        description={labels.description}
        actions={
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => void load()}
          >
            {labels.refresh}
          </button>
        }
      />
      <p className="text-xs text-slate-500">{labels.refreshHelp}</p>
      {loading && !data ? (
        <AdminSection title={labels.loading} description="">
          <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
        </AdminSection>
      ) : error && !data ? (
        <AdminEmptyState title={labels.error}>{error}</AdminEmptyState>
      ) : data ? (
        <AdminSection title={labels.title} description={labels.description}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <AdminKpiCard
              label={labels.status}
              value={
                <AdminStatusBadge tone={tone(data.status)}>{data.status ?? "—"}</AdminStatusBadge>
              }
            />
            <AdminKpiCard
              label={labels.dbStatus}
              value={
                <AdminStatusBadge tone={tone(data.dbStatus)}>{data.dbStatus ?? "—"}</AdminStatusBadge>
              }
            />
            <AdminKpiCard label={labels.featureFlags} value={data.featureFlagsTotal ?? "—"} />
            <AdminKpiCard
              label={labels.deadLetters}
              value={data.deadLettersOpen ?? 0}
              tone={data.deadLettersOpen && data.deadLettersOpen > 0 ? "warning" : "neutral"}
            />
            <AdminKpiCard
              label={labels.importErrors24h}
              value={data.importErrors24h ?? 0}
              tone={data.importErrors24h && data.importErrors24h > 0 ? "warning" : "neutral"}
            />
            <AdminKpiCard label={labels.scheduledOps24h} value={data.scheduledOpsLast24h ?? 0} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {labels.generatedAt}: {data.generatedAt ?? updatedAt ?? "—"}
          </p>
        </AdminSection>
      ) : null}
    </div>
  );
}
