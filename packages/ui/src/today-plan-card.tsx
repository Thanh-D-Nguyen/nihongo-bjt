import type { HTMLAttributes, ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { cn } from "./cn";

export function TodayPlanCard({
  children,
  className,
  cta,
  metaLine,
  streakLabel,
  streakValue,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  cta?: ReactNode;
  metaLine?: ReactNode;
  streakLabel: string;
  streakValue: ReactNode;
  title: string;
}) {
  return (
    <Card
      className={cn("border-blue-100 bg-gradient-to-br from-white to-blue-50/40", className)}
      {...props}
    >
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {metaLine ? <CardDescription className="mt-1.5">{metaLine}</CardDescription> : null}
        </div>
        <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4B5563]">
            {streakLabel}
          </p>
          <p className="text-xl font-semibold tabular-nums text-emerald-600">{streakValue}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {children}
        {cta ? <div className="shrink-0">{cta}</div> : null}
      </CardContent>
    </Card>
  );
}
