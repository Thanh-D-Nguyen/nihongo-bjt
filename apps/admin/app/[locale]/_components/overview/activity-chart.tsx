"use client";

import { AdminChartCard, AdminEmptyState } from "@nihongo-bjt/ui";
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { day: string; dau: number; reviews: number; search: number; sessions: number };

export function ActivityTrendChart({
  commonNoChart,
  data,
  debugMode,
  labels,
  loading
}: {
  commonNoChart: string;
  data: Row[] | null;
  debugMode?: boolean;
  labels: {
    dau: string;
    review: string;
    search: string;
    seriesHint: string;
    session: string;
    title: string;
  };
  loading: boolean;
}) {
  if (loading) {
    return (
      <AdminChartCard title={labels.title}>
        <div className="h-72 animate-pulse rounded-md bg-slate-100" />
      </AdminChartCard>
    );
  }
  if (!data || data.length === 0) {
    return (
      <AdminChartCard title={labels.title}>
        <AdminEmptyState title={commonNoChart} />
      </AdminChartCard>
    );
  }

  return (
    <AdminChartCard description={labels.seriesHint} title={labels.title}>
      <div className="h-80 w-full min-w-0">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={data} margin={{ bottom: 8, left: 0, right: 8, top: 8 }}>
            <XAxis
              dataKey="day"
              fontSize={10}
              tickFormatter={(v) => (typeof v === "string" && v.length >= 10 ? v.slice(5, 10) : String(v))}
              tickLine={false}
            />
            <YAxis allowDecimals={false} fontSize={11} tickLine={false} width={40} />
            <Tooltip
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) {
                  return null;
                }
                return (
                  <div className="max-w-sm rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
                    <p className="mb-1 font-semibold text-slate-800">{String(label)}</p>
                    <ul className="space-y-0.5 text-slate-600">
                      {payload.map((p) => (
                        <li className="flex justify-between gap-3" key={String(p.dataKey ?? p.name)}>
                          <span>{p.name}</span>
                          <span className="font-mono text-slate-800">{p.value != null ? String(p.value) : "—"}</span>
                        </li>
                      ))}
                    </ul>
                    {debugMode ? (
                      <p className="mt-1 border-t border-slate-100 pt-1 font-mono text-[0.65rem] text-slate-400">
                        dau=learner.active_users · reviews=flashcards.reviews · sessions=assessment.sessions_completed ·
                        search=content.search_events
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />
            <Legend
              formatter={(v) => <span className="text-xs text-slate-700">{v}</span>}
              iconType="line"
              verticalAlign="bottom"
              wrapperStyle={{ paddingTop: 8 }}
            />
            <Line dataKey="dau" name={labels.dau} stroke="#1d4ed8" strokeWidth={2} type="monotone" dot={false} />
            <Line dataKey="reviews" name={labels.review} stroke="#557c55" strokeWidth={2} type="monotone" dot={false} />
            <Line dataKey="sessions" name={labels.session} stroke="#a855f7" strokeWidth={2} type="monotone" dot={false} />
            <Line dataKey="search" name={labels.search} stroke="#c2410c" strokeWidth={2} type="monotone" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </AdminChartCard>
  );
}
