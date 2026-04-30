"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AdminFilterBar } from "@nihongo-bjt/ui";

import type { DateRangeKey } from "@/lib/admin-overview-types";

type HeaderLabels = {
  customScaffold: string;
  customTooltip: string;
  dataFresh: string;
  envBadge: string;
  envLocal: string;
  envProd: string;
  envStaging: string;
  lastUpdated: string;
  never: string;
  rbacBadge: string;
  refresh: string;
  subtitle: string;
  title: string;
};

export function OverviewDashboardHeader({
  envName,
  labels,
  lastUpdatedAt,
  locale,
  onRefresh,
  permissionCount,
  rangeDays
}: {
  envName: "local" | "production" | "staging";
  labels: HeaderLabels;
  lastUpdatedAt: string | null;
  locale: string;
  onRefresh: () => void;
  permissionCount: number | null;
  rangeDays: DateRangeKey;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setRange = (d: DateRangeKey) => {
    const q = new URLSearchParams(searchParams?.toString() ?? "");
    q.set("range", String(d));
    router.replace(`${pathname}?${q.toString()}`);
  };

  const envClass =
    envName === "production"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : envName === "staging"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-slate-100 text-slate-800";

  const envText =
    envName === "production" ? labels.envProd : envName === "staging" ? labels.envStaging : labels.envLocal;

  const fmtTime = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString(locale === "ja" ? "ja-JP" : locale === "en" ? "en-GB" : "vi-VN")
    : labels.never;

  return (
    <header className="space-y-4 border-b border-slate-200/80 pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{labels.title}</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{labels.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${envClass}`}>{labels.envBadge}: {envText}</span>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-900">
            {labels.rbacBadge}
            {permissionCount != null ? ` · ${permissionCount}` : ""}
          </span>
          <span className="text-xs text-slate-500">
            {labels.lastUpdated}: {fmtTime}
          </span>
        </div>
      </div>

      <AdminFilterBar>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.dataFresh}</span>
          {([7, 30, 90] as const).map((d) => (
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                rangeDays === d
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              key={d}
              onClick={() => setRange(d)}
              type="button"
            >
              {d === 7 ? "7" : d === 30 ? "30" : "90"}
            </button>
          ))}
          <button
            className="cursor-not-allowed rounded-lg border border-dashed border-slate-200 px-3 py-1.5 text-sm text-slate-400"
            disabled
            title={labels.customTooltip}
            type="button"
          >
            {labels.customScaffold}
          </button>
          <button
            className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            onClick={() => onRefresh()}
            type="button"
          >
            {labels.refresh}
          </button>
        </div>
      </AdminFilterBar>
    </header>
  );
}

export function readRangeFromSearchParams(sp: URLSearchParams | null): DateRangeKey {
  const r = sp?.get("range");
  if (r === "30") {
    return 30;
  }
  if (r === "90") {
    return 90;
  }
  return 7;
}
