import type { HTMLAttributes, ReactNode } from "react";

import { Card, CardContent } from "./card";
import { cn } from "./cn";

export function StatCard({
  className,
  hint,
  label,
  value,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  hint?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <Card className={cn("overflow-hidden", className)} {...props}>
      <CardContent className="space-y-1 pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-[#4B5563]">{label}</p>
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#111827]">{value}</p>
        {hint ? <p className="text-xs text-[#6B7280]">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
