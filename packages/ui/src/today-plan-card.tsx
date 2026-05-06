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
      className={cn("border-accent/15 bg-gradient-to-br from-surface to-indigo-50/40", className)}
      {...props}
    >
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {metaLine ? <CardDescription className="mt-1.5">{metaLine}</CardDescription> : null}
        </div>
        <div className="rounded-xl border border-leaf/20 bg-leaf/5 px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {streakLabel}
          </p>
          <p className="text-xl font-semibold tabular-nums text-leaf">{streakValue}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {children}
        {cta ? <div className="shrink-0">{cta}</div> : null}
      </CardContent>
    </Card>
  );
}
