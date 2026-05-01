"use client";

import {
  AdminEmptyState,
  AdminKpiCard,
  AdminPageHeader,
  AdminSection
} from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type Overview = {
  pending: number;
  inProgress: number;
  succeeded24h: number;
  failed24h: number;
  errors24h: number;
  manifestsActive: number;
  generatedAt?: string;
};

type Labels = {
  title: string;
  description: string;
  refresh: string;
  loading: string;
  error: string;
  pending: string;
  inProgress: string;
  succeeded24h: string;
  failed24h: string;
  errors24h: string;
  manifestsActive: string;
  failedQueueLink: string;
  manifestsLink: string;
  goToFailedQueue: string;
  goToManifests: string;
};

export function ImportOverviewClient({ labels, locale }: { labels: Labels; locale: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApiFetch("/api/admin/operations/import/overview");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as Overview);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={labels.title}
        description={labels.description}
        actions={
          <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium" onClick={() => void load()}>
            {labels.refresh}
          </button>
        }
      />
      {loading && !data ? (
        <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
      ) : error && !data ? (
        <AdminEmptyState title={labels.error}>{error}</AdminEmptyState>
      ) : data ? (
        <>
          <AdminSection title={labels.title}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <AdminKpiCard label={labels.pending} value={data.pending} />
              <AdminKpiCard label={labels.inProgress} value={data.inProgress} />
              <AdminKpiCard label={labels.succeeded24h} value={data.succeeded24h} tone="good" />
              <AdminKpiCard label={labels.failed24h} value={data.failed24h} tone={data.failed24h > 0 ? "danger" : "neutral"} />
              <AdminKpiCard label={labels.errors24h} value={data.errors24h} tone={data.errors24h > 0 ? "warning" : "neutral"} />
              <AdminKpiCard label={labels.manifestsActive} value={data.manifestsActive} />
            </div>
          </AdminSection>
          <AdminSection title="">
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                href={`/${locale}/import/failed`}
              >
                {labels.goToFailedQueue}
              </Link>
              <Link
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                href={`/${locale}/import/manifests`}
              >
                {labels.goToManifests}
              </Link>
            </div>
          </AdminSection>
        </>
      ) : null}
    </div>
  );
}

export type { Labels as ImportOverviewLabels };
