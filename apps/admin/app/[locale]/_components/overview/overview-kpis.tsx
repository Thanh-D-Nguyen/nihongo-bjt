"use client";

import Link from "next/link";

import { AdminMetricTrend } from "@nihongo-bjt/ui";

import {
  formatDeltaPercent,
  kpiModelStatusTone,
  type KpiStatusTone
} from "@/lib/admin-overview-mappers";
import type { KpiModel } from "@/lib/admin-overview-types";

import { MiniSparkline } from "./mini-sparkline";

type KpiDef = {
  deltaKey: "neutral" | "up";
  formatValue: (m: KpiModel) => string;
  href?: string;
  kpi: KpiModel;
  label: string;
  helper: string;
};

const toneToCard: Record<KpiStatusTone, "danger" | "good" | "neutral" | "warning"> = {
  critical: "danger",
  good: "good",
  neutral: "neutral",
  warning: "warning"
};

export function ExecutiveKpiGrid({
  common,
  items
}: {
  common: { deltaNA: string; deltaFormat: (pct: string) => string };
  items: KpiDef[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((it) => {
        const m = it.kpi;
        const { line, tone: dt } = formatDeltaPercent(m.deltaRatio, {
          format: (p) => common.deltaFormat(p),
          na: common.deltaNA
        });
        const kTone = kpiModelStatusTone(m, it.deltaKey);
        const cardTone = toneToCard[kTone];
        return (
          <div className="relative flex flex-col rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm" key={it.label}>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">{it.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{it.formatValue(m)}</p>
            <div className="mt-1 flex min-h-[1.25rem] items-center gap-2">
              {m.sparkline && m.sparkline.length > 0 ? <MiniSparkline data={m.sparkline} /> : <span className="text-xs text-slate-400">—</span>}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <AdminMetricTrend tone={dt === "up" ? "up" : dt === "down" ? "down" : "neutral"}>{line}</AdminMetricTrend>
            </div>
            <p className="mt-2 text-xs leading-snug text-slate-500">{it.helper}</p>
            {it.href ? (
              <Link className="mt-3 text-xs font-semibold text-indigo-700 hover:text-indigo-900" href={it.href}>
                →
              </Link>
            ) : null}
            <span
              className="pointer-events-none absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor:
                  cardTone === "good"
                    ? "rgb(16 185 129)"
                    : cardTone === "warning"
                      ? "rgb(245 158 11)"
                      : cardTone === "danger"
                        ? "rgb(239 68 68)"
                        : "rgb(148 163 184)"
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
