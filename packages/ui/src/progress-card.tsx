import type { HTMLAttributes, ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { cn } from "./cn";

export function ProgressCard({
  children,
  className,
  description,
  footer,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  description?: ReactNode;
  footer?: ReactNode;
  title: string;
}) {
  return (
    <Card className={cn("", className)} {...props}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
      {footer ? (
        <div className="border-t border-ink/8 px-5 py-4 text-sm text-muted">{footer}</div>
      ) : null}
    </Card>
  );
}
