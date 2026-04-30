"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

export function MiniSparkline({ data, color = "#3730a3" }: { color?: string; data: (number | null)[] }) {
  const rows = data.map((v, i) => ({ i, v: v ?? 0 }));
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="h-10 w-full max-w-[140px]">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={rows} margin={{ bottom: 0, left: 0, right: 0, top: 2 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area dataKey="v" fill="url(#sparkFill)" stroke={color} strokeWidth={1.5} type="monotone" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
